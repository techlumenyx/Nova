import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '@nova/shared';

export interface LLMMessage {
  role: 'user' | 'model';
  content: string;
}

let genai: GoogleGenerativeAI | null = null;
function getGenAI() {
  if (!genai) genai = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
  return genai;
}

const MAX_RETRIES = 2;
const TIMEOUT_MS  = 15_000;
const BACKOFF_MS  = [1_000, 3_000] as const;

/**
 * Calls Gemini 1.5 Flash with retry × MAX_RETRIES and 15 s timeout.
 * Throws on exhaustion — caller must handle and increment llmFailureCount.
 */
export async function callLLM(
  systemInstruction: string,
  history: LLMMessage[],
  userMessage: string,
): Promise<string> {
  const model = getGenAI().getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction,
  });

  const geminiHistory = history.map(m => ({
    role: m.role,
    parts: [{ text: m.content }],
  }));

  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(BACKOFF_MS[attempt - 1]);
    try {
      const chat   = model.startChat({ history: geminiHistory });
      const result = await Promise.race([
        chat.sendMessage(userMessage),
        timeout(TIMEOUT_MS),
      ]);
      return result.response.text();
    } catch (err) {
      lastErr = err;
      logger.warn('[LLM] attempt failed', { attempt, err });
    }
  }
  throw lastErr;
}

/**
 * Same as callLLM but instructs the model to reply with a JSON object only.
 * Returns parsed object, or null on parse failure.
 */
export async function callLLMJson<T>(
  systemInstruction: string,
  history: LLMMessage[],
  userMessage: string,
): Promise<T | null> {
  let raw: string;
  try {
    raw = await callLLM(systemInstruction, history, userMessage);
  } catch {
    return null;
  }
  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    logger.warn('[LLM] JSON parse failed', { raw });
    return null;
  }
}

function sleep(ms: number) {
  return new Promise<void>(res => setTimeout(res, ms));
}

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`LLM timeout after ${ms}ms`)), ms),
  );
}
