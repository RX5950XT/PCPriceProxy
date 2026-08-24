export const COMMANDS = [
  'search',
  'show',
  'history',
  'categories',
  'brands',
  'health',
  'sources',
  'refresh',
  'schema',
  'help',
] as const;

export type Command = (typeof COMMANDS)[number];
export type OutputFormat = 'json' | 'pretty' | 'table';
export type SortKey = 'price_asc' | 'price_desc' | 'name' | 'updated';
export type SourceName = 'coolpc' | 'sinya' | 'autobuy';

export interface CliOptions {
  readonly command: Command;
  readonly positionals: readonly string[];
  readonly query?: string;
  readonly category?: string;
  readonly subcategory?: string;
  readonly brand?: string;
  readonly source?: SourceName;
  readonly priceMin?: number;
  readonly priceMax?: number;
  readonly inStock: boolean;
  readonly multi: boolean;
  readonly partsOnly: boolean;
  readonly sort?: SortKey;
  readonly page: number;
  readonly limit: number;
  readonly url?: string;
  readonly db?: string;
  readonly offline: boolean;
  readonly format: OutputFormat;
  readonly panel?: string;
  readonly refreshTier?: string;
  readonly resolution?: string;
  readonly mbForm?: string;
  readonly mbDimm?: string;
  readonly mbWifi?: string;
  readonly mbDdr?: string;
  readonly mbLan?: string;
}

export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

const FLAG_ALIASES: Record<string, string> = {
  '-q': 'query',
  '--q': 'query',
  '--query': 'query',
  '-c': 'category',
  '--category': 'category',
  '--subcategory': 'subcategory',
  '-b': 'brand',
  '--brand': 'brand',
  '--source': 'source',
  '--price-min': 'priceMin',
  '--price-max': 'priceMax',
  '--in-stock': 'inStock',
  '--parts-only': 'partsOnly',
  '--multi': 'multi',
  '--has-multiple-sources': 'multi',
  '--sort': 'sort',
  '--page': 'page',
  '--limit': 'limit',
  '--url': 'url',
  '--db': 'db',
  '--offline': 'offline',
  '--format': 'format',
  '--json': 'json',
  '--pretty': 'pretty',
  '--table': 'table',
  '--panel': 'panel',
  '--refresh-tier': 'refreshTier',
  '--resolution': 'resolution',
  '--mb-form': 'mbForm',
  '--mb-dimm': 'mbDimm',
  '--mb-wifi': 'mbWifi',
  '--mb-ddr': 'mbDdr',
  '--mb-lan': 'mbLan',
  '-h': 'help',
  '--help': 'help',
};

const BOOLEAN_FLAGS = new Set([
  'inStock',
  'partsOnly',
  'multi',
  'offline',
  'json',
  'pretty',
  'table',
  'help',
]);

export function parseArgs(argv: readonly string[]): CliOptions {
  const tokens = [...argv];
  const flags = new Map<string, string | boolean>();
  const positionals: string[] = [];

  while (tokens.length > 0) {
    const token = tokens.shift() as string;
    if (token === '--') {
      positionals.push(...tokens);
      break;
    }
    if (token.startsWith('-')) {
      const [rawName, inline] = splitInline(token);
      const name = FLAG_ALIASES[rawName];
      if (!name) throw new UsageError(`未知參數：${rawName}`);
      if (BOOLEAN_FLAGS.has(name)) {
        flags.set(name, true);
        continue;
      }
      const value = inline ?? tokens.shift();
      if (value === undefined || value.startsWith('-')) {
        throw new UsageError(`${rawName} 需要值`);
      }
      flags.set(name, value);
      continue;
    }
    positionals.push(token);
  }

  if (flags.has('help') || positionals[0] === 'help') {
    return baseOptions({ command: 'help', positionals: [], flags });
  }

  const command = (positionals.shift() ?? 'help') as string;
  if (!COMMANDS.includes(command as Command)) {
    throw new UsageError(`未知指令：${command}。可用：${COMMANDS.join(', ')}`);
  }

  return baseOptions({ command: command as Command, positionals, flags });
}

function splitInline(token: string): [string, string | undefined] {
  const eq = token.indexOf('=');
  if (eq === -1) return [token, undefined];
  return [token.slice(0, eq), token.slice(eq + 1)];
}

function baseOptions(input: {
  command: Command;
  positionals: string[];
  flags: Map<string, string | boolean>;
}): CliOptions {
  const format = resolveFormat(input.flags);
  const query = stringFlag(input.flags, 'query') ?? (
    input.command === 'search' ? input.positionals.join(' ').trim() || undefined : undefined
  );

  return {
    command: input.command,
    positionals: input.positionals,
    query,
    category: stringFlag(input.flags, 'category'),
    subcategory: stringFlag(input.flags, 'subcategory'),
    brand: stringFlag(input.flags, 'brand'),
    source: parseSource(stringFlag(input.flags, 'source')),
    priceMin: numberFlag(input.flags, 'priceMin'),
    priceMax: numberFlag(input.flags, 'priceMax'),
    inStock: Boolean(input.flags.get('inStock')),
    partsOnly: Boolean(input.flags.get('partsOnly')),
    multi: Boolean(input.flags.get('multi')),
    sort: parseSort(stringFlag(input.flags, 'sort')),
    page: numberFlag(input.flags, 'page') ?? 1,
    limit: numberFlag(input.flags, 'limit') ?? 15,
    url: stringFlag(input.flags, 'url'),
    db: stringFlag(input.flags, 'db'),
    offline: Boolean(input.flags.get('offline')),
    format,
    panel: stringFlag(input.flags, 'panel'),
    refreshTier: stringFlag(input.flags, 'refreshTier'),
    resolution: stringFlag(input.flags, 'resolution'),
    mbForm: stringFlag(input.flags, 'mbForm'),
    mbDimm: stringFlag(input.flags, 'mbDimm'),
    mbWifi: stringFlag(input.flags, 'mbWifi'),
    mbDdr: stringFlag(input.flags, 'mbDdr'),
    mbLan: stringFlag(input.flags, 'mbLan'),
  };
}

function stringFlag(flags: Map<string, string | boolean>, key: string): string | undefined {
  const value = flags.get(key);
  return typeof value === 'string' ? value : undefined;
}

function numberFlag(flags: Map<string, string | boolean>, key: string): number | undefined {
  const raw = stringFlag(flags, key);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new UsageError(`${key} 必須是數字：${raw}`);
  return value;
}

function parseSource(value?: string): SourceName | undefined {
  if (!value) return undefined;
  if (value === 'coolpc' || value === 'sinya' || value === 'autobuy') return value;
  throw new UsageError(`source 只能是 coolpc / sinya / autobuy：${value}`);
}

function parseSort(value?: string): SortKey | undefined {
  if (!value) return undefined;
  if (value === 'price_asc' || value === 'price_desc' || value === 'name' || value === 'updated') {
    return value;
  }
  throw new UsageError(`sort 只能是 price_asc / price_desc / name / updated：${value}`);
}

function resolveFormat(flags: Map<string, string | boolean>): OutputFormat {
  if (flags.has('table')) return 'table';
  if (flags.has('pretty')) return 'pretty';
  if (flags.has('json')) return 'json';
  const raw = stringFlag(flags, 'format');
  if (!raw) return 'json';
  if (raw === 'json' || raw === 'pretty' || raw === 'table') return raw;
  throw new UsageError(`format 只能是 json / pretty / table：${raw}`);
}

export const HELP_TEXT = `pcprice — 台灣全新電腦零件比價（原價屋 / 欣亞 / Autobuy）

用法：
  pcprice search [關鍵字] [選項]
  pcprice show <id>
  pcprice history <商品id>
  pcprice categories [分類]
  pcprice brands <分類>
  pcprice health
  pcprice sources
  pcprice refresh [coolpc|sinya|autobuy]
  pcprice schema

搜尋選項：
  -q, --query TEXT          關鍵字（也可當位置參數）
  -c, --category CAT        cpu gpu motherboard ram ssd hdd psu case cooler
                            monitor keyboard mouse headset speaker fan
                            network cable os package
  --subcategory TEXT        多層子分類前綴，例如 "AM5 > X870"
  -b, --brand TEXT          品牌
  --source coolpc|sinya|autobuy
  --price-min N --price-max N
  --in-stock                只看至少一家有貨
  --parts-only              排除整機／組合／搭購價
  --multi                   只看跨店可比價
  --sort price_asc|price_desc|name|updated
  --page N --limit N        預設 page=1 limit=15
  --panel --refresh-tier --resolution     螢幕 facet
  --mb-form --mb-dimm --mb-wifi --mb-ddr --mb-lan

連線：
  --url URL     指定 API（預設試 http://127.0.0.1:3000）
  --db PATH     指定 SQLite
  --offline     不走 HTTP，只讀本機 DB

輸出（預設 json，給 Agent 用）：
  --format json|pretty|table
  --json --pretty --table

例子：
  pcprice search 9800X3D --in-stock --sort price_asc
  pcprice search --category gpu --q "5070 Ti" --limit 10
  pcprice show mg-xxxx
  pcprice categories cpu
  pcprice refresh
`;
