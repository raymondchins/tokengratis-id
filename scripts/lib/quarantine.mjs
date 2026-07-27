// Karantina provider — ngubah snapshot guard dari "abort semua" jadi
// "tahan yang mencurigakan, lanjutin sisanya".
//
// KENAPA ADA (bukti, bukan teori). 8 dari 25 run nightly terakhir GAGAL, dan
// SEMUANYA sebab yang sama: snapshot guard trip lalu abort seluruh write.
// Empat insiden, masing-masing pas 2 malam:
//   07-07/08  modelscope 50 -> 27 (-46%)          <- sumber goyang, besok balik
//   07-15/16  agnes-ai+chutes-ai+glhf-chat hilang <- freellm render ga utuh
//   07-19/20  tiga provider yang sama hilang lagi <- idem
//   07-25/26  github-models 39 -> 13              <- upstream BENERAN ngapus
// Cacatnya: satu provider goyang bikin 24 provider lain yang datanya segar ikut
// kebuang, situs basi 2 malam, dan cuma pulih kalau manusia turun tangan.
//
// PRINSIPNYA: korupsi itu SEMENTARA, kenyataan itu MENETAP. Guard lama ga bisa
// mbedain karena cuma ngeliat satu run. Modul ini ngasih guard-nya ingatan.
//
// Alurnya:
//   1. Provider trip guard -> pakai record last-known-good provider ITU doang,
//      provider lain tetep ditulis segar. Run HIJAU.
//   2. Anomali dicatat + dihitung streak-nya di data/quarantine.json.
//   3. Anomali SAMA muncul CONFIRM_RUNS kali berturut-turut -> itu kenyataan,
//      diterima otomatis, entry dibuang.
//   4. Provider balik normal -> streak di-reset, entry dibuang.
//
// Carry-forward JUJUR by construction: record lama dibawa apa adanya, jadi
// `syncedAt`-nya ga maju. Situs otomatis nampilin "Disinkron [tanggal lama]" —
// ga ada klaim kesegaran palsu (PRD §2).
//
// Yang SENGAJA tetep fatal (karantina ga boleh nutupin korupsi masif):
//   - anomali kena > MAX_QUARANTINE_RATIO dari total provider
//   - error diff-guard yang sifatnya global (total model anjlok, minProviders)
//   - shape-guard fatal (INCIDENT 2026-07-25, kolom ketuker) — itu jalur lain
//     dan ga disentuh modul ini sama sekali.

/** Berapa run berturut-turut sebuah anomali harus tampil sebelum diterima. */
export const CONFIRM_RUNS = 3;

/**
 * Kalau lebih dari sekian bagian provider kena anomali sekaligus, itu BUKAN
 * provider goyang satu-satu — itu korupsi sistemik (mis. semua adapter balik
 * kosong). Karantina nolak nanganin, biar tetep jadi fatal.
 */
export const MAX_QUARANTINE_RATIO = 0.3;

/** Toleransi biar angka yang goyang tipis (13 vs 14) ga nge-reset streak. */
const SAME_MAGNITUDE_TOLERANCE = 0.15;

/**
 * Batas keras umur karantina. Nutup lubang "basi diam-diam": kalau anomalinya
 * BERUBAH-UBAH tiap run (13 -> 20 -> 8 -> 25), streak-nya reset terus, jadi
 * ga pernah nyampe CONFIRM_RUNS dan providernya bakal di-carry-forward
 * SELAMANYA tanpa ada yang tau. Lewat batas ini → fatal, biar manusia liat.
 * Sumber yang goyang normal (kasus freellm) sembuh dalam 1-2 malam, jauh di
 * bawah ini — jadi ambangnya ga bakal ganggu kasus wajar.
 */
export const MAX_QUARANTINE_DAYS = 7;

export function emptyState() {
  return { version: 1, entries: {} };
}

/** Baca state karantina. File ilang / korup → state kosong (fail-open, ini cuma memori bantu). */
export function parseState(raw) {
  if (!raw) return emptyState();
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object" || !parsed.entries) return emptyState();
    return { version: 1, entries: { ...parsed.entries } };
  } catch {
    return emptyState();
  }
}

/**
 * Ubah stats diff-guard jadi daftar anomali PER-PROVIDER.
 * Error global (total drop, minProviders) SENGAJA ga masuk sini — itu tetep fatal.
 */
export function anomaliesFromStats(stats) {
  const out = [];
  for (const slug of stats?.disappeared ?? []) {
    out.push({ slug, kind: "disappeared", magnitude: 0, detail: "provider hilang dari hasil merge" });
  }
  for (const s of stats?.shrunk ?? []) {
    out.push({
      slug: s.slug,
      kind: "shrunk",
      magnitude: s.next,
      detail: `model ${s.prev} -> ${s.next} (-${Math.round(s.dropPct)}%)`,
    });
  }
  for (const c of stats?.churned ?? []) {
    // Provider yang sama bisa kena shrunk DAN churned sekaligus (github-models).
    // Cukup satu entry — dua-duanya bakal beres lewat carry-forward yang sama.
    if (out.some((a) => a.slug === c.slug)) continue;
    out.push({
      slug: c.slug,
      kind: "churned",
      magnitude: c.nextIds,
      detail: `id churn, overlap ${Math.round(c.overlapPct)}% (${c.prevIds} -> ${c.nextIds} id)`,
    });
  }
  return out;
}

function sameAnomaly(entry, anomaly) {
  if (entry.kind !== anomaly.kind) return false;
  if (anomaly.kind === "disappeared") return true;
  const prev = Number(entry.magnitude);
  const next = Number(anomaly.magnitude);
  if (!Number.isFinite(prev) || !Number.isFinite(next)) return false;
  if (prev === next) return true;
  const base = Math.max(Math.abs(prev), 1);
  return Math.abs(next - prev) / base <= SAME_MAGNITUDE_TOLERANCE;
}

/**
 * Putusin tiap anomali: tahan (carry-forward) atau terima.
 *
 * @param {object} o
 * @param {object} o.state           state karantina sebelumnya
 * @param {Array}  o.anomalies       hasil anomaliesFromStats()
 * @param {number} o.totalProviders  jumlah provider di snapshot LAMA (buat rasio)
 * @param {string} o.now             ISO timestamp run ini
 * @param {number} [o.confirmRuns]
 * @returns {{fatal: string|null, carryForward: string[], accepted: object[], held: object[], cleared: string[], state: object}}
 */
export function reconcile({ state, anomalies, totalProviders, now, confirmRuns = CONFIRM_RUNS }) {
  const prevEntries = state?.entries ?? {};
  const nextEntries = {};
  const carryForward = [];
  const accepted = [];
  const held = [];

  // Korupsi masif: karantina ga boleh dipakai buat nutupin ini.
  if (totalProviders > 0 && anomalies.length / totalProviders > MAX_QUARANTINE_RATIO) {
    return {
      fatal:
        `${anomalies.length} dari ${totalProviders} provider kena anomali sekaligus ` +
        `(> ${Math.round(MAX_QUARANTINE_RATIO * 100)}%) — ini pola korupsi sistemik, ` +
        `bukan provider goyang satu-satu. Karantina sengaja NOLAK nanganin ini.`,
      carryForward: [],
      accepted: [],
      held: [],
      cleared: [],
      state: { version: 1, entries: prevEntries },
    };
  }

  // Karantina yang kelamaan = anomali flapping yang ga pernah stabil. Itu
  // butuh mata manusia, bukan carry-forward tanpa batas.
  const nowMs = Date.parse(now);
  const stale = [];
  for (const [slug, e] of Object.entries(prevEntries)) {
    if (!anomalies.some((a) => a.slug === slug)) continue;
    const firstMs = Date.parse(e.firstSeen ?? now);
    if (!Number.isFinite(firstMs) || !Number.isFinite(nowMs)) continue;
    const days = (nowMs - firstMs) / 86_400_000;
    if (days > MAX_QUARANTINE_DAYS) stale.push({ slug, days: Math.round(days), detail: e.detail });
  }
  if (stale.length) {
    return {
      fatal:
        `provider ${stale.map((s) => `"${s.slug}" (${s.days} hari: ${s.detail})`).join(", ")} ` +
        `udah dikarantina lebih dari ${MAX_QUARANTINE_DAYS} hari tanpa pernah stabil. ` +
        `Anomalinya kemungkinan flapping — carry-forward diberhentiin biar datanya ga basi diam-diam.`,
      carryForward: [],
      accepted: [],
      held: [],
      cleared: [],
      state: { version: 1, entries: prevEntries },
    };
  }

  for (const a of anomalies) {
    const prev = prevEntries[a.slug];
    const continues = prev && sameAnomaly(prev, a);
    const streak = continues ? (prev.streak ?? 1) + 1 : 1;

    if (streak >= confirmRuns) {
      // Muncul konsisten CONFIRM_RUNS kali → ini kenyataan, bukan goyangan.
      accepted.push({ ...a, streak });
      continue; // entry dibuang: anomalinya udah jadi baseline baru
    }

    nextEntries[a.slug] = {
      kind: a.kind,
      magnitude: a.magnitude,
      detail: a.detail,
      streak,
      // firstSeen = kapan provider ini PERTAMA masuk karantina, bukan kapan
      // streak terakhir mulai. Kalau ikut di-reset tiap magnitude berubah,
      // anomali flapping ga akan pernah nyentuh MAX_QUARANTINE_DAYS dan
      // datanya basi diam-diam selamanya — persis lubang yang mau ditutup.
      firstSeen: prev?.firstSeen ?? now,
      lastSeen: now,
    };
    carryForward.push(a.slug);
    held.push({ ...a, streak, needs: confirmRuns });
  }

  // Provider yang dulu dikarantina tapi sekarang normal → sembuh, entry dibuang.
  const cleared = Object.keys(prevEntries).filter((slug) => !nextEntries[slug] && !accepted.some((a) => a.slug === slug));

  return {
    fatal: null,
    carryForward,
    accepted,
    held,
    cleared,
    state: { version: 1, entries: nextEntries },
  };
}

/**
 * Ganti record provider yang dikarantina pakai record last-known-good.
 * Provider yang HILANG dimasukin balik; yang nyusut dikembaliin ke versi lama.
 * Record dibawa apa adanya (termasuk syncedAt lama) — itu yang bikin jujur.
 */
export function applyCarryForward(next, prev, slugs) {
  if (!slugs.length) return { providers: next, restored: [] };
  const prevMap = new Map(prev.map((p) => [p.slug, p]));
  const restored = [];
  const bySlug = new Map(next.map((p) => [p.slug, p]));

  for (const slug of slugs) {
    const old = prevMap.get(slug);
    if (!old) continue; // ga ada di last-known-good → ga ada yang bisa dibawa
    bySlug.set(slug, old);
    restored.push(slug);
  }

  // Pertahanin urutan hasil merge; provider yang balik dari hilang ditaruh di belakang.
  const seen = new Set();
  const out = [];
  for (const p of next) {
    out.push(bySlug.get(p.slug) ?? p);
    seen.add(p.slug);
  }
  for (const slug of restored) if (!seen.has(slug)) out.push(prevMap.get(slug));
  return { providers: out, restored };
}

// ─── Selftest ────────────────────────────────────────────────────────────────

function assert(cond, msg) {
  if (!cond) {
    console.error("  ✗", msg);
    process.exitCode = 1;
  } else {
    console.log("  ✓", msg);
  }
}

function selftest() {
  console.log("[quarantine] selftest");
  const NOW = "2026-07-27T00:00:00.000Z";

  // 1. Anomali baru → ditahan, bukan diterima.
  {
    const anomalies = anomaliesFromStats({ disappeared: ["chutes-ai"], shrunk: [], churned: [] });
    const r = reconcile({ state: emptyState(), anomalies, totalProviders: 24, now: NOW });
    assert(r.fatal === null, "anomali tunggal ga bikin fatal");
    assert(r.carryForward.length === 1 && r.carryForward[0] === "chutes-ai", "provider hilang di-carry-forward");
    assert(r.accepted.length === 0, "run pertama belum diterima");
    assert(r.state.entries["chutes-ai"].streak === 1, "streak mulai dari 1");
  }

  // 2. Anomali sama 3x berturut-turut → diterima otomatis (kasus github-models).
  {
    let state = emptyState();
    const anomalies = anomaliesFromStats({
      disappeared: [],
      shrunk: [{ slug: "github-models", prev: 39, next: 13, dropPct: 66.7 }],
      churned: [],
    });
    let r;
    for (let i = 0; i < 3; i++) {
      r = reconcile({ state, anomalies, totalProviders: 24, now: NOW });
      state = r.state;
    }
    assert(r.accepted.length === 1 && r.accepted[0].slug === "github-models", "3 run konsisten → diterima");
    assert(r.carryForward.length === 0, "yang diterima ga di-carry-forward lagi");
    assert(!state.entries["github-models"], "entry dibuang setelah diterima");
  }

  // 3. Sumber pulih sebelum 3 run → streak di-reset (kasus freellm goyang).
  {
    let state = emptyState();
    const gone = anomaliesFromStats({ disappeared: ["glhf-chat"], shrunk: [], churned: [] });
    state = reconcile({ state, anomalies: gone, totalProviders: 24, now: NOW }).state;
    state = reconcile({ state, anomalies: gone, totalProviders: 24, now: NOW }).state;
    assert(state.entries["glhf-chat"].streak === 2, "2 malam hilang → streak 2, belum diterima");
    const r = reconcile({ state, anomalies: [], totalProviders: 24, now: NOW });
    assert(r.cleared.includes("glhf-chat"), "provider balik normal → entry dibersihin");
    assert(Object.keys(r.state.entries).length === 0, "state kosong lagi setelah sembuh");
  }

  // 4. Angka goyang tipis ga nge-reset streak; goyang besar nge-reset.
  {
    let state = emptyState();
    const mk = (next) => anomaliesFromStats({ disappeared: [], shrunk: [{ slug: "m", prev: 50, next, dropPct: 46 }], churned: [] });
    state = reconcile({ state, anomalies: mk(27), totalProviders: 24, now: NOW }).state;
    const r2 = reconcile({ state, anomalies: mk(28), totalProviders: 24, now: NOW });
    assert(r2.state.entries["m"].streak === 2, "27 → 28 dianggap anomali sama (streak lanjut)");
    const r3 = reconcile({ state: r2.state, anomalies: mk(5), totalProviders: 24, now: NOW });
    assert(r3.state.entries["m"].streak === 1, "27 → 5 beda jauh → streak reset");
  }

  // 5. Korupsi masif tetep fatal.
  {
    const many = Array.from({ length: 12 }, (_, i) => `p${i}`);
    const anomalies = anomaliesFromStats({ disappeared: many, shrunk: [], churned: [] });
    const r = reconcile({ state: emptyState(), anomalies, totalProviders: 24, now: NOW });
    assert(r.fatal !== null, "12 dari 24 provider anomali → fatal, karantina nolak");
    assert(r.carryForward.length === 0, "fatal ga nyisain carry-forward");
  }

  // 6. Provider yang sama kena shrunk + churned cuma jadi 1 entry.
  {
    const anomalies = anomaliesFromStats({
      disappeared: [],
      shrunk: [{ slug: "github-models", prev: 39, next: 13, dropPct: 66.7 }],
      churned: [{ slug: "github-models", overlapPct: 33.3, prevIds: 39, nextIds: 13 }],
    });
    assert(anomalies.length === 1, "shrunk + churned di provider sama → 1 anomali");
  }

  // 7. applyCarryForward: yang hilang balik, yang nyusut dipulihin, syncedAt lama kejaga.
  {
    const prev = [
      { slug: "a", modelCount: 5, syncedAt: "2026-07-20T00:00:00Z" },
      { slug: "gone", modelCount: 3, syncedAt: "2026-07-20T00:00:00Z" },
    ];
    const next = [{ slug: "a", modelCount: 1, syncedAt: "2026-07-27T00:00:00Z" }];
    const { providers, restored } = applyCarryForward(next, prev, ["a", "gone"]);
    assert(providers.length === 2, "provider hilang dimasukin balik");
    assert(providers.find((p) => p.slug === "a").modelCount === 5, "provider nyusut dipulihin ke versi lama");
    assert(
      providers.find((p) => p.slug === "a").syncedAt === "2026-07-20T00:00:00Z",
      "syncedAt LAMA kejaga — ga ada klaim segar palsu",
    );
    assert(restored.length === 2, "dua-duanya kecatat sebagai restored");
  }

  // 8. Anomali flapping (magnitude ganti terus) ga boleh di-carry-forward selamanya.
  {
    let state = emptyState();
    const mk = (next) => anomaliesFromStats({ disappeared: [], shrunk: [{ slug: "flap", prev: 100, next, dropPct: 50 }], churned: [] });
    // Hari 0: mulai dikarantina.
    state = reconcile({ state, anomalies: mk(10), totalProviders: 24, now: "2026-07-01T00:00:00.000Z" }).state;
    assert(state.entries["flap"].streak === 1, "flapping: streak mulai 1");
    // Hari 3: magnitude beda jauh → streak reset, TAPI firstSeen tetep hari 0.
    state = reconcile({ state, anomalies: mk(90), totalProviders: 24, now: "2026-07-04T00:00:00.000Z" }).state;
    assert(state.entries["flap"].streak === 1, "flapping: magnitude beda → streak reset");
    assert(state.entries["flap"].firstSeen === "2026-07-01T00:00:00.000Z", "flapping: firstSeen ga ikut ke-reset");
    // Hari 9: udah lewat MAX_QUARANTINE_DAYS → fatal, jangan basi diam-diam.
    const r = reconcile({ state, anomalies: mk(20), totalProviders: 24, now: "2026-07-10T00:00:00.000Z" });
    assert(r.fatal !== null, `flapping > ${MAX_QUARANTINE_DAYS} hari → fatal`);
    assert(r.carryForward.length === 0, "flapping kelamaan ga di-carry-forward lagi");
  }

  // 9. Karantina normal (sembuh cepat) ga kena batas umur.
  {
    let state = emptyState();
    const gone = anomaliesFromStats({ disappeared: ["x"], shrunk: [], churned: [] });
    state = reconcile({ state, anomalies: gone, totalProviders: 24, now: "2026-07-01T00:00:00.000Z" }).state;
    const r = reconcile({ state, anomalies: gone, totalProviders: 24, now: "2026-07-02T00:00:00.000Z" });
    assert(r.fatal === null, "karantina 1 hari ga kena batas umur");
    assert(r.carryForward.includes("x"), "masih di-carry-forward normal");
  }

  // 10. State korup → fail-open ke kosong, jangan ngejatuhin sync.
  {
    assert(Object.keys(parseState("{bukan json").entries).length === 0, "state korup → state kosong");
    assert(Object.keys(parseState(null).entries).length === 0, "state ga ada → state kosong");
  }

  console.log(process.exitCode ? "[quarantine] ADA YANG GAGAL" : "[quarantine] semua lolos");
}

if (process.argv.includes("--selftest")) selftest();
