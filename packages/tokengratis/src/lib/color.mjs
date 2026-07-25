// Minimal raw-ANSI colorizer — no color libraries (zero-dependency rule).
// Disabled automatically on non-TTY stdout or when NO_COLOR is set, per
// https://no-color.org/.

const CODES = {
  bold: "1",
  dim: "2",
  green: "32",
  cyan: "36",
  yellow: "33",
  red: "31",
};

/** Identity colorizer — used by the MCP server, which must never emit ANSI. */
export const noColor = Object.fromEntries(
  Object.keys(CODES).map((key) => [key, (text) => String(text)])
);

/**
 * @returns {Record<keyof typeof CODES, (text: string) => string>}
 */
export function createColorizer() {
  const enabled = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
  if (!enabled) return noColor;
  const wrap = (code) => (text) => `\x1b[${code}m${text}\x1b[0m`;
  return Object.fromEntries(Object.entries(CODES).map(([key, code]) => [key, wrap(code)]));
}
