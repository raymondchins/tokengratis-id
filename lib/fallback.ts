// lib/fallback.ts — logic buat halaman /fallback (generator rantai fallback).
// Pure functions, NO React. Ditest secara implisit lewat tsc --noEmit + eyeball
// di FallbackClient.
//
// ATURAN ANTI-HALUSINASI (sama kayak scripts/*): generator ini CUMA boleh pakai
// provider yang `baseUrl`-nya beneran ada di data/providers.json, dan CUMA model
// id yang beneran ada di `models[]` provider itu. Ga ada baseUrl/model id yang
// dikarang.

import type { Provider } from "./types";

// ─── Slim data shapes buat picker (client) ────────────────────────────────────

export interface FallbackModel {
  id: string;
  name: string;
}

/** Provider yang eligible masuk generator — baseUrl WAJIB ada + minimal 1 model. */
export interface FallbackProvider {
  slug: string;
  name: string;
  baseUrl: string;
  models: FallbackModel[];
}

/** Satu langkah dalam rantai fallback yang user susun (provider + model terpilih). */
export interface ChainStep {
  slug: string;
  name: string;
  baseUrl: string;
  modelId: string;
}

export const MIN_CHAIN_LENGTH = 2;
export const MAX_CHAIN_LENGTH = 4;

/**
 * Filter provider penuh (dari getAllProviders()) jadi payload ramping buat
 * picker client. Provider tanpa baseUrl (ga bisa dipanggil developer) atau
 * tanpa model sama sekali di-exclude.
 */
export function getEligibleProviders(providers: Provider[]): FallbackProvider[] {
  return providers
    .filter((p): p is Provider & { baseUrl: string } => Boolean(p.baseUrl) && p.models.length > 0)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      baseUrl: p.baseUrl,
      models: p.models.map((m) => ({ id: m.id, name: m.name })),
    }));
}

/** Provider yang DI-EXCLUDE dari generator (buat ditampilin alasannya di UI). */
export function getExcludedProviders(providers: Provider[]): { slug: string; name: string }[] {
  return providers
    .filter((p) => !p.baseUrl || p.models.length === 0)
    .map((p) => ({ slug: p.slug, name: p.name }));
}

// ─── Env var naming ────────────────────────────────────────────────────────────

/** slug provider → nama env var: uppercase, non-alfanumerik jadi "_", suffix _API_KEY. */
export function envVarName(slug: string): string {
  const cleaned = slug
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${cleaned}_API_KEY`;
}

// ─── Small string-escaping helpers ─────────────────────────────────────────────

/** Quote a string buat dipakai sebagai scalar YAML (double-quoted, escape " dan \). */
function yamlQuote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** Quote a string buat dipakai sebagai TS string literal (double-quoted). */
function tsQuote(value: string): string {
  return JSON.stringify(value);
}

/** model_name unik per langkah di LiteLLM config — slug + index (hindari collision
 *  kalau user pilih provider yang sama 2x dengan model beda). */
function liteLLMModelName(step: ChainStep, index: number): string {
  return `${step.slug}-${index + 1}`;
}

// ─── Generator 1: Vercel AI SDK ────────────────────────────────────────────────

export function generateVercelAiSdk(chain: ChainStep[]): string {
  const providerBlocks = chain
    .map((step) => {
      const envVar = envVarName(step.slug);
      return `  createOpenAICompatible({
    name: ${tsQuote(step.slug)},
    apiKey: process.env.${envVar},
    baseURL: ${tsQuote(step.baseUrl)},
  })(${tsQuote(step.modelId)}), // ${step.name}`;
    })
    .join("\n");

  return `// Vercel AI SDK — @ai-sdk/openai-compatible + ai
// npm install ai @ai-sdk/openai-compatible

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";

// Rantai model, urut dari prioritas tertinggi ke paling belakang.
// AI SDK belum punya fallback bawaan, jadi kita coba satu-satu manual.
const fallbackModels = [
${providerBlocks}
];

export async function generateWithFallback(prompt: string) {
  let lastError: unknown;

  for (const model of fallbackModels) {
    try {
      const { text } = await generateText({ model, prompt });
      return text;
    } catch (err) {
      lastError = err;
      // lanjut ke model berikutnya di rantai
    }
  }

  throw new Error(\`Semua provider di rantai gagal: \${String(lastError)}\`);
}
`;
}

// ─── Generator 2: LiteLLM config.yaml ──────────────────────────────────────────

export function generateLiteLLMConfig(chain: ChainStep[]): string {
  // NOTE: config ini buat di-self-host user sendiri (litellm proxy) — kita ga
  // nge-host proxy apa pun.
  const modelListEntries = chain
    .map((step, i) => {
      const modelName = liteLLMModelName(step, i);
      const envVar = envVarName(step.slug);
      return `  - model_name: ${yamlQuote(modelName)}
    litellm_params:
      model: ${yamlQuote(`openai/${step.modelId}`)}
      api_base: ${yamlQuote(step.baseUrl)}
      api_key: ${yamlQuote(`os.environ/${envVar}`)}`;
    })
    .join("\n");

  const stepNames = chain.map((step, i) => liteLLMModelName(step, i));
  const [primary, ...rest] = stepNames;

  const fallbacksSection =
    chain.length >= 2 && primary
      ? `

router_settings:
  fallbacks:
    - ${yamlQuote(primary)}: [${rest.map((n) => yamlQuote(n)).join(", ")}]`
      : "";

  return `# LiteLLM proxy config — self-hosted (litellm --config config.yaml)
# https://docs.litellm.ai/docs/routing
model_list:
${modelListEntries}${fallbacksSection}
`;
}

// ─── Generator 3: Plain TypeScript, dependency-free ────────────────────────────

export function generateTypeScriptFallback(chain: ChainStep[]): string {
  const chainEntries = chain
    .map((step) => {
      const envVar = envVarName(step.slug);
      return `  {
    name: ${tsQuote(step.name)},
    baseUrl: ${tsQuote(step.baseUrl)},
    apiKey: process.env.${envVar} ?? "",
    model: ${tsQuote(step.modelId)},
  },`;
    })
    .join("\n");

  return `// Dependency-free fallback caller — cuma pakai fetch() bawaan.
// Retry ke provider berikutnya CUMA kalau HTTP 429 (rate limit) atau 5xx
// (server error) — error lain (401/400/dst) langsung dilempar, karena itu
// biasanya bug di request-nya sendiri, bukan soal kuota/downtime provider.

interface FallbackStep {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

const FALLBACK_CHAIN: FallbackStep[] = [
${chainEntries}
];

export async function callWithFallback(
  messages: { role: string; content: string }[],
): Promise<string> {
  let lastError: unknown;

  for (const step of FALLBACK_CHAIN) {
    try {
      const res = await fetch(\`\${step.baseUrl}/chat/completions\`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: \`Bearer \${step.apiKey}\`,
        },
        body: JSON.stringify({ model: step.model, messages }),
      });

      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(\`\${step.name} balas \${res.status} — coba provider berikutnya\`);
        continue;
      }

      if (!res.ok) {
        throw new Error(\`\${step.name} balas \${res.status}: \${await res.text()}\`);
      }

      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? "";
    } catch (err) {
      if (err instanceof TypeError) {
        // fetch() throw TypeError kalau network-level gagal (DNS/timeout/dst) —
        // itu juga layak coba provider berikutnya.
        lastError = err;
        continue;
      }
      throw err;
    }
  }

  throw new Error(\`Semua provider di rantai gagal. Error terakhir: \${String(lastError)}\`);
}
`;
}

// ─── Generator 4: .env ─────────────────────────────────────────────────────────

export function generateEnvFile(chain: ChainStep[]): string {
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const step of chain) {
    const envVar = envVarName(step.slug);
    if (seen.has(envVar)) continue;
    seen.add(envVar);
    lines.push(`# ${step.name}`);
    lines.push(`${envVar}=`);
  }

  return `${lines.join("\n")}\n`;
}
