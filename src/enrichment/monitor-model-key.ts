/**
 * 從螢幕品名抽出穩定 model key，供 catalog lookup。
 * 只做正規化與抽取，不做規格推斷。
 */

/** 常見系列前綴 + 型號體（MAG 272F、PA32USD、MP242、VP227HF、SA243Y…） */
const MODEL_RE =
  /\b(?:MAG|MPG|XG|PG|VG|XV|PA|SW|CS|PD|FO|MO|GO|EV|MP|MD|LC|GW|BL|EK|KA|VA|VX|VS|VP|VY|VZ|SA|SB|KG|ED|CB|XL|EX|NS|PH|SE|HC|AW|Q)\s*[-]?\s*(\d{2,4}[A-Z0-9.-]{0,16})\b/i;
/** Alienware 完整：AW2726DM / AW2725Q */
const ALIENWARE_RE = /\b(AW\d{4}[A-Z0-9]*)\b/i;
/** 次選：單字母系列 G242L / X27U / C27G4Z / P2425H */
const MODEL_RE_SHORT =
  /\b([A-Z](?:\d{2,4}[A-Z][A-Z0-9-]{0,14}))\b/i;
/** AOC 24B36X / 22B15H2 / 24G10ZNE */
const AOC_NUM_RE = /\b(\d{2}[A-Z]\d{2,4}[A-Z0-9]*)\b/i;

/** 三星 Odyssey / 完整料號 S27FG900XC、S57CG952NC */
const SAMSUNG_RE = /\b(S\d{2}[A-Z]{1,3}\d{2,4}[A-Z0-9]*)\b/i;

/** LG UltraFine / 40U990A */
const LG_RE = /\b(\d{2}[A-Z]\d{3,4}[A-Z0-9-]*)\b/i;

/**
 * 抽出小寫連字 key；抽不到回 null。
 * 例：`msi mag 272f`、`pa32usd`、`s27fg900xc`
 */
export function extractMonitorModelKey(rawName: string): string | null {
  const scrubbed = rawName
    .replace(/【[^】]*】/g, ' ')
    .replace(/〈[^〉]*〉/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\$[\d,]+/g, ' ')
    .replace(/,/g, ' ');

  const samsung = scrubbed.match(SAMSUNG_RE);
  if (samsung) return normalizeKey(samsung[1]);

  const aw = scrubbed.match(ALIENWARE_RE);
  if (aw) return normalizeKey(aw[1]);

  const m = scrubbed.match(MODEL_RE);
  if (m) {
    const full = m[0].replace(/\s+/g, '');
    if (full.replace(/[^a-z0-9]/gi, '').length >= 5) return normalizeKey(full);
  }

  const short = scrubbed.match(MODEL_RE_SHORT);
  if (short && short[1].length >= 5) return normalizeKey(short[1]);

  const aoc = scrubbed.match(AOC_NUM_RE);
  if (aoc && aoc[1].length >= 5) return normalizeKey(aoc[1]);

  // LG 等：40U990A-W
  const lg = scrubbed.match(LG_RE);
  if (lg && /[A-Z]/i.test(lg[1]) && /\d/.test(lg[1]) && lg[1].length >= 6) {
    return normalizeKey(lg[1]);
  }

  return null;
}

function normalizeKey(token: string): string {
  return token
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 32);
}
