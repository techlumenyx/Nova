import { Pinecone } from '@pinecone-database/pinecone';
import { getRedis } from '../lib/redis';
import { logger } from '@nova/shared';
import { embed } from '../lib/embed';
import type { RegionalRisk } from '../models/session.model';

let pinecone: Pinecone | null = null;
function getPinecone() {
  if (!pinecone) pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  return pinecone;
}

const INDIA_WIDE_SEASONAL: Record<string, string[]> = {
  '1': ['Influenza', 'Viral fever'],
  '2': ['Influenza', 'Viral fever'],
  '3': ['Heatstroke', 'GI infections', 'Dehydration', 'Chickenpox'],
  '4': ['Heatstroke', 'GI infections', 'Dehydration'],
  '5': ['Heatstroke', 'GI infections', 'Dehydration'],
  '6': ['Dengue', 'Malaria', 'Gastroenteritis'],
  '7': ['Dengue', 'Malaria', 'Leptospirosis', 'Typhoid'],
  '8': ['Dengue', 'Malaria', 'Leptospirosis', 'Typhoid'],
  '9': ['Dengue', 'Malaria', 'Typhoid'],
  '10': ['Dengue', 'Viral fever'],
  '11': ['Respiratory infections', 'Viral fever'],
  '12': ['Respiratory infections', 'Influenza'],
};

export async function getRegionalRisk(city?: string): Promise<RegionalRisk> {
  const month = new Date().getMonth() + 1;
  const cacheKey = `regional:${(city ?? 'india').toLowerCase()}:${month}`;
  const redis = getRedis();

  // Check Redis cache first (Redis may be null if unavailable)
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info('[RegionalRisk] cache hit', { city, month });
        return JSON.parse(cached);
      }
    } catch (err) {
      logger.warn('[RegionalRisk] Redis read failed, continuing without cache', { err });
    }
  }

  let result: RegionalRisk;

  // Try Pinecone if city is provided and API key is set
  if (city && process.env.PINECONE_API_KEY && process.env.GOOGLE_AI_API_KEY) {
    try {
      result = await queryPinecone(city, month);
    } catch (err) {
      logger.warn('[RegionalRisk] Pinecone query failed, using fallback', { err });
      result = getStaticFallback(city, month);
    }
  } else {
    result = getStaticFallback(city, month);
  }

  // Cache result if Redis is available
  if (redis) {
    try {
      await redis.set(cacheKey, JSON.stringify(result), 'EX', 60 * 60 * 24 * 30); // 30 days
    } catch (err) {
      logger.warn('[RegionalRisk] Redis write failed', { err });
    }
  }

  return result;
}

async function queryPinecone(city: string, month: number): Promise<RegionalRisk> {
  const query = `${city} India month ${month} common diseases endemic seasonal`;
  const vector = await embed(query);

  const index = getPinecone().index(process.env.PINECONE_INDEX ?? 'nova-medical');
  const results = await index.namespace('regional-risk').query({
    vector,
    topK: 3,
    includeValues: false,
    includeMetadata: true,
  });

  const best = results.matches?.[0];
  if (!best || best.score! < 0.6) {
    return getStaticFallback(city, month);
  }

  const meta = best.metadata as any;
  return {
    city,
    country: 'India',
    month,
    endemic: (meta.endemic as string[]) ?? [],
    seasonal: (meta.seasonal as string[]) ?? [],
    generatedAt: new Date().toISOString(),
  };
}

function getStaticFallback(city?: string, month?: number): RegionalRisk {
  const m = month ?? new Date().getMonth() + 1;
  return {
    city: city ?? 'India',
    country: 'India',
    month: m,
    endemic: [],
    seasonal: INDIA_WIDE_SEASONAL[String(m)] ?? ['Viral fever'],
    generatedAt: new Date().toISOString(),
  };
}
