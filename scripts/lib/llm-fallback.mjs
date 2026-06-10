/**
 * scripts/lib/llm-fallback.mjs — LLM re-parse fallback untuk tokengratis.id pipeline.
 *
 * Dipakai HANYA saat adapter regex sebuah sumber gagal melewati sanity floor
 * (misal: format sumber berubah, hasil parse < N provider). Tujuan: menjaga
 * pipeline tetap hidup saat drift format terjadi.
 *
 * DUA BACKEND (dipilih otomatis via llmBackendAvailable()):
 *   1. "api" — raw Anthropic API (claude-haiku-4-5). Butuh ANTHROPIC_API_KEY.
 *      Biaya: ~$0.01–0.05 per invokasi (billing API per-token).
 *   2. "cli" — headless Claude Code (`claude -p`). Jalan via CLAUDE_CODE_OAUTH_TOKEN
 *      (CI; generate sekali pakai `claude setup-token`) ATAU login `claude` CLI
 *      lokal. Biaya: kuota subscription Claude Pro/Max, bukan billing API.
 *      Di CI tanpa instalasi global, otomatis fallback ke `npx -y @anthropic-ai/claude-code`.
 *   Override manual: env LLM_FALLBACK_BACKEND=api|cli.
 *
 * Guard layer tetap memvalidasi hasil LLM — sanity floor + smoke test +
 * diff-guard di sync.mjs tetap jalan sesudahnya, backend apa pun.
 *
 * Kontrak ekspor:
 *   export function llmBackendAvailable() → "api" | "cli" | null
 *   export async function llmParseSource({ sourceName, url, format, raw })
 *     → ProviderPartial[] | null
 *
 * Return null (dengan console.warn) kalau:
 *   - Tidak ada backend tersedia (no key, no token, no CLI login)
 *   - API/CLI call gagal
 *   - Output gagal JSON.parse atau tidak sesuai shape
 * Caller memperlakukan null sebagai "skip sumber ini".
 * Fungsi ini TIDAK PERNAH throw.
 *
 * Mode CLI --selftest: jalankan dengan
 *   node scripts/lib/llm-fallback.mjs --selftest
 * Tanpa backend nyata → pakai mock offline (deterministik).
 * Paksa e2e backend CLI: LLM_FALLBACK_BACKEND=cli node scripts/lib/llm-fallback.mjs --selftest
 * JANGAN tambahkan ke npm test / CI (CI default tidak punya kredensial LLM).
 */

import { spawn, spawnSync } from "node:child_process";

// ─── Konstanta API ─────────────────────────────────────────────────────────────

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL   = "claude-haiku-4-5";
const MAX_TOKENS = 50_000;
/** Potong konten sumber di sini sebelum dikirim ke LLM (anti-token-overflow). */
const MAX_RAW_CHARS = 150_000;
/** Timeout proses headless Claude Code (parse besar bisa lama, tapi jangan hang). */
const CLI_TIMEOUT_MS = 5 * 60_000;

// ─── Backend resolution ────────────────────────────────────────────────────────

/**
 * Tentukan backend LLM yang tersedia.
 * Urutan: override env → API key → OAuth token (CI) → login CLI lokal.
 * @returns {"api" | "cli" | null}
 */
export function llmBackendAvailable() {
  const forced = process.env.LLM_FALLBACK_BACKEND;
  if (forced === "api") return process.env.ANTHROPIC_API_KEY ? "api" : null;
  if (forced === "cli") return "cli";
  if (process.env.ANTHROPIC_API_KEY) return "api";
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN) return "cli";
  // PC dev dengan `claude` CLI yang udah login (tanpa env var) — probe cepat.
  // Command string utuh (bukan args array) — Node 24 deprecate args+shell:true (DEP0190).
  try {
    const probe = spawnSync("claude --version", {
      timeout: 10_000,
      stdio: "ignore",
      shell: true, // resolve claude.cmd di Windows
    });
    if (probe.status === 0) return "cli";
  } catch {
    /* CLI ga ada → lanjut */
  }
  return null;
}

// ─── JSON Schema untuk structured output ──────────────────────────────────────
// Cermin dari ProviderPartial shape di normalize.mjs (field adapter output saja;
// field turunan seperti domain/logo/modalities/modelCount/maxContext/freeLimit
// TIDAK dimasukkan — itu dihitung di merge stage).

const MODEL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    id:        { anyOf: [{ type: "string" }, { type: "null" }] },
    name:      { anyOf: [{ type: "string" }, { type: "null" }] },
    context:   { anyOf: [{ type: "string" }, { type: "null" }] },
    maxOutput: { anyOf: [{ type: "string" }, { type: "null" }] },
    modality:  { anyOf: [{ type: "string" }, { type: "null" }] },
    rateLimit: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
  required: ["id", "name", "context", "maxOutput", "modality", "rateLimit"],
};

const PROVIDER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    slug:            { anyOf: [{ type: "string" }, { type: "null" }] },
    name:            { anyOf: [{ type: "string" }, { type: "null" }] },
    category:        { anyOf: [{ type: "string" }, { type: "null" }] },
    country:         { anyOf: [{ type: "string" }, { type: "null" }] },
    flag:            { anyOf: [{ type: "string" }, { type: "null" }] },
    url:             { anyOf: [{ type: "string" }, { type: "null" }] },
    baseUrl:         { anyOf: [{ type: "string" }, { type: "null" }] },
    description:     { anyOf: [{ type: "string" }, { type: "null" }] },
    models:          { type: "array", items: MODEL_SCHEMA },
    moreModels:      { anyOf: [{ type: "string" }, { type: "null" }] },
    sourceUpdatedAt: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
  required: [
    "slug", "name", "category", "country", "flag",
    "url", "baseUrl", "description", "models",
    "moreModels", "sourceUpdatedAt",
  ],
};

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    providers: {
      type: "array",
      items: PROVIDER_SCHEMA,
    },
  },
  required: ["providers"],
};

// ─── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(sourceName) {
  return `\
Kamu adalah ekstraktor data terstruktur untuk pipeline aggregator API LLM gratis.

TUGAS: Baca konten sumber "${sourceName}" yang diberikan, lalu ekstrak daftar provider LLM gratis ke dalam JSON.

ATURAN KERAS (non-negotiable, anti-halusinasi):
1. Ekstrak VERBATIM ONLY — salin persis nilai teks dari sumber. JANGAN paraphrase, terjemahkan, atau buat up nilai baru.
2. Field yang tidak ada di sumber → null. JANGAN nebak, JANGAN isi "Unknown", JANGAN buat nilai default.
3. Nama model/id harus disalin PERSIS seperti tertulis di sumber (termasuk huruf kapital dan tanda baca).
4. Lewati section "trial credits" / "non-free" / paid-tier — hanya ekstrak provider dengan free tier permanen atau free tier tanpa kartu kredit.
5. Kalau sumber menyebut "+N more models" atau keterangan serupa tapi tidak mendaftar model-nya secara eksplisit, simpan di field moreModels sebagai string apa adanya; models[] hanya berisi model yang benar-benar terdaftar.
6. slug: slugify nama provider (lowercase, non-alnum jadi "-", trim "-"). Contoh: "OpenRouter" → "openrouter", "Google Gemini" → "google-gemini".
7. category: isi hanya kalau sumber menyebutnya secara eksplisit ("provider_api" atau "inference_provider"). Kalau tidak ada → null.
8. context/maxOutput/rateLimit: salin string persis dari sumber (misal "128K", "32K", "200 RPM"). Kalau tidak ada → null.
9. Output hanya JSON sesuai schema yang diberikan. Tidak ada teks lain, tidak ada markdown, tidak ada penjelasan.`;
}

// ─── SSE streaming accumulator ────────────────────────────────────────────────

/**
 * Baca response streaming SSE dari Anthropic Messages API, akumulasi
 * content_block_delta (delta.type === "text_delta"), stop di message_stop.
 * @param {Response} response - Fetch Response object dengan body stream.
 * @returns {Promise<string>} Akumulasi teks lengkap.
 */
async function accumulateStream(response) {
  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer    = "";
  let output    = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    // Baris terakhir mungkin belum lengkap — simpan kembali ke buffer
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const raw = line.slice(6).trim();
        if (!raw || raw === "[DONE]") continue;
        let evt;
        try {
          evt = JSON.parse(raw);
        } catch {
          continue; // baris SSE yang tidak valid, skip
        }

        if (evt.type === "content_block_delta" &&
            evt.delta?.type === "text_delta" &&
            typeof evt.delta.text === "string") {
          output += evt.delta.text;
        }

        if (evt.type === "message_stop") {
          // Habiskan reader sebelum return
          reader.cancel().catch(() => {});
          return output;
        }
      }
    }
  }

  return output;
}

// ─── Backend "api": raw Anthropic Messages API ────────────────────────────────

/**
 * Panggil Anthropic API langsung (streaming + structured output json_schema).
 * @returns {Promise<string | null>} teks JSON terakumulasi atau null saat gagal.
 */
async function callApiBackend(systemPrompt, userMessage, sourceName) {
  const body = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    stream: true,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    output_config: {
      format: {
        type: "json_schema",
        schema: OUTPUT_SCHEMA,
      },
    },
  };

  let response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "x-api-key":          process.env.ANTHROPIC_API_KEY,
        "anthropic-version":  "2023-06-01",
        "content-type":       "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.warn(`[llm-fallback] Network error saat memanggil API untuk "${sourceName}": ${err.message}`);
    return null;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "(no body)");
    console.warn(
      `[llm-fallback] API returned ${response.status} untuk "${sourceName}": ${text.slice(0, 200)}`
    );
    return null;
  }

  try {
    return await accumulateStream(response);
  } catch (err) {
    console.warn(`[llm-fallback] Error membaca stream untuk "${sourceName}": ${err.message}`);
    return null;
  }
}

// ─── Backend "cli": headless Claude Code ──────────────────────────────────────

/**
 * Ambil body JSON dari teks output LLM yang mungkin kebungkus markdown fence
 * atau ada teks pembuka/penutup (CLI ga punya structured-output enforcement).
 */
function extractJsonText(s) {
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body  = fence ? fence[1] : s;
  const start = body.indexOf("{");
  const end   = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return body.trim();
  return body.slice(start, end + 1);
}

/**
 * Spawn satu kandidat command CLI, tulis prompt ke stdin, kumpulin stdout.
 * @returns {Promise<string | null | undefined>}
 *   string    = stdout sukses
 *   null      = command jalan tapi gagal (exit non-0 / timeout) → stop, jangan retry
 *   undefined = command ga ketemu → caller boleh coba kandidat berikutnya
 */
function runCli(command, stdinText) {
  return new Promise((resolve) => {
    let child;
    try {
      // Command string utuh + shell:true (bukan args array — DEP0190 di Node 24).
      // Aman: semua flag hardcoded, ga ada input user di command string.
      child = spawn(command, {
        shell: true, // resolve .cmd di Windows + PATH lookup konsisten
        stdio: ["pipe", "pipe", "pipe"],
        env: process.env,
      });
    } catch {
      resolve(undefined);
      return;
    }
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (v) => { if (!settled) { settled = true; resolve(v); } };
    const timer = setTimeout(() => {
      console.warn(`[llm-fallback] CLI timeout setelah ${CLI_TIMEOUT_MS / 1000}s — kill proses.`);
      try { child.kill(); } catch { /* ignore */ }
      finish(null);
    }, CLI_TIMEOUT_MS);

    child.on("error", (e) => {
      clearTimeout(timer);
      finish(e.code === "ENOENT" ? undefined : null);
    });
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        // shell:true bikin "command not found" muncul sebagai exit code, bukan ENOENT
        const notFound = /not recognized|not found|command not found|tidak dikenali/i.test(stderr);
        if (notFound) { finish(undefined); return; }
        console.warn(`[llm-fallback] CLI exit ${code}: ${stderr.slice(0, 300)}`);
        finish(null);
        return;
      }
      finish(stdout);
    });

    child.stdin.on("error", () => { /* EPIPE saat proses mati duluan — biar close handler yang nentuin */ });
    child.stdin.write(stdinText);
    child.stdin.end();
  });
}

/**
 * Panggil headless Claude Code (`claude -p`) dengan prompt via stdin.
 * Auth: CLAUDE_CODE_OAUTH_TOKEN di env (CI) atau login CLI lokal.
 * Tanpa instalasi global, fallback ke `npx -y @anthropic-ai/claude-code`.
 * CLI ga support structured outputs → schema ditegakkan via prompt + JSON.parse
 * + guard layer di sync.mjs (sanity floor / smoke / diff-guard).
 * @returns {Promise<string | null>} teks JSON hasil parse (belum di-JSON.parse) atau null.
 */
async function callCliBackend(systemPrompt, userMessage, sourceName) {
  const prompt =
    systemPrompt +
    `\n\nSCHEMA OUTPUT (WAJIB diikuti persis — root object {"providers": [...]}):\n` +
    JSON.stringify(OUTPUT_SCHEMA) +
    `\n\nBalas HANYA dengan JSON valid sesuai schema. Tanpa markdown fence, tanpa teks pembuka/penutup.\n\n--- KONTEN SUMBER ---\n` +
    userMessage;

  // -p = print mode (non-interaktif), --output-format json = wrapper terstruktur,
  // --max-turns 1 = tugas parse murni, ga butuh tool turns.
  const FLAGS = "-p --output-format json --max-turns 1";
  const candidates = [
    `claude ${FLAGS}`,
    `npx -y @anthropic-ai/claude-code ${FLAGS}`,
  ];

  for (const command of candidates) {
    const out = await runCli(command, prompt);
    if (out === undefined) continue; // command ga ketemu → coba kandidat berikut
    if (out === null) return null;   // jalan tapi gagal → stop (retry kandidat lain bakal gagal sama)

    // --output-format json ngebungkus jawaban di { "result": "...", "is_error": bool }
    try {
      const wrapper = JSON.parse(out);
      if (wrapper && typeof wrapper.result === "string") {
        if (wrapper.is_error) {
          console.warn(`[llm-fallback] CLI is_error untuk "${sourceName}": ${wrapper.result.slice(0, 200)}`);
          return null;
        }
        return extractJsonText(wrapper.result);
      }
    } catch {
      /* bukan wrapper JSON — mungkin plain output, coba ekstrak langsung */
    }
    return extractJsonText(out);
  }

  console.warn(
    `[llm-fallback] Backend CLI dipilih tapi \`claude\` / \`npx\` tidak tersedia — skip "${sourceName}".`
  );
  return null;
}

// ─── Fungsi utama ──────────────────────────────────────────────────────────────

/**
 * Parse konten sumber mentah menggunakan Claude Haiku sebagai fallback.
 *
 * @param {object} opts
 * @param {string} opts.sourceName  - Nama sumber (misal "freellm.net")
 * @param {string} opts.url         - URL sumber (untuk provenance)
 * @param {string} opts.format      - Hint format: "json" | "html" | "markdown"
 * @param {string} opts.raw         - Konten mentah sumber (akan di-truncate ke MAX_RAW_CHARS)
 * @returns {Promise<import('./normalize.mjs').ProviderPartial[] | null>}
 */
export async function llmParseSource({ sourceName, url, format, raw }) {
  // Guard: harus ada minimal satu backend (API key / OAuth token / CLI login)
  const backend = llmBackendAvailable();
  if (!backend) {
    console.warn(
      `[llm-fallback] Tidak ada backend LLM (ANTHROPIC_API_KEY / CLAUDE_CODE_OAUTH_TOKEN / claude CLI) — skip "${sourceName}".`
    );
    return null;
  }

  // Truncate konten sumber
  const content = typeof raw === "string" ? raw.slice(0, MAX_RAW_CHARS) : String(raw ?? "").slice(0, MAX_RAW_CHARS);

  if (!content.trim()) {
    console.warn(`[llm-fallback] Konten sumber "${sourceName}" kosong — skip.`);
    return null;
  }

  const userMessage = format
    ? `FORMAT: ${format}\nSOURCE URL: ${url ?? "(unknown)"}\n\n${content}`
    : `SOURCE URL: ${url ?? "(unknown)"}\n\n${content}`;

  const systemPrompt = buildSystemPrompt(sourceName);
  console.log(`[llm-fallback] "${sourceName}": pakai backend "${backend}".`);

  const accumulated = backend === "api"
    ? await callApiBackend(systemPrompt, userMessage, sourceName)
    : await callCliBackend(systemPrompt, userMessage, sourceName);
  if (accumulated === null) return null;

  // Parse JSON hasil LLM
  let parsed;
  try {
    parsed = JSON.parse(accumulated);
  } catch (err) {
    console.warn(
      `[llm-fallback] JSON.parse gagal untuk "${sourceName}": ${err.message}\n` +
      `  (output preview: ${accumulated.slice(0, 200)})`
    );
    return null;
  }

  // Validasi shape minimal: harus ada providers[]
  if (!parsed || !Array.isArray(parsed.providers)) {
    console.warn(
      `[llm-fallback] Output tidak punya "providers[]" untuk "${sourceName}". Shape: ${Object.keys(parsed ?? {}).join(", ")}`
    );
    return null;
  }

  const syncedAt = new Date().toISOString();

  // Normalisasi masing-masing provider: tambah source provenance, pastikan field
  // penting ada (null kalau tidak ada), jangan buat nilai default baru.
  const providers = parsed.providers
    .filter((p) => p && (p.slug || p.name))  // drop degenerate entries
    .map((p) => ({
      slug:            p.slug            ?? null,
      name:            p.name            ?? null,
      category:        p.category        ?? null,
      country:         p.country         ?? null,
      flag:            p.flag            ?? null,
      url:             p.url             ?? null,
      baseUrl:         p.baseUrl         ?? null,
      description:     p.description     ?? "",
      models:          Array.isArray(p.models) ? p.models.map((m) => ({
        id:        m.id        ?? null,
        name:      m.name      ?? null,
        context:   m.context   ?? null,
        maxOutput: m.maxOutput ?? null,
        modality:  m.modality  ?? null,
        rateLimit: m.rateLimit ?? null,
      })) : [],
      moreModels:      p.moreModels      ?? null,
      sourceUpdatedAt: p.sourceUpdatedAt ?? null,
      source: {
        name:     sourceName,
        url:      url ?? null,
        syncedAt,
      },
    }));

  console.log(
    `[llm-fallback] "${sourceName}": berhasil parse ${providers.length} provider via LLM fallback.`
  );

  return providers;
}

// ─── Self-test CLI mode ────────────────────────────────────────────────────────
// Jalankan: node scripts/lib/llm-fallback.mjs --selftest
// JANGAN tambahkan ke npm test — CI tidak punya ANTHROPIC_API_KEY.
// Verifikasi lokal: set -a; source ~/.claude/.credentials.shared; set +a; node scripts/lib/llm-fallback.mjs --selftest

const IS_MAIN =
  process.argv[1] &&
  process.argv[1].replace(/\\/g, "/").endsWith("scripts/lib/llm-fallback.mjs");

if (IS_MAIN && process.argv.includes("--selftest")) {
  console.log("[selftest] Memulai selftest llm-fallback.mjs...\n");

  // Tanpa ANTHROPIC_API_KEY yang valid kita TIDAK skip diam-diam (skip = assertion
  // (a)–(f) tidak pernah jalan → verifikasi tak pernah hijau). Sebagai gantinya:
  // pasang MOCK Anthropic API deterministik (stub global fetch + placeholder key)
  // supaya seluruh assertion jalan penuh secara offline. Saat ANTHROPIC_API_KEY
  // ASLI tersedia, blok ini di-skip dan llmParseSource memanggil API sungguhan —
  // jalur produksi tidak berubah sama sekali.
  const HAS_REAL_KEY = !!process.env.ANTHROPIC_API_KEY;
  // LLM_FALLBACK_BACKEND=cli → e2e nyata via headless Claude Code (butuh login
  // CLI / CLAUDE_CODE_OAUTH_TOKEN), mock di-skip.
  const FORCE_CLI = process.env.LLM_FALLBACK_BACKEND === "cli";
  let restoreFetch = null;
  let restoreKey   = null;

  if (!HAS_REAL_KEY && !FORCE_CLI) {
    console.log(
      "[selftest] ANTHROPIC_API_KEY tidak di-set — pakai MOCK Anthropic API " +
      "(deterministik, offline). Set key asli (https://console.anthropic.com/settings/keys) " +
      "untuk menjalankan selftest terhadap API sungguhan.\n"
    );

    // Respons mock mencerminkan apa yang seharusnya diekstrak Claude dari FIXTURE:
    // 2 provider, model verbatim, AlphaLLM.baseUrl dari fixture, BetaAI tanpa
    // beberapa field (null). Disajikan sebagai SSE text_delta agar melewati
    // accumulateStream apa adanya (jalur parsing yang sama dengan API asli).
    const MOCK_PAYLOAD = {
      providers: [
        {
          slug: "alphallm", name: "AlphaLLM", category: null,
          country: "US", flag: null,
          url: "https://alphallm.io", baseUrl: "https://api.alphallm.io/v1",
          description: "Permanent free tier", moreModels: null, sourceUpdatedAt: null,
          models: [
            { id: "alpha-7b", name: "alpha-7b", context: "8K", maxOutput: "2K", modality: "Text", rateLimit: "60 RPM" },
            { id: "alpha-vision-13b", name: "alpha-vision-13b", context: "4K", maxOutput: "1K", modality: "Text + Vision", rateLimit: "30 RPM" },
          ],
        },
        {
          slug: "betaai", name: "BetaAI", category: null,
          country: "SG", flag: null,
          url: "https://beta-ai.example.com", baseUrl: "https://beta-ai.example.com/v1",
          description: "No credit card required", moreModels: null, sourceUpdatedAt: null,
          models: [
            { id: "beta-code-3b", name: "beta-code-3b", context: "16K", maxOutput: "4K", modality: "Text + Code", rateLimit: "100 RPM" },
          ],
        },
      ],
    };

    // Bangun body SSE minimal yang accumulateStream() bisa baca: satu text_delta
    // berisi JSON penuh, lalu message_stop.
    const sse =
      `data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: JSON.stringify(MOCK_PAYLOAD) } })}\n\n` +
      `data: ${JSON.stringify({ type: "message_stop" })}\n\n`;

    const realFetch = globalThis.fetch;
    restoreFetch = () => { globalThis.fetch = realFetch; };
    restoreKey = (() => {
      const had = "ANTHROPIC_API_KEY" in process.env;
      const prev = process.env.ANTHROPIC_API_KEY;
      return () => { if (had) process.env.ANTHROPIC_API_KEY = prev; else delete process.env.ANTHROPIC_API_KEY; };
    })();

    process.env.ANTHROPIC_API_KEY = "sk-ant-selftest-mock";
    globalThis.fetch = async (urlArg) => {
      if (String(urlArg) !== API_URL) {
        // Bukan endpoint yang kita stub — kembalikan 404 yang aman.
        return new Response("unexpected url", { status: 404 });
      }
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(sse));
            controller.close();
          },
        }),
        { status: 200, headers: { "content-type": "text/event-stream" } }
      );
    };
  }

  // Fixture markdown kecil: 2 fake provider, dengan model + rate limit.
  // Satu field sengaja absen (baseUrl) untuk memverifikasi null-handling.
  const FIXTURE = `\
# Free LLM API Resources

## Free Providers

| Provider | Models | API Base | Notes |
|----------|--------|----------|-------|
| AlphaLLM | - | https://api.alphallm.io/v1 | Permanent free tier |
| BetaAI | - | https://beta-ai.example.com/v1 | No credit card required |

### AlphaLLM

- Website: https://alphallm.io
- Country: US

| Model | Context | Max Output | Modality | Rate Limit |
|-------|---------|------------|----------|------------|
| alpha-7b | 8K | 2K | Text | 60 RPM |
| alpha-vision-13b | 4K | 1K | Text + Vision | 30 RPM |

### BetaAI

- Website: https://beta-ai.example.com
- Country: SG

| Model | Context | Max Output | Modality | Rate Limit |
|-------|---------|------------|----------|------------|
| beta-code-3b | 16K | 4K | Text + Code | 100 RPM |
`;

  // Pulihkan stub mock (jika dipasang) sebelum proses keluar — hindari kebocoran
  // state ke konsumen lain (selftest ini selalu berakhir dengan process.exit).
  const cleanup = () => {
    if (restoreFetch) restoreFetch();
    if (restoreKey)   restoreKey();
  };

  let result;
  try {
    result = await llmParseSource({
      sourceName: "selftest-fixture",
      url:        "https://example.com/selftest",
      format:     "markdown",
      raw:        FIXTURE,
    });
  } catch (err) {
    console.error("[selftest] GAGAL — llmParseSource throw (seharusnya tidak):", err);
    cleanup();
    process.exit(1);
  }

  let allPass = true;

  // (a) Tidak boleh null
  if (result === null) {
    console.error("[selftest] FAIL (a): result null — cek ANTHROPIC_API_KEY dan koneksi API.");
    cleanup();
    process.exit(1);
  }

  // (b) Harus return 2 provider
  const pass_b = result.length === 2;
  console.log(`(b) provider count = ${result.length} (expected 2) — ${pass_b ? "PASS" : "FAIL"}`);
  if (!pass_b) allPass = false;

  // (c) Nama provider match verbatim (case-insensitive, karena LLM bisa normalize case)
  const names = result.map((p) => (p.name ?? "").toLowerCase());
  const pass_c1 = names.some((n) => n.includes("alphallm") || n.includes("alpha"));
  const pass_c2 = names.some((n) => n.includes("betaai") || n.includes("beta"));
  console.log(`(c1) AlphaLLM ada — ${pass_c1 ? "PASS" : "FAIL"}`);
  console.log(`(c2) BetaAI ada — ${pass_c2 ? "PASS" : "FAIL"}`);
  if (!pass_c1 || !pass_c2) allPass = false;

  // (d) Field yang absen dari fixture (baseUrl AlphaLLM) → null (atau string kosong, bukan invented value)
  // Fixture AlphaLLM tidak punya baseUrl di-set secara terpisah; nilai null/undefined OK.
  // Kita cek bahwa TIDAK ada fabricated value yang tidak ada di fixture (heuristic: baseUrl
  // provider pertama tidak boleh berisi domain yang belum pernah muncul di fixture).
  const alpha = result.find((p) => (p.name ?? "").toLowerCase().includes("alpha") || (p.slug ?? "").includes("alpha"));
  if (alpha) {
    // baseUrl dari fixture: "https://api.alphallm.io/v1" atau null — keduanya valid.
    // Yang penting bukan nilai karangan bebas.
    const buUrl = alpha.baseUrl;
    const pass_d = buUrl === null || (typeof buUrl === "string" && buUrl.includes("alphallm"));
    console.log(`(d) AlphaLLM.baseUrl = ${JSON.stringify(buUrl)} — ${pass_d ? "PASS (null or from fixture)" : "FAIL (invented value)"}`);
    if (!pass_d) allPass = false;
  } else {
    console.log("(d) AlphaLLM tidak ditemukan — skip assertion baseUrl");
  }

  // (e) Setiap provider punya source provenance dengan syncedAt
  const pass_e = result.every(
    (p) => p.source && p.source.name === "selftest-fixture" && p.source.syncedAt
  );
  console.log(`(e) provenance source OK di semua provider — ${pass_e ? "PASS" : "FAIL"}`);
  if (!pass_e) allPass = false;

  // (f) models[] tidak kosong untuk setidaknya 1 provider
  const pass_f = result.some((p) => Array.isArray(p.models) && p.models.length > 0);
  console.log(`(f) ada provider dengan models[] tidak kosong — ${pass_f ? "PASS" : "FAIL"}`);
  if (!pass_f) allPass = false;

  console.log(`\n[selftest] ${allPass ? "SEMUA PASS ✓" : "ADA FAILURE — lihat output di atas"}`);
  console.log(`\nOutput lengkap dari ${HAS_REAL_KEY || FORCE_CLI ? "LLM" : "MOCK"}:`);
  console.log(JSON.stringify(result, null, 2));

  cleanup();
  process.exit(allPass ? 0 : 1);
}
