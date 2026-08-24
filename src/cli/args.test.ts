import { describe, expect, it } from 'vitest';
import { parseArgs, UsageError } from './args.js';

describe('cli args', () => {
  it('把位置參數當搜尋關鍵字，預設 json / limit 15', () => {
    const opts = parseArgs(['search', '9800X3D', '--in-stock', '--parts-only', '--sort', 'price_asc']);
    expect(opts.command).toBe('search');
    expect(opts.query).toBe('9800X3D');
    expect(opts.inStock).toBe(true);
    expect(opts.partsOnly).toBe(true);
    expect(opts.sort).toBe('price_asc');
    expect(opts.format).toBe('json');
    expect(opts.limit).toBe(15);
  });

  it('接受 --q= 與 --table 捷徑', () => {
    const opts = parseArgs(['search', '--q=5070 Ti', '--table', '--limit', '8']);
    expect(opts.query).toBe('5070 Ti');
    expect(opts.format).toBe('table');
    expect(opts.limit).toBe(8);
  });

  it('未知指令或參數要丟 UsageError', () => {
    expect(() => parseArgs(['dance'])).toThrow(UsageError);
    expect(() => parseArgs(['search', '--nope'])).toThrow(UsageError);
    expect(() => parseArgs(['search', '--source', 'shopee'])).toThrow(UsageError);
  });

  it('--help 與無指令都進 help', () => {
    expect(parseArgs(['--help']).command).toBe('help');
    expect(parseArgs([]).command).toBe('help');
  });
});
