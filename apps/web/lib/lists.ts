// "food, History،local culture" -> ["food", "history", "local culture"] (ASCII and Arabic commas, trimmed, de-duplicated).
export function parseList(input: string): string[] {
  const out: string[] = [];
  for (const part of input.split(/[,،]/)) {
    const v = part.trim().toLowerCase();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}
