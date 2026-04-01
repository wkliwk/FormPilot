/**
 * AI provider fallback chain for text generation.
 *
 * Chain: Groq (llama-3.3-70b) → Anthropic Claude Haiku → Google Gemini Flash
 *
 * - 429 rate limit: immediately skip to next provider (no backoff on current)
 * - Other transient errors (5xx, network): retry within provider before moving on
 * - Only if all three providers fail does an error propagate to the caller
 */
import Groq from "groq-sdk";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ─── Singletons ──────────────────────────────────────────────────────────────

let _groq: Groq | null = null;
function getGroqClient(): Groq {
  if (!_groq) {
    if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is not set");
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
}

let _anthropic: Anthropic | null = null;
function getAnthropicFallbackClient(): Anthropic {
  if (!_anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

let _gemini: GoogleGenerativeAI | null = null;
function getGeminiClient(): GoogleGenerativeAI {
  if (!_gemini) {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");
    _gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return _gemini;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isRateLimited(err: unknown): boolean {
  return (err as { status?: number }).status === 429;
}

function isNonRetryable(err: unknown): boolean {
  const status = (err as { status?: number }).status;
  return status === 400 || status === 401 || status === 404;
}

const BACKOFF_MS = [1000, 2000, 4000];

/**
 * Retry fn up to 3 times for transient errors.
 * Immediately re-throws on 429 (rate limit) so the chain can try the next provider.
 */
async function withProviderRetry<T>(fn: () => Promise<T>, providerName: string): Promise<T> {
  let lastError: Error = new Error("Unknown error");

  for (let attempt = 0; attempt <= 3; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!(err instanceof Error)) throw err;
      lastError = err;

      // 429 — escape immediately so the chain can try the next provider
      if (isRateLimited(err)) throw err;

      // Permanent errors — no point retrying
      if (isNonRetryable(err)) throw err;

      // Last attempt exhausted
      if (attempt >= 3) break;

      const backoff = BACKOFF_MS[attempt] ?? 4000;
      console.warn(
        `[ai-chain] ${providerName} transient error (attempt ${attempt + 1}/3), retrying in ${backoff}ms: ${err.message}`
      );
      await new Promise<void>((r) => setTimeout(r, backoff));
    }
  }

  throw lastError;
}

// ─── Per-provider callers ────────────────────────────────────────────────────

async function callGroq(prompt: string, maxTokens: number): Promise<string> {
  const client = getGroqClient();
  return withProviderRetry(async () => {
    const res = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    });
    const text = res.choices[0]?.message?.content;
    if (!text) throw new Error("Empty response from Groq");
    return text;
  }, "groq");
}

async function callAnthropic(prompt: string, maxTokens: number): Promise<string> {
  const client = getAnthropicFallbackClient();
  return withProviderRetry(async () => {
    const res = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    });
    const block = res.content[0];
    if (block.type !== "text" || !block.text) throw new Error("Empty response from Anthropic");
    return block.text;
  }, "anthropic");
}

async function callGemini(prompt: string, maxTokens: number): Promise<string> {
  const client = getGeminiClient();
  return withProviderRetry(async () => {
    const model = client.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.1 },
    });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    if (!text) throw new Error("Empty response from Gemini");
    return text;
  }, "gemini");
}

// ─── Public API ───────────────────────────────────────────────────────────────

type ProviderName = "groq" | "anthropic" | "gemini";

const PROVIDERS: Array<{
  name: ProviderName;
  fn: (prompt: string, maxTokens: number) => Promise<string>;
}> = [
  { name: "groq", fn: callGroq },
  { name: "anthropic", fn: callAnthropic },
  { name: "gemini", fn: callGemini },
];

/**
 * Call text AI with automatic provider fallback.
 *
 * Tries Groq first, then Anthropic Claude Haiku, then Gemini Flash.
 * On 429 rate limit, skips immediately to the next provider.
 * On other transient errors, retries within the same provider before moving on.
 */
export async function callTextAI(
  prompt: string,
  context: string,
  maxTokens = 4096
): Promise<string> {
  const failures: Array<{ provider: ProviderName; reason: string }> = [];

  for (const provider of PROVIDERS) {
    try {
      const text = await provider.fn(prompt, maxTokens);
      if (failures.length > 0) {
        console.log(
          `[ai-chain] "${context}" succeeded with ${provider.name} after ${failures.length} failure(s)`
        );
      }
      return text;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      const tag = isRateLimited(err) ? "rate-limited" : "error";
      console.warn(`[ai-chain] ${provider.name} ${tag} for "${context}": ${reason}`);
      failures.push({ provider: provider.name, reason });
    }
  }

  const summary = failures.map((f) => `${f.provider}: ${f.reason}`).join(" | ");
  throw new Error(`All AI providers failed for "${context}": ${summary}`);
}
