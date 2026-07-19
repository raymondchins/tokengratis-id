// IndexNow ping — beritahu Bing (feeds Copilot + ChatGPT Search retrieval)
// begitu data berubah, biar re-crawl ga nunggu jadwal biasa. Best-effort MURNI:
// gagal (network/timeout/non-2xx) TIDAK PERNAH ngejatuhin pipeline — cuma warn.
//
// Key file: public/<INDEXNOW_KEY>.txt (isinya persis key, dipakai IndexNow buat
// verifikasi ownership host). Key di sini HARUS sama persis sama nama file itu.

const INDEXNOW_KEY = "37e41350d87893f26c8f861f9699b8ef";
const INDEXNOW_HOST = "tokengratis.id";
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

/**
 * Ping IndexNow dengan daftar URL yang berubah. Never throws.
 *
 * @param {string[]} urls - Daftar URL absolut (mis. homepage + tiap /provider/<slug>).
 * @returns {Promise<{ok: boolean, status?: number, error?: string}>}
 */
export async function pingIndexNow(urls) {
  if (!Array.isArray(urls) || urls.length === 0) {
    return { ok: false, error: "urls kosong" };
  }

  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: INDEXNOW_HOST,
        key: INDEXNOW_KEY,
        keyLocation: `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`,
        urlList: urls,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export { INDEXNOW_KEY };
