/**
 * Google gemini-embedding-001 via direct REST (v1beta endpoint).
 * Successor to text-embedding-004 — same 768-dimensional output.
 * Matches our Pinecone index dimension.
 */

const MODEL   = 'models/gemini-embedding-001';
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/${MODEL}:embedContent`;

export async function embed(text: string): Promise<number[]> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY is not set');

  const response = await fetch(`${EMBED_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: { parts: [{ text }] },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Embedding failed [${response.status}]: ${body}`);
  }

  const data = await response.json() as { embedding: { values: number[] } };
  return data.embedding.values;
}
