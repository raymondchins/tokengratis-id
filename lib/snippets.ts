// Setup-snippet generator — "Setup dalam 5 menit" panel di halaman provider.
// Pure functions, no React. Presentation layer di atas data yang UDAH ada di
// `Provider` (baseUrl, models[], slug) — GA NEBAK apa-apa yang baru.
//
// ANTI-HALUSINASI: kalau `provider.baseUrl` null, sumber ga nyediain base URL
// terstruktur → kita GA bikin baseUrl palsu. `getProviderSetup` return `null`,
// UI (SetupPanel) yang nampilin honest fallback + link ke `provider.url`.
// Model id juga divalidasi HARUS ada di `provider.models[]` — ga ada model id
// hasil karangan.

import type { Provider } from "./types";

export type SnippetTargetId =
  | "openai-node"
  | "openai-python"
  | "vercel-ai-sdk"
  | "langchain-python"
  | "curl";

export interface CodeSnippet {
  id: SnippetTargetId;
  /** Label tab, mis. "OpenAI SDK (Node.js)". */
  label: string;
  /** Bahasa buat hint (ga dipakai buat syntax highlighting, plain <pre> aja). */
  language: "typescript" | "python" | "bash";
  code: string;
}

export interface ProviderSetup {
  /** Nama env var, di-derive dari slug — mis. "google-gemini" -> "GOOGLE_GEMINI_API_KEY". */
  envVarName: string;
  /** Blok `.env` siap-copy. */
  envSnippet: string;
  snippets: CodeSnippet[];
}

/** Derive nama env var dari slug: uppercase, non-alfanumerik -> "_". */
export function buildEnvVarName(slug: string): string {
  const base = slug
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${base}_API_KEY`;
}

/** Strip trailing slash biar aman di-concat sama path lain (mis. curl). */
function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Bangun semua snippet setup buat 1 provider + 1 model.
 * Return `null` kalau `provider.baseUrl` null (ga ada base URL terstruktur
 * dari sumber) ATAU `modelId` ga ketemu di `provider.models[]` (jangan
 * generate snippet buat model yang ga beneran ada).
 */
export function getProviderSetup(
  provider: Provider,
  modelId: string,
): ProviderSetup | null {
  if (!provider.baseUrl) return null;

  const model = provider.models.find((m) => m.id === modelId);
  if (!model) return null;

  const baseUrl = provider.baseUrl;
  const cleanBaseUrl = stripTrailingSlash(baseUrl);
  const envVarName = buildEnvVarName(provider.slug);
  const envSnippet = `${envVarName}=your-api-key-here`;

  const snippets: CodeSnippet[] = [
    {
      id: "openai-node",
      label: "OpenAI SDK (Node.js)",
      language: "typescript",
      code: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${baseUrl}",
  apiKey: process.env.${envVarName},
});

const response = await client.chat.completions.create({
  model: "${model.id}",
  messages: [{ role: "user", content: "Halo!" }],
});

console.log(response.choices[0].message.content);`,
    },
    {
      id: "openai-python",
      label: "OpenAI SDK (Python)",
      language: "python",
      code: `import os
from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}",
    api_key=os.environ["${envVarName}"],
)

response = client.chat.completions.create(
    model="${model.id}",
    messages=[{"role": "user", "content": "Halo!"}],
)

print(response.choices[0].message.content)`,
    },
    {
      id: "vercel-ai-sdk",
      label: "Vercel AI SDK",
      language: "typescript",
      code: `import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";

const ${toIdentifier(provider.slug)} = createOpenAICompatible({
  name: "${provider.slug}",
  baseURL: "${baseUrl}",
  apiKey: process.env.${envVarName},
});

const { text } = await generateText({
  model: ${toIdentifier(provider.slug)}("${model.id}"),
  prompt: "Halo!",
});

console.log(text);`,
    },
    {
      id: "langchain-python",
      label: "LangChain (Python)",
      language: "python",
      code: `import os
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    base_url="${baseUrl}",
    api_key=os.environ["${envVarName}"],
    model="${model.id}",
)

response = llm.invoke("Halo!")
print(response.content)`,
    },
    {
      id: "curl",
      label: "curl",
      language: "bash",
      code: `curl "${cleanBaseUrl}/chat/completions" \\
  -H "Authorization: Bearer $${envVarName}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model.id}",
    "messages": [{"role": "user", "content": "Halo!"}]
  }'`,
    },
  ];

  return { envVarName, envSnippet, snippets };
}

/** Slug -> camelCase identifier valid buat variable name di snippet JS/TS. */
function toIdentifier(slug: string): string {
  const camel = slug
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part, i) =>
      i === 0
        ? part.toLowerCase()
        : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
    )
    .join("");
  // fallback kalau slug kosong / semua karakter aneh
  const safe = camel.length > 0 ? camel : "provider";
  // identifier ga boleh mulai dengan angka
  return /^[0-9]/.test(safe) ? `p${safe}` : safe;
}
