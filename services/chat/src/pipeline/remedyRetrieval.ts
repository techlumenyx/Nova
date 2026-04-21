/**
 * Stage 4.4 — Remedy Retrieval
 * Embeds chief complaint + symptoms → Pinecone similarity search (namespace: remedies).
 * Safety-filters by allergens, contraindications, and demographic flags.
 * Re-ranks: 60 % Pinecone score + 40 % credibility score.
 * Falls back gracefully if Pinecone is unavailable.
 */

import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '@nova/shared';
import type { IDiagnosisSession, RemedyResult } from '../models/session.model';

let pinecone: Pinecone | null = null;
function getPinecone() {
  if (!pinecone) pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  return pinecone;
}

let embedModel: ReturnType<InstanceType<typeof GoogleGenerativeAI>['getGenerativeModel']> | null = null;
function getEmbedModel() {
  if (!embedModel) {
    const genai = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
    embedModel = genai.getGenerativeModel({ model: 'text-embedding-004' });
  }
  return embedModel;
}

// ─── Types matching Pinecone metadata fields ─────────────────────────────────

interface RemedyMeta {
  nameEn: string;
  nameHi: string;
  conditions: string[];
  symptoms: string[];
  ingredients: string[];
  preparationEn: string;
  preparationHi: string;
  safetyGeneral: string;
  safetyChildren: string;
  safetyPregnancy: string;
  safetyElderly: string;
  contraindications: string[];
  allergens: string[];
  source: string;
  credibilityScore: number;
}

export async function retrieveRemedies(session: IDiagnosisSession): Promise<RemedyResult[]> {
  if (!process.env.PINECONE_API_KEY || !process.env.GOOGLE_AI_API_KEY) {
    logger.info('[RemedyRetrieval] Skipping — API keys not configured');
    return [];
  }

  const sx = session.symptomSet;
  if (!sx?.chiefComplaint) return [];

  const query = buildQuery(sx);

  try {
    const values = await embed(query);
    const index  = getPinecone().index(process.env.PINECONE_INDEX ?? 'nova-medical');
    const result = await index.namespace('remedies').query({
      vector: values,
      topK: 15,
      includeValues: false,
      includeMetadata: true,
    });

    const matches = result.matches ?? [];
    const profile = session.userProfile;

    const filtered = matches
      .filter(m => (m.score ?? 0) >= 0.5 && m.metadata)
      .map(m => ({
        meta:  m.metadata as unknown as RemedyMeta,
        score: m.score ?? 0,
      }))
      .filter(({ meta }) => isSafe(meta, profile))
      .map(({ meta, score }) => ({
        meta,
        rank: 0.6 * score + 0.4 * normalise(meta.credibilityScore, 1, 10),
      }))
      .sort((a, b) => b.rank - a.rank)
      .slice(0, 4)
      .map(({ meta }) => toRemedyResult(meta));

    logger.info('[RemedyRetrieval] Retrieved remedies', { count: filtered.length });
    return filtered;
  } catch (err) {
    logger.warn('[RemedyRetrieval] Pinecone query failed, returning empty', { err });
    return [];
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildQuery(sx: IDiagnosisSession['symptomSet']): string {
  const parts = [sx!.chiefComplaint];
  if (sx!.symptoms?.length) parts.push(sx!.symptoms.map(s => s.name).join(', '));
  return parts.join(' — ');
}

async function embed(text: string): Promise<number[]> {
  const result = await getEmbedModel().embedContent(text);
  return result.embedding.values;
}

function isSafe(meta: RemedyMeta, profile: IDiagnosisSession['userProfile']): boolean {
  const allergyDrugs = profile.allergies?.drugs?.map(a => a.toLowerCase()) ?? [];
  const allergyFood  = profile.allergies?.food?.map(a => a.toLowerCase())  ?? [];
  const allAllergies = [...allergyDrugs, ...allergyFood];

  // Block if any remedy ingredient/allergen matches patient allergens
  if (meta.allergens?.some(a => allAllergies.includes(a.toLowerCase()))) return false;

  // Block if contraindicated by known condition
  const conditions = (profile.conditions ?? []).map(c => c.toLowerCase());
  if (meta.contraindications?.some(c => conditions.some(pc => pc.includes(c.toLowerCase())))) {
    return false;
  }

  // Safety labels: skip remedies marked "unsafe" for the demographic
  if (profile.age <= 5  && meta.safetyChildren?.toLowerCase().includes('unsafe'))  return false;
  if (profile.age >= 60 && meta.safetyElderly?.toLowerCase().includes('unsafe'))   return false;
  // Conservative: flag pregnancy-unsafe for all reproductive-age females
  if (
    profile.sex === 'FEMALE' &&
    profile.age >= 15 && profile.age <= 45 &&
    meta.safetyPregnancy?.toLowerCase().includes('unsafe')
  ) return false;

  return true;
}

function toRemedyResult(meta: RemedyMeta): RemedyResult {
  return {
    nameEn:        meta.nameEn,
    nameHi:        meta.nameHi,
    preparationEn: meta.preparationEn,
    preparationHi: meta.preparationHi,
    ingredients:   meta.ingredients,
    source:        meta.source,
  };
}

/** Normalise a value in [min, max] to [0, 1]. */
function normalise(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}
