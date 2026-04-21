import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../../../.env') });

import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';
import remedies from './data/remedies.json';
import regionalRisk from './data/regional-risk.json';

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const genai = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
const embedModel = genai.getGenerativeModel({ model: 'text-embedding-004' });

async function embed(text: string): Promise<number[]> {
  const result = await embedModel.embedContent(text);
  return result.embedding.values;
}

function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

async function seedRemedies(index: ReturnType<Pinecone['index']>) {
  console.log(`\nSeeding ${remedies.length} remedies...`);

  for (const remedy of remedies) {
    const text = `${remedy.nameEn} — treats ${remedy.conditions.join(', ')} — symptoms: ${remedy.symptoms.join(', ')} — ingredients: ${remedy.ingredients.join(', ')}`;
    const values = await embed(text);

    await index.namespace('remedies').upsert({ records: [{
      id: remedy.id,
      values,
      metadata: {
        nameEn:           remedy.nameEn,
        nameHi:           remedy.nameHi,
        conditions:       remedy.conditions,
        symptoms:         remedy.symptoms,
        ingredients:      remedy.ingredients,
        preparationEn:    remedy.preparationEn,
        preparationHi:    remedy.preparationHi,
        safetyGeneral:    remedy.safetyGeneral,
        safetyChildren:   remedy.safetyChildren,
        safetyPregnancy:  remedy.safetyPregnancy,
        safetyElderly:    remedy.safetyElderly,
        contraindications: remedy.contraindications,
        allergens:        remedy.allergens,
        source:           remedy.source,
        credibilityScore: remedy.credibilityScore,
      },
    }] });

    console.log(`  ✓ ${remedy.nameEn}`);
    await sleep(300); // avoid rate limit
  }
}

async function seedRegionalRisk(index: ReturnType<Pinecone['index']>) {
  console.log(`\nSeeding ${regionalRisk.length} regional risk entries...`);

  for (const region of regionalRisk) {
    const allDiseases = [...region.endemic, ...region.seasonal];
    const text = `${region.region} ${region.state} India months ${region.monthStart} to ${region.monthEnd} common diseases: ${allDiseases.join(', ')}. ${region.notes}`;
    const values = await embed(text);

    await index.namespace('regional-risk').upsert({ records: [{
      id: region.id,
      values,
      metadata: {
        region:      region.region,
        state:       region.state,
        country:     region.country,
        monthStart:  region.monthStart,
        monthEnd:    region.monthEnd,
        endemic:     region.endemic,
        seasonal:    region.seasonal,
        notes:       region.notes,
      },
    }] });

    console.log(`  ✓ ${region.region} (months ${region.monthStart}–${region.monthEnd})`);
    await sleep(300);
  }
}

async function main() {
  const indexName = process.env.PINECONE_INDEX ?? 'nova-medical';
  console.log(`Connecting to Pinecone index: ${indexName}`);

  // Create index if it doesn't exist
  const existingIndexes = await pinecone.listIndexes();
  const exists = existingIndexes.indexes?.some(i => i.name === indexName);

  if (!exists) {
    console.log('Index not found — creating...');
    await pinecone.createIndex({
      name: indexName,
      dimension: 768,
      metric: 'cosine',
      spec: { serverless: { cloud: 'aws', region: 'us-east-1' } },
    });
    console.log('Waiting for index to be ready...');
    await sleep(60000);
  }

  const index = pinecone.index(indexName);

  await seedRemedies(index);
  await seedRegionalRisk(index);

  console.log('\n✅ Pinecone seeding complete.');
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
