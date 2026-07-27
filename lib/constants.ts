// Show all providers at current scale (~26); pagination stays dormant until list exceeds 100.
export const DIRECTORY_PAGE_SIZE = 100;
export const MODELS_PAGE_SIZE = 8;

/**
 * Grid columns + sizing for the desktop directory table.
 * `DIRECTORY_GRID_COLS` = everything except `grid` — used by desktop `ProviderRow`
 * which supplies its own `hidden md:grid` to toggle display on mobile vs desktop.
 */
// Kolom GRATIS dulu paling sempit (~140px) padahal dia value-prop-nya situs —
// "10,000 Neurons/hari" kebungkus 2 baris. Lebarnya diambil dari KEMAMPUAN
// (grid ikon modality lebarnya fix ~80px, jadi 130px min itu kebuang) + sedikit
// dari CATATAN yang udah line-clamp-2. Total fr sengaja tetap 5.4 biar rasio
// kolom lain ga geser. min-w turun 960→900 (jumlah min track cuma 742+104)
// biar scroll horizontal di dalam kartu berkurang di rentang md.
export const DIRECTORY_GRID_COLS =
  "min-w-[900px] grid-cols-[minmax(190px,1.8fr)_minmax(104px,0.75fr)_minmax(150px,1.25fr)_minmax(190px,1.6fr)_108px] items-center gap-4 px-5 text-left";
