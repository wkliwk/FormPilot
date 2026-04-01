/**
 * AI provider fallback chain for text generation.
 *
 * Chain: Groq (llama-3.3-70b) → OpenRouter (same model via aggregator)
 *
 * - 429 rate limit: immediately skip to next provider (no backoff on current)
 * - Other transient errors (5xx, network): retry within provider before moving on
 * - Only if all providers fail does an error propagate to the caller
 */
import Groq from "groq-sdk";

// ─── Singletons ──────────────────────────────────────────────────────────────

let _groq: Groq | null = null;
function getGroqClient(): Groq {
  if (!_groq) {
    if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is not set");
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
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

/**
 * OpenRouter — OpenAI-compatible aggregator.
 * Uses the same model as Groq when available, falls back to router's choice.
 * Set OPENROUTER_MODEL to override (e.g. "anthropic/claude-haiku-4-5").
 */
async function callOpenRouter(prompt: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const model = process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct";

  return withProviderRetry(async () => {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://formpilot.app",
        "X-Title": "FormPilot",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      const err = new Error(`OpenRouter HTTP ${res.status}`) as Error & { status: number };
      err.status = res.status;
      throw err;
    }

    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = json.choices?.[0]?.message?.content;
    if (!text) throw new Error("Empty response from OpenRouter");
    return text;
  }, "openrouter");
}

// ─── Public API ───────────────────────────────────────────────────────────────

type ProviderName = "groq" | "openrouter";

const PROVIDERS: Array<{
  name: ProviderName;
  fn: (prompt: string, maxTokens: number) => Promise<string>;
}> = [
  { name: "groq", fn: callGroq },
  { name: "openrouter", fn: callOpenRouter },
];

/**
 * Call text AI with automatic provider fallback.
 *
 * Tries Groq first, then OpenRouter.
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
