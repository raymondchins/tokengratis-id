// Show all providers at current scale (~26); pagination stays dormant until list exceeds 100.
export const DIRECTORY_PAGE_SIZE = 100;
export const MODELS_PAGE_SIZE = 8;

/**
 * Grid columns + sizing for the desktop directory table.
 * `DIRECTORY_GRID_COLS` = everything except `grid` — used by desktop `ProviderRow`
 * which supplies its own `hidden md:grid` to toggle display on mobile vs desktop.
 */
export const DIRECTORY_GRID_COLS =
  "min-w-[960px] grid-cols-[minmax(190px,1.8fr)_minmax(130px,1fr)_minmax(120px,0.9fr)_minmax(200px,1.7fr)_108px] items-center gap-4 px-5 text-left";
