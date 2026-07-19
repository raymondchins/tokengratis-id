import type { Provider } from "@/lib/types";

// Auto-generated FAQ — tiap Q&A CUMA dibangun dari field yang beneran ada di
// `provider` (freeLimit/description/models/sources/maxContext). Ga ada
// pertanyaan yang datanya ga ada di-skip, bukan dipaksa jadi "Unknown".
// Visible section di bawah HARUS match sama teks di FAQPage JSON-LD (syarat
// Google) — makanya jawabannya plain text, ga ada link ketanem di tengah kalimat.

function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

interface QA {
  question: string;
  answer: string;
}

function buildFaq(p: Provider): QA[] {
  const qa: QA[] = [];
  const syncDate = fmtDate(p.syncedAt);
  const sourceNames = p.sources.map((s) => s.name).join(", ");

  // Q1 — selalu ada (freeLimit / description / fallback generik, tetep apa
  // adanya, ga ada klaim baru).
  const freeAnswer = p.freeLimit
    ? `Ya — ${p.freeLimit}.`
    : p.description
      ? `Ya — menurut sumber: "${p.description}"`
      : `Ya, ${p.name} nyediain free tier / free credits API — detail model & rate limit ada di tabel di bawah.`;
  qa.push({
    question: `Apakah API ${p.name} gratis?`,
    answer: `${freeAnswer} Data dari ${sourceNames}, terakhir di-sync ${syncDate} — cek sumber untuk kondisi terbaru.`,
  });

  // Q2 — jumlah model.
  if (p.modelCount > 0) {
    const sampleNames = p.models
      .slice(0, 3)
      .map((m) => m.name)
      .join(", ");
    const suffix = sampleNames ? `, termasuk ${sampleNames}` : "";
    qa.push({
      question: `Ada berapa model gratis di ${p.name}?`,
      answer: `${p.modelCount} model tercantum per ${syncDate}${suffix}.`,
    });
  }

  // Q3 — rate limit, cuma kalau ada minimal 1 model yang nyimpen rateLimit.
  const rateLimited = p.models.filter((m) => m.rateLimit).slice(0, 3);
  if (rateLimited.length > 0) {
    const examples = rateLimited.map((m) => `${m.name}: ${m.rateLimit}`).join("; ");
    qa.push({
      question: `Berapa rate limit ${p.name}?`,
      answer: `Beda-beda per model, contoh: ${examples}. Limit lengkap per model, lihat tabel di atas.`,
    });
  }

  // Q4 — context window maksimal.
  if (p.maxContext) {
    const matchingModel = p.models.find((m) => m.context === p.maxContext);
    qa.push({
      question: `Berapa context window maksimal di ${p.name}?`,
      answer: matchingModel
        ? `${p.maxContext} (${matchingModel.name}).`
        : `${p.maxContext}.`,
    });
  }

  return qa;
}

export default function ProviderFaq({ provider }: { provider: Provider }) {
  const qa = buildFaq(provider);
  if (qa.length === 0) return null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qa.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <section className="rounded-[8px] border border-ink-line bg-ink-soft px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-mute">
        FAQ
      </p>
      <div className="mt-3 divide-y divide-ink-line">
        {qa.map((item) => (
          <div key={item.question} className="py-3 first:pt-0 last:pb-0">
            <h3 className="text-sm font-medium text-fog">{item.question}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-mute">{item.answer}</p>
          </div>
        ))}
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
    </section>
  );
}
