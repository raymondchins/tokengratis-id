/**
 * Shape guard — tokengratis.id pipeline.
 *
 * Problem this exists to solve (INCIDENT 2026-07-25, lihat komentar di
 * scripts/adapters/freellm.mjs dan docs/log.md): freellm.net nyisipin kolom
 * "Score" di indeks 2 dan buang kolom "Max Output". Jumlah kolom TETAP sama
 * (9), jumlah baris TETAP normal — cuma ARTI tiap kolom yang berubah.
 * Akibatnya:
 *
 *   - scripts/lib/source-sanity.mjs (floor berbasis COUNT provider/model) → LOLOS
 *   - scripts/lib/diff-guard.mjs   (floor berbasis COUNT/churn snapshot)  → LOLOS
 *   - smoke test pipeline                                                 → LOLOS
 *
 * `context` diam-diam keisi nilai Score (81, 45, 47, 49, 71, 40, …). 216 dari
 * 398 model kena. Ketahuan CUMA karena ada manusia yang ngeliat "context=81"
 * di output CLI — bukan karena ada guard yang nangkep.
 *
 * PELAJARAN: semua guard yang ada ngukur KUANTITAS (jumlah baris/kolom/churn).
 * Kolom ketuker mengubah MAKNA sambil kuantitas tetap identik. Modul ini
 * ngukur BENTUK (shape) nilai tiap field — itu axis yang hilang.
 *
 * Desain: rule berbasis RATIO, bukan per-baris. Satu model aneh = noise
 * (rate-limit "Preview limits" yang ga umum, satu context null, dst) —
 * WAJAR di data komunitas. Pola SISTEMIK (>50% dari sample besar) = bug.
 * Threshold: FATAL_RATIO=0.5 dengan MIN_SAMPLE=20 — di bawah sample size itu
 * satu-dua baris aneh cuma jadi `warn`, ga pernah `fatal`. Ini sengaja supaya
 * sync semalam ga berhenti gara-gara satu provider komunitas yang datanya
 * emang berantakan.
 *
 * Exports:
 *   checkShape(providers, opts)  → { ok, issues, stats }   — TIDAK PERNAH throw
 *   assertShape(providers, opts) → void                     — throw ShapeGuardError kalau ada fatal
 *   looksLikeContext(value)      → boolean  (predikat reusable per-nilai)
 *   looksLikeRateLimit(value)    → boolean  (predikat reusable per-nilai)
 *   class ShapeGuardError extends Error     — .issues = ShapeIssue[]
 *
 * @typedef {{severity:"fatal"|"warn", source:string, field:string, rule:string,
 *            count:number, total:number, ratio:number, samples:string[],
 *            message:string}} ShapeIssue
 *
 * KONTRAK INPUT: array ProviderPartial (shape adapter, lihat normalize.mjs)
 * ATAU Provider yang sudah di-merge (data/providers.json) — keduanya punya
 * `models[]` dengan { id, name, context, maxOutput, modality, rateLimit } dan
 * provider punya { name, url, baseUrl, description }, jadi modul ini jalan
 * di kedua tahap tanpa modifikasi.
 */

import { facetsOf, safeUrl } from "./normalize.mjs";

// ─── Threshold ratio-based (lihat penjelasan desain di atas) ──────────────────

const FATAL_RATIO = 0.5;
const MIN_SAMPLE = 20;

// ─── Error class ────────────────────────────────────────────────────────────

export class ShapeGuardError extends Error {
  /** @param {import('./shape-guard.mjs').ShapeIssue[]} issues */
  constructor(issues) {
    const fatal = issues.filter((i) => i.severity === "fatal");
    super(
      `ShapeGuardError: ${fatal.length} isu fatal — ` +
        fatal.map((i) => i.message).join(" || "),
    );
    this.name = "ShapeGuardError";
    this.issues = issues;
  }
}

// ─── Helper: bikin ShapeIssue + tentuin severity dari ratio ───────────────────

function makeIssue({ severity, source, field, rule, count, total, samples, message }) {
  return {
    severity,
    source,
    field,
    rule,
    count,
    total,
    ratio: total ? count / total : 0,
    samples: samples.slice(0, 3).map((s) => String(s)),
    message,
  };
}

/**
 * Tentuin severity dari count/total. `null` kalau count=0 (ga ada issue sama
 * sekali — caller skip). "fatal" cuma kalau ratio > FATAL_RATIO DAN sample
 * cukup besar (MIN_SAMPLE) — pola sistemik. Selain itu "warn" (isolated).
 */
function ratioSeverity(count, total) {
  if (count <= 0) return null;
  if (total >= MIN_SAMPLE && count / total > FATAL_RATIO) return "fatal";
  return "warn";
}

// ─── Predikat reusable (diekspor — adapter boleh pakai per-nilai) ─────────────

/**
 * Apakah string ini KELIHATAN seperti context/maxOutput window window token
 * yang valid? Contoh real dari data/providers.json: "128K", "1M", "8192",
 * "32k", "128K (8K on free)", "Up to 10M", "~4K", "Varies", "Model-dependent",
 * "Configurable", "Shared w/ context".
 *
 * SENGAJA menolak bilangan bulat telanjang < 1000 — itu PERSIS signature
 * INCIDENT 2026-07-25 (kolom Score: 81, 45, 47, 49, 71, 40, …). Context
 * window model LLM real ga pernah realistis di bawah ribuan token.
 */
export function looksLikeContext(value) {
  if (value == null) return false;
  const raw = String(value).trim();
  if (!raw) return false;

  // Nilai deskriptif non-numerik yang memang legit di data real (freellm
  // maxOutput sering "Varies"/"Model-dependent"/"Shared w/ context" dst
  // ketika provider ga publish angka fixed — bukan parse error).
  if (/^(varies|model-dependent|unlimited|configurable)$/i.test(raw)) return true;
  if (/^shared\s*w\/?\s*context$/i.test(raw)) return true;

  // Buang qualifier depan ("Up to "/"~") dan catatan parenthetical di
  // belakang ("128K (8K on free)" → "128K") — kosmetik doang, ga ngubah cek.
  let core = raw.replace(/^(up\s+to|~)\s*/i, "").trim();
  const parenIdx = core.indexOf("(");
  if (parenIdx !== -1) core = core.slice(0, parenIdx).trim();
  core = core.replace(/^~\s*/, "").trim();
  if (!core) return false;

  // Bentuk unit K/M/B: "128K", "1M", "8.5B", "32k".
  if (/^\d+(\.\d+)?\s*[KMB]$/i.test(core)) return true;

  // Bilangan bulat telanjang: cuma plausible sebagai token count kalau >= 1000.
  // < 1000 = signature Score/percentage/rating, BUKAN context window.
  if (/^\d+$/.test(core)) return Number(core) >= 1000;

  return false;
}

/**
 * Apakah string ini KELIHATAN seperti rate limit yang valid? Contoh real:
 * "30 RPM", "15 RPM, 20K TPD", "10,000 neurons/day", "Unlimited for free
 * models", "Community-powered, no hard cap", "Preview limits", "Dependent on
 * Copilot subscription tier (...)".
 *
 * Dipakai buat rule 2 (column-swap cross-check) — kalau `context` KELIHATAN
 * kayak rate limit (bukan context), itu sinyal dua kolom ketuker.
 */
export function looksLikeRateLimit(value) {
  if (value == null) return false;
  const s = String(value).trim();
  if (!s) return false;

  // Frasa deskriptif yang legit sebagai rate limit di data real.
  if (
    /unlimited|community-powered|credit-metered|preview limits|dependent on|no hard cap|session\/weekly|see\s+provider\s+page/i.test(
      s,
    )
  )
    return true;

  // Token numerik rate-limit baku: "30 RPM", "20K TPD", "500K TPM", dst.
  if (/\d[\d,.]*\s*[KMB]?\s*(RPM|RPD|RPS|TPM|TPD|TPS)\b/i.test(s)) return true;

  // "N requests/minute", "N tokens/day", "N calls", "N neurons/day".
  if (/\brequests?\b.*\/|\/\s*(minute|hour|day|month)\b/i.test(s)) return true;
  if (/\bcalls?\b/i.test(s)) return true;
  if (/\bneurons?\b/i.test(s)) return true;

  return false;
}

// ─── Rule engine ────────────────────────────────────────────────────────────

/**
 * Cek satu field model dengan satu predikat "bagus". Ratio-based: cuma push
 * issue kalau ada minimal 1 nilai yang gagal predikat.
 */
function checkFieldPredicate(models, field, predicate, source, rule, buildMessage) {
  const vals = models
    .map((m) => m[field])
    .filter((v) => v != null && String(v).trim() !== "");
  const total = vals.length;
  if (total === 0) return null;

  const bad = vals.filter((v) => !predicate(v));
  const severity = ratioSeverity(bad.length, total);
  if (!severity) return null;

  return makeIssue({
    severity,
    source,
    field,
    rule,
    count: bad.length,
    total,
    samples: bad,
    message: buildMessage(bad.length, total, bad, severity),
  });
}

function pct(count, total) {
  return total ? ((count / total) * 100).toFixed(0) : "0";
}

/**
 * Periksa array ProviderPartial (atau Provider yang sudah di-merge) dari
 * sebuah adapter/sumber. TIDAK PERNAH melempar — caller yang menentukan mau
 * apa dengan `issues` (assertShape() di bawah melempar kalau ada fatal).
 *
 * @param {any[]} providers
 * @param {{source?: string}} [opts]
 * @returns {{ok: boolean, issues: import('./shape-guard.mjs').ShapeIssue[], stats: object}}
 */
export function checkShape(providers, opts = {}) {
  const source = opts.source || "unknown";
  const issues = [];

  if (!Array.isArray(providers) || providers.length === 0) {
    return { ok: true, issues: [], stats: { providers: 0, models: 0 } };
  }

  const models = providers.flatMap((p) =>
    (p.models || []).map((m) => ({ ...m, _providerName: p.name || p.slug || "?" })),
  );

  const stats = {
    providers: providers.length,
    models: models.length,
    withContext: models.filter((m) => m.context != null).length,
    withMaxOutput: models.filter((m) => m.maxOutput != null).length,
    withRateLimit: models.filter((m) => m.rateLimit != null).length,
    withModality: models.filter((m) => m.modality != null && String(m.modality).trim() !== "").length,
  };

  // ── Rule 1: context shape ───────────────────────────────────────────────
  // Signature langsung INCIDENT 2026-07-25: Score column (81, 45, 47, 49, …)
  // kebaca sebagai context.
  {
    const issue = checkFieldPredicate(
      models,
      "context",
      looksLikeContext,
      source,
      "context-shape",
      (count, total, bad) =>
        `Field "context": ${count}/${total} (${pct(count, total)}%) nilai TIDAK berbentuk context ` +
        `window yang wajar (contoh valid: "128K", "1M", "8192"). Sample: ${bad.slice(0, 3).join(", ")}. ` +
        `Ini pola PERSIS INCIDENT 2026-07-25 (kolom "Score" freellm.net kebaca sebagai context — ` +
        `nilai 40-81 telanjang tanpa unit K/M). Cek mapping header kolom di adapter sumber "${source}" ` +
        `sebelum percaya angka ini.`,
    );
    if (issue) issues.push(issue);
  }

  // ── Rule 1 (lanjutan): maxOutput shape ──────────────────────────────────
  {
    const issue = checkFieldPredicate(
      models,
      "maxOutput",
      looksLikeContext,
      source,
      "maxoutput-shape",
      (count, total, bad) =>
        `Field "maxOutput": ${count}/${total} (${pct(count, total)}%) nilai TIDAK berbentuk token ` +
        `output yang wajar (contoh valid: "8K", "Varies", "Model-dependent"). Sample: ${bad.slice(0, 3).join(", ")}. ` +
        `Cek apakah kolom maxOutput di sumber "${source}" ketuker dengan kolom lain (currency/tanggal/` +
        `persentase/prosa bebas bukan bentuk maxOutput yang valid).`,
    );
    if (issue) issues.push(issue);
  }

  // ── Rule 2: column-swap cross-check ─────────────────────────────────────
  // Signature LANGSUNG dua kolom ketuker: context === rateLimit persis sama,
  // atau context kelihatan seperti rate limit (bukan context).
  {
    const pairs = models.filter((m) => m.context != null && m.rateLimit != null);
    const total = pairs.length;
    if (total > 0) {
      const same = pairs.filter(
        (m) => String(m.context).trim() !== "" && String(m.context).trim() === String(m.rateLimit).trim(),
      );
      const severity = ratioSeverity(same.length, total);
      if (severity) {
        issues.push(
          makeIssue({
            severity,
            source,
            field: "context/rateLimit",
            rule: "column-swap-identical",
            count: same.length,
            total,
            samples: same.map((m) => `${m.context}`),
            message:
              `${same.length}/${total} (${pct(same.length, total)}%) model punya context === rateLimit ` +
              `PERSIS sama string-nya — signature langsung dua kolom kebaca dari indeks yang sama/geser ` +
              `(lihat INCIDENT 2026-07-25). Cek urutan/index kolom di adapter sumber "${source}".`,
          }),
        );
      }
    }

    const ctxVals = models.filter((m) => m.context != null && String(m.context).trim() !== "");
    if (ctxVals.length > 0) {
      const bad = ctxVals.filter(
        (m) => looksLikeRateLimit(m.context) && !looksLikeContext(m.context),
      );
      const severity = ratioSeverity(bad.length, ctxVals.length);
      if (severity) {
        issues.push(
          makeIssue({
            severity,
            source,
            field: "context",
            rule: "column-swap-context-looks-like-ratelimit",
            count: bad.length,
            total: ctxVals.length,
            samples: bad.map((m) => String(m.context)),
            message:
              `${bad.length}/${ctxVals.length} (${pct(bad.length, ctxVals.length)}%) nilai "context" ` +
              `justru BERBENTUK rate limit (mengandung RPM/RPD/requests-per-…), bukan context window. ` +
              `Sample: ${bad.slice(0, 3).map((m) => m.context).join(", ")}. Kolom context dan rateLimit ` +
              `kemungkinan ketuker di sumber "${source}" — cek mapping header (lihat INCIDENT 2026-07-25).`,
          }),
        );
      }
    }
  }

  // ── Rule 3: rateLimit shape ──────────────────────────────────────────────
  // rateLimit yang isinya CUMA token K/M/B telanjang (mis. "256K" doang, tanpa
  // RPM/hari/dst) berarti kolom rate-limit sebenarnya adalah kolom context.
  {
    const vals = models
      .map((m) => m.rateLimit)
      .filter((v) => v != null && String(v).trim() !== "");
    const total = vals.length;
    if (total > 0) {
      const bad = vals.filter((v) => /^\d+(\.\d+)?\s*[KMB]$/i.test(String(v).trim()));
      const severity = ratioSeverity(bad.length, total);
      if (severity) {
        issues.push(
          makeIssue({
            severity,
            source,
            field: "rateLimit",
            rule: "ratelimit-is-bare-context-token",
            count: bad.length,
            total,
            samples: bad,
            message:
              `Field "rateLimit": ${bad.length}/${total} (${pct(bad.length, total)}%) nilai cuma token ` +
              `K/M/B telanjang (mis. "256K") tanpa satuan rate-limit (RPM/RPD/requests-per-…). Sample: ` +
              `${bad.slice(0, 3).join(", ")}. Ini pola kolom rate-limit sebenarnya kolom context yang ` +
              `ketuker — cek mapping header di sumber "${source}" (lihat INCIDENT 2026-07-25).`,
          }),
        );
      }
    }
  }

  // ── Rule 4: modality sanity ───────────────────────────────────────────────
  // Reuse facetsOf() dari normalize.mjs (dipakai juga oleh merge stage) —
  // kalau facetsOf() ga nemu token yang dikenal (text/vision/image/audio/
  // video/code/embed/rerank/reasoning/dst) sama sekali, string-nya bukan
  // modality yang valid.
  {
    const issue = checkFieldPredicate(
      models,
      "modality",
      (v) => facetsOf(v).length > 0,
      source,
      "modality-unrecognised",
      (count, total, bad) =>
        `Field "modality": ${count}/${total} (${pct(count, total)}%) nilai ga punya token modality yang ` +
        `dikenal (text/vision/image/audio/video/code/embedding/reranking/reasoning). Sample: ` +
        `${bad.slice(0, 3).join(", ")}. Kemungkinan kolom modality ketuker dengan kolom lain di sumber "${source}".`,
    );
    if (issue) issues.push(issue);
  }

  // ── Rule 5: leftover markup / entities ────────────────────────────────────
  // Kalau parser HTML/markdown regresi (lupa strip tag atau decode entity),
  // <tag> atau &amp;/&#39;/&nbsp; mentah bakal bocor ke name/id/description.
  {
    const hasMarkupOrEntity = (s) => {
      if (s == null) return false;
      const str = String(s);
      return (
        /<\/?[a-zA-Z!][^>]*>/.test(str) ||
        /&(amp|lt|gt|quot|#39|nbsp|#\d+|#x[0-9a-f]+);/i.test(str)
      );
    };

    const nameVals = [
      ...providers.map((p) => p.name),
      ...models.map((m) => m.name),
    ].filter((v) => v != null && String(v).trim() !== "");
    if (nameVals.length > 0) {
      const bad = nameVals.filter(hasMarkupOrEntity);
      const severity = ratioSeverity(bad.length, nameVals.length);
      if (severity) {
        issues.push(
          makeIssue({
            severity,
            source,
            field: "name",
            rule: "leftover-markup-entity",
            count: bad.length,
            total: nameVals.length,
            samples: bad,
            message:
              `${bad.length}/${nameVals.length} nilai "name" (provider/model) masih mengandung tag HTML ` +
              `mentah atau HTML entity yang belum di-decode (mis. "&amp;", "&#39;", "<span>"). Sample: ` +
              `${bad.slice(0, 3).join(", ")}. Parser HTML/markdown di sumber "${source}" kemungkinan regresi ` +
              `— cek pemanggilan textOf()/decodeEntities() (scripts/lib/normalize.mjs).`,
          }),
        );
      }
    }

    const idVals = models
      .map((m) => m.id)
      .filter((v) => v != null && String(v).trim() !== "");
    if (idVals.length > 0) {
      const bad = idVals.filter(hasMarkupOrEntity);
      const severity = ratioSeverity(bad.length, idVals.length);
      if (severity) {
        issues.push(
          makeIssue({
            severity,
            source,
            field: "id",
            rule: "leftover-markup-entity",
            count: bad.length,
            total: idVals.length,
            samples: bad,
            message:
              `${bad.length}/${idVals.length} nilai model "id" masih mengandung tag HTML mentah atau HTML ` +
              `entity. Sample: ${bad.slice(0, 3).join(", ")}. slugify()/textOf() kemungkinan ga jalan di ` +
              `sumber "${source}" — cek pipeline parsing.`,
          }),
        );
      }
    }

    const descVals = providers
      .map((p) => p.description)
      .filter((v) => v != null && String(v).trim() !== "");
    if (descVals.length > 0) {
      const bad = descVals.filter(hasMarkupOrEntity);
      const severity = ratioSeverity(bad.length, descVals.length);
      if (severity) {
        issues.push(
          makeIssue({
            severity,
            source,
            field: "description",
            rule: "leftover-markup-entity",
            count: bad.length,
            total: descVals.length,
            samples: bad,
            message:
              `${bad.length}/${descVals.length} nilai "description" masih mengandung tag HTML mentah atau ` +
              `HTML entity. Sample: ${bad.slice(0, 3).map((s) => s.slice(0, 60)).join(" | ")}. Parser di ` +
              `sumber "${source}" kemungkinan regresi — cek decodeEntities()/textOf().`,
          }),
        );
      }
    }
  }

  // ── Rule 6: id/name hygiene ────────────────────────────────────────────────
  {
    const emptyIdCount = models.filter((m) => m.id == null || String(m.id).trim() === "").length;
    const emptyIdSeverity = ratioSeverity(emptyIdCount, models.length);
    if (emptyIdSeverity) {
      issues.push(
        makeIssue({
          severity: emptyIdSeverity,
          source,
          field: "id",
          rule: "empty-id",
          count: emptyIdCount,
          total: models.length,
          samples: [],
          message:
            `${emptyIdCount}/${models.length} model punya "id" kosong/whitespace-only. Cek slugify(name) ` +
            `di adapter sumber "${source}" — kemungkinan model name-nya sendiri kosong/gagal parse.`,
        }),
      );
    }

    const emptyNameCount = models.filter((m) => m.name == null || String(m.name).trim() === "").length;
    const emptyNameSeverity = ratioSeverity(emptyNameCount, models.length);
    if (emptyNameSeverity) {
      issues.push(
        makeIssue({
          severity: emptyNameSeverity,
          source,
          field: "name",
          rule: "empty-name",
          count: emptyNameCount,
          total: models.length,
          samples: [],
          message:
            `${emptyNameCount}/${models.length} model punya "name" kosong/whitespace-only di sumber "${source}". ` +
            `Cek selector/regex yang narik nama model — kemungkinan cell/kolom yang ditarget udah pindah.`,
        }),
      );
    }

    // Duplicate id DALAM satu provider. SENGAJA selalu "warn" (never fatal) —
    // lihat catatan design-choice di bagian bawah file / laporan agent.
    let dupCount = 0;
    let dupTotal = 0;
    const dupSamples = [];
    for (const p of providers) {
      const ms = p.models || [];
      dupTotal += ms.length;
      const seen = new Set();
      for (const m of ms) {
        if (m.id == null) continue;
        if (seen.has(m.id)) {
          dupCount++;
          if (dupSamples.length < 3) dupSamples.push(`${p.name || p.slug}:${m.id}`);
        }
        seen.add(m.id);
      }
    }
    if (dupCount > 0) {
      issues.push(
        makeIssue({
          severity: "warn", // lihat catatan: dup id ga pernah fatal, by design
          source,
          field: "id",
          rule: "duplicate-id-in-provider",
          count: dupCount,
          total: dupTotal,
          samples: dupSamples,
          message:
            `${dupCount} model id duplikat DALAM satu provider yang sama (sample: ${dupSamples.join(", ") || "-"}). ` +
            `Cek dedup key di sumber "${source}" — biasanya harmless (model varian yang slugify()-nya ` +
            `collapse jadi sama), tapi worth di-review.`,
        }),
      );
    }
  }

  // ── Rule 7: url/baseUrl format ─────────────────────────────────────────────
  // Reuse safeUrl() dari normalize.mjs — allowlist http(s) doang, sama persis
  // yang dipakai merge stage buat provider.url/baseUrl.
  {
    for (const field of ["url", "baseUrl"]) {
      const vals = providers
        .map((p) => p[field])
        .filter((v) => v != null && String(v).trim() !== "");
      const total = vals.length;
      if (total === 0) continue;
      const bad = vals.filter((v) => safeUrl(v) == null);
      const severity = ratioSeverity(bad.length, total);
      if (severity) {
        issues.push(
          makeIssue({
            severity,
            source,
            field,
            rule: "invalid-url",
            count: bad.length,
            total,
            samples: bad,
            message:
              `Field "${field}": ${bad.length}/${total} nilai BUKAN URL http(s) absolut yang valid. Sample: ` +
              `${bad.slice(0, 3).join(", ")}. Cek parsing link di sumber "${source}" — mungkin narik href ` +
              `relatif atau teks yang bukan link.`,
          }),
        );
      }
    }
  }

  // ── Rule 8: all-null collapse ───────────────────────────────────────────────
  // SELALU "warn" (never fatal) — 100% null bisa berarti dua hal yang beda:
  // (a) sumber ini emang ga nyediain kolom itu (legit, mis. freellm.net yang
  //     kolom Max Output-nya dihapus dari layout barunya — itu BENAR, bukan
  //     bug), atau (b) parser-nya patah dan gagal narik field yang harusnya
  //     ada. Guard ga bisa bedain dua kasus itu sendirian — makanya cuma warn,
  //     manusia yang mutusin lihat context sumbernya.
  {
    const modelFields = ["context", "maxOutput", "modality", "rateLimit"];
    for (const field of modelFields) {
      const total = models.length;
      if (total < MIN_SAMPLE) continue;
      const nonNull = models.filter(
        (m) => m[field] != null && String(m[field]).trim() !== "",
      ).length;
      if (nonNull === 0) {
        issues.push(
          makeIssue({
            severity: "warn",
            source,
            field,
            rule: "all-null-collapse",
            count: total,
            total,
            samples: [],
            message:
              `Field "${field}": 100% null di ${total} model dari sumber "${source}". Ini BISA legit ` +
              `(sumber emang ga publish kolom ini — persis kasus freellm.net yang Max Output-nya hilang ` +
              `dari layout baru, lihat INCIDENT 2026-07-25) ATAU tanda parser patah gagal narik kolom yang ` +
              `harusnya ada. Manusia perlu cek struktur sumber "${source}" langsung untuk mutusin.`,
          }),
        );
      }
    }

    const providerFields = ["url", "baseUrl"];
    for (const field of providerFields) {
      const total = providers.length;
      if (total < MIN_SAMPLE) continue; // jarang kejadian (provider count kecil), tapi konsisten
      const nonNull = providers.filter(
        (p) => p[field] != null && String(p[field]).trim() !== "",
      ).length;
      if (nonNull === 0) {
        issues.push(
          makeIssue({
            severity: "warn",
            source,
            field,
            rule: "all-null-collapse",
            count: total,
            total,
            samples: [],
            message:
              `Field "${field}": 100% null di ${total} provider dari sumber "${source}". Cek apakah sumber ` +
              `ini emang ga publish field ini, atau parser gagal narik link.`,
          }),
        );
      }
    }
  }

  const ok = !issues.some((i) => i.severity === "fatal");
  return { ok, issues, stats };
}

/**
 * Sama seperti checkShape tapi melempar ShapeGuardError kalau ada issue fatal.
 * @param {any[]} providers
 * @param {{source?: string}} [opts]
 */
export function assertShape(providers, opts = {}) {
  const result = checkShape(providers, opts);
  if (!result.ok) {
    throw new ShapeGuardError(result.issues);
  }
}

// ─── Self-test ────────────────────────────────────────────────────────────────
//
// Run dengan: node scripts/lib/shape-guard.mjs --selftest
// Exit 1 kalau ada yang gagal.

if (process.argv.includes("--selftest")) {
  import("node:assert").then(async ({ default: assert }) => {
    let passed = 0;
    let failed = 0;

    function test(description, fn) {
      try {
        fn();
        console.log(`  PASS  ${description}`);
        passed++;
      } catch (err) {
        console.error(`  FAIL  ${description}`);
        console.error(`        ${err.message}`);
        failed++;
      }
    }

    console.log("shape-guard.mjs self-test");
    console.log("─".repeat(60));

    // ════════════════════════════════════════════════════════════════
    // A. looksLikeContext / looksLikeRateLimit — predikat murni
    // ════════════════════════════════════════════════════════════════
    console.log("\n[A] Predikat looksLikeContext / looksLikeRateLimit");

    test("A1: '128K' looks like context", () => {
      assert.strictEqual(looksLikeContext("128K"), true);
    });
    test("A2: '1M' looks like context", () => {
      assert.strictEqual(looksLikeContext("1M"), true);
    });
    test("A3: '8192' (bare int >= 1000) looks like context", () => {
      assert.strictEqual(looksLikeContext("8192"), true);
    });
    test("A4: '32k' lowercase unit looks like context", () => {
      assert.strictEqual(looksLikeContext("32k"), true);
    });
    test("A5: '128K (8K on free)' with parenthetical looks like context", () => {
      assert.strictEqual(looksLikeContext("128K (8K on free)"), true);
    });
    test("A6: 'Up to 10M' with qualifier looks like context", () => {
      assert.strictEqual(looksLikeContext("Up to 10M"), true);
    });
    test("A7: '81' (bare int < 1000 — Score signature) does NOT look like context", () => {
      assert.strictEqual(looksLikeContext("81"), false);
    });
    test("A8: '45' (bare int < 1000) does NOT look like context", () => {
      assert.strictEqual(looksLikeContext("45"), false);
    });
    test("A9: '$25/month' (currency) does NOT look like context", () => {
      assert.strictEqual(looksLikeContext("$25/month"), false);
    });
    test("A10: 'Jun 30, 2026' (date) does NOT look like context", () => {
      assert.strictEqual(looksLikeContext("Jun 30, 2026"), false);
    });
    test("A11: '85%' (percentage) does NOT look like context", () => {
      assert.strictEqual(looksLikeContext("85%"), false);
    });
    test("A12: 'Varies' (legit prose value) looks like context", () => {
      assert.strictEqual(looksLikeContext("Varies"), true);
    });
    test("A13: '30 RPM' looks like rate limit", () => {
      assert.strictEqual(looksLikeRateLimit("30 RPM"), true);
    });
    test("A14: '10,000 neurons/day' looks like rate limit", () => {
      assert.strictEqual(looksLikeRateLimit("10,000 neurons/day"), true);
    });
    test("A15: '256K' (bare context token) does NOT look like rate limit", () => {
      assert.strictEqual(looksLikeRateLimit("256K"), false);
    });
    test("A16: null is neither context nor rate limit", () => {
      assert.strictEqual(looksLikeContext(null), false);
      assert.strictEqual(looksLikeRateLimit(null), false);
    });

    // ════════════════════════════════════════════════════════════════
    // B. REGRESSION — reconstructs INCIDENT 2026-07-25 exactly
    // ════════════════════════════════════════════════════════════════
    console.log("\n[B] Regression: INCIDENT 2026-07-25 (Score column read as context)");

    function makeIncidentProvider(n) {
      // context = Score values (bare int < 1000), maxOutput = actual context
      // values that got shifted into the maxOutput slot — persis pola bug asli.
      const scoreVals = ["81", "55", "52", "49", "40", "45", "47", "71"];
      const models = [];
      for (let i = 0; i < n; i++) {
        models.push({
          id: `model-${i}`,
          name: `Model ${i}`,
          context: scoreVals[i % scoreVals.length],
          maxOutput: "256K",
          modality: "text",
          rateLimit: "30 RPM",
        });
      }
      return {
        slug: "incident-provider",
        name: "Incident Provider",
        url: "https://example.com",
        baseUrl: "https://api.example.com",
        description: "",
        models,
      };
    }

    test("B1: 30-model column-swap reconstruction → checkShape returns FATAL on context", () => {
      const providers = [makeIncidentProvider(30)];
      const result = checkShape(providers, { source: "freellm.net" });
      assert.strictEqual(result.ok, false, "expected ok=false (fatal present)");
      const fatal = result.issues.filter((i) => i.severity === "fatal");
      assert.ok(fatal.length > 0, "expected at least one fatal issue");
      const contextIssue = fatal.find((i) => i.field === "context" && i.rule === "context-shape");
      assert.ok(
        contextIssue,
        `expected a fatal context-shape issue, got rules: ${fatal.map((i) => i.rule).join(", ")}`,
      );
    });

    test("B2: assertShape throws ShapeGuardError on the same incident data", () => {
      const providers = [makeIncidentProvider(30)];
      assert.throws(
        () => assertShape(providers, { source: "freellm.net" }),
        ShapeGuardError,
      );
    });

    test("B3: small isolated sample (< MIN_SAMPLE) of same bad shape → warn, NOT fatal", () => {
      // Cuma 5 model — di bawah MIN_SAMPLE (20), jadi walau ratio 100% bad,
      // severity harus "warn" (satu provider aneh != bug sistemik).
      const providers = [makeIncidentProvider(5)];
      const result = checkShape(providers, { source: "freellm.net" });
      const contextIssues = result.issues.filter((i) => i.field === "context");
      assert.ok(contextIssues.length > 0, "expected a context issue to be reported");
      assert.ok(
        contextIssues.every((i) => i.severity === "warn"),
        `expected all context issues to be warn (small sample), got: ${contextIssues.map((i) => i.severity)}`,
      );
      assert.strictEqual(result.ok, true, "small-sample warn must not flip ok=false");
    });

    // ════════════════════════════════════════════════════════════════
    // C. HEALTHY DATA — must produce ZERO fatal issues
    // ════════════════════════════════════════════════════════════════
    console.log("\n[C] Healthy data (real providers.json shape) — no false positives");

    function makeHealthyProviders() {
      // Bentuk nilai persis seperti data/providers.json real (lihat scratchpad
      // recon) — cakup semua "prose" legit yang harus TETAP lolos.
      const contextPool = ["256K", "4K", "128K", "32K", "262K", "128K (8K on free)", "1M", "Up to 10M", "Varies"];
      const maxOutputPool = ["32K", "~8K", "8K", "Shared w/ context", "1K", "Varies", "Model-dependent", "Configurable"];
      const rateLimitPool = [
        "30 RPM",
        "15 RPM, 20K TPD",
        "10,000 neurons/day",
        "Community-powered, no hard cap",
        "20 requests/minute, 1,000 requests/month",
        "Unlimited for free models",
        "Dependent on Copilot subscription tier (Free/Pro)",
      ];
      const modalityPool = ["text + vision", "image", "Text", "Multimodal", "embedding + rerank", "text + reasoning"];

      const providers = [];
      for (let p = 0; p < 6; p++) {
        const models = [];
        for (let i = 0; i < 15; i++) {
          models.push({
            id: `p${p}-model-${i}`,
            name: `Model ${p}-${i}`,
            context: contextPool[(p + i) % contextPool.length],
            maxOutput: i % 3 === 0 ? null : maxOutputPool[(p + i) % maxOutputPool.length],
            modality: modalityPool[(p + i) % modalityPool.length],
            rateLimit: rateLimitPool[(p + i) % rateLimitPool.length],
          });
        }
        providers.push({
          slug: `provider-${p}`,
          name: `Provider ${p}`,
          url: `https://provider${p}.example.com`,
          baseUrl: `https://api.provider${p}.example.com/v1`,
          description: "Free tier apa adanya dari sumber, no card required.",
          models,
        });
      }
      return providers;
    }

    test("C1: healthy synthetic data (real-shaped values) → zero fatal issues", () => {
      const result = checkShape(makeHealthyProviders(), { source: "synthetic-healthy" });
      const fatal = result.issues.filter((i) => i.severity === "fatal");
      assert.strictEqual(
        fatal.length,
        0,
        `expected zero fatal issues on healthy data, got: ${JSON.stringify(fatal, null, 2)}`,
      );
      assert.strictEqual(result.ok, true);
    });

    test("C2: assertShape does not throw on healthy data", () => {
      assert.doesNotThrow(() => assertShape(makeHealthyProviders(), { source: "synthetic-healthy" }));
    });

    test("C3: empty providers array → ok, no issues", () => {
      const result = checkShape([], { source: "empty-source" });
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.issues.length, 0);
    });

    test("C4: provider with zero models → ok, no issues, no crash", () => {
      const result = checkShape([{ slug: "x", name: "X", models: [] }], { source: "x" });
      assert.strictEqual(result.ok, true);
    });

    // ════════════════════════════════════════════════════════════════
    // D. Rule-specific checks
    // ════════════════════════════════════════════════════════════════
    console.log("\n[D] Rule-specific checks");

    test("D1: leftover HTML tag in model name → detected", () => {
      const models = [];
      for (let i = 0; i < 22; i++) {
        models.push({
          id: `m${i}`,
          name: i < 12 ? `<span>Model ${i}</span>` : `Model ${i}`,
          context: "128K",
          maxOutput: "8K",
          modality: "text",
          rateLimit: "30 RPM",
        });
      }
      const result = checkShape([{ slug: "p", name: "P", models }], { source: "html-regress" });
      const issue = result.issues.find((i) => i.rule === "leftover-markup-entity" && i.field === "name");
      assert.ok(issue, "expected a leftover-markup-entity issue for name");
      assert.strictEqual(issue.severity, "fatal", `12/22 > 50% of MIN_SAMPLE-sized set should be fatal, got ${issue.severity}`);
    });

    test("D2: undecoded HTML entity in name → detected (isolated → warn)", () => {
      const models = [
        { id: "m1", name: "Ren&#39;Py Chat", context: "128K", maxOutput: "8K", modality: "text", rateLimit: "30 RPM" },
        { id: "m2", name: "Normal Model", context: "128K", maxOutput: "8K", modality: "text", rateLimit: "30 RPM" },
      ];
      const result = checkShape([{ slug: "p", name: "P", models }], { source: "entity-regress" });
      const issue = result.issues.find((i) => i.rule === "leftover-markup-entity" && i.field === "name");
      assert.ok(issue, "expected a leftover-markup-entity issue");
      assert.strictEqual(issue.severity, "warn", "isolated (1/2) should be warn, not fatal");
    });

    test("D3: duplicate id within one provider → warn (never fatal, by design)", () => {
      const models = [
        { id: "dup", name: "A", context: "128K", maxOutput: "8K", modality: "text", rateLimit: "30 RPM" },
        { id: "dup", name: "B", context: "128K", maxOutput: "8K", modality: "text", rateLimit: "30 RPM" },
      ];
      const result = checkShape([{ slug: "p", name: "P", models }], { source: "dup-id" });
      const issue = result.issues.find((i) => i.rule === "duplicate-id-in-provider");
      assert.ok(issue, "expected a duplicate-id-in-provider issue");
      assert.strictEqual(issue.severity, "warn");
      assert.strictEqual(result.ok, true, "duplicate id alone must never flip ok=false");
    });

    test("D4: invalid url (relative path) → detected", () => {
      const providers = [];
      for (let i = 0; i < 22; i++) {
        providers.push({
          slug: `p${i}`,
          name: `P${i}`,
          url: i < 12 ? "/relative/path" : "https://example.com",
          models: [{ id: "m", name: "M", context: "128K", maxOutput: null, modality: "text", rateLimit: "30 RPM" }],
        });
      }
      const result = checkShape(providers, { source: "bad-url" });
      const issue = result.issues.find((i) => i.rule === "invalid-url" && i.field === "url");
      assert.ok(issue, "expected an invalid-url issue");
      assert.strictEqual(issue.severity, "fatal");
    });

    test("D5: all-null maxOutput across large sample → warn (ambiguous, not fatal)", () => {
      const models = [];
      for (let i = 0; i < 25; i++) {
        models.push({ id: `m${i}`, name: `M${i}`, context: "128K", maxOutput: null, modality: "text", rateLimit: "30 RPM" });
      }
      const result = checkShape([{ slug: "p", name: "P", models }], { source: "freellm.net" });
      const issue = result.issues.find((i) => i.rule === "all-null-collapse" && i.field === "maxOutput");
      assert.ok(issue, "expected an all-null-collapse issue for maxOutput");
      assert.strictEqual(issue.severity, "warn", "all-null-collapse must always be warn, never fatal");
      assert.strictEqual(result.ok, true);
    });

    test("D6: modality gibberish (unrecognised tokens) at high ratio → fatal", () => {
      const models = [];
      for (let i = 0; i < 22; i++) {
        models.push({
          id: `m${i}`,
          name: `M${i}`,
          context: "128K",
          maxOutput: null,
          modality: i < 15 ? "81" : "text",
          rateLimit: "30 RPM",
        });
      }
      const result = checkShape([{ slug: "p", name: "P", models }], { source: "modality-swap" });
      const issue = result.issues.find((i) => i.rule === "modality-unrecognised");
      assert.ok(issue, "expected a modality-unrecognised issue");
      assert.strictEqual(issue.severity, "fatal");
    });

    test("D7: context === rateLimit identical strings at high ratio → fatal", () => {
      const models = [];
      for (let i = 0; i < 22; i++) {
        models.push({ id: `m${i}`, name: `M${i}`, context: "30 RPM", maxOutput: null, modality: "text", rateLimit: "30 RPM" });
      }
      const result = checkShape([{ slug: "p", name: "P", models }], { source: "swap-identical" });
      const issue = result.issues.find((i) => i.rule === "column-swap-identical");
      assert.ok(issue, "expected a column-swap-identical issue");
      assert.strictEqual(issue.severity, "fatal");
    });

    // ════════════════════════════════════════════════════════════════
    // Summary
    // ════════════════════════════════════════════════════════════════
    console.log("\n" + "─".repeat(60));
    console.log(`${passed} passed, ${failed} failed`);

    if (failed > 0) {
      process.exit(1);
    } else {
      console.log("All tests passed.");
    }
  });
}
