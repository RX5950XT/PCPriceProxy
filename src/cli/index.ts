#!/usr/bin/env node
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HELP_TEXT, UsageError, parseArgs } from './args.js';
import { openBackend } from './backend.js';
import { render } from './render.js';
import { AGENT_OUTPUT_SCHEMA, envelope, fail } from '../shared/agent.js';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

async function main(): Promise<number> {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    return printFail(err, 'json');
  }

  if (opts.command === 'help') {
    process.stdout.write(HELP_TEXT);
    return 0;
  }

  if (opts.command === 'schema') {
    process.stdout.write(render(envelope(AGENT_OUTPUT_SCHEMA), opts.format));
    return 0;
  }

  try {
    const backend = await openBackend(opts, PROJECT_ROOT);
    const data = await dispatch(backend, opts);
    process.stdout.write(render(envelope(data, { via: backend.via }), opts.format));
    return 0;
  } catch (err) {
    return printFail(err, opts.format);
  }
}

async function dispatch(
  backend: Awaited<ReturnType<typeof openBackend>>,
  opts: ReturnType<typeof parseArgs>,
): Promise<unknown> {
  switch (opts.command) {
    case 'search':
      return backend.search(opts);
    case 'show':
      return backend.show(requireId(opts.positionals[0], 'show <id>'));
    case 'history':
      return backend.history(requireId(opts.positionals[0], 'history <商品id>'));
    case 'categories':
      return backend.categories(opts.positionals[0] ?? opts.category);
    case 'brands':
      return backend.brands(
        requireId(opts.positionals[0] ?? opts.category, 'brands <分類>'),
        opts.subcategory,
      );
    case 'health':
      return backend.health();
    case 'sources':
      return backend.sources();
    case 'refresh':
      return backend.refresh(parseOptionalSource(opts.positionals[0]));
    default:
      throw new UsageError(`未實作的指令：${opts.command}`);
  }
}

function requireId(value: string | undefined, usage: string): string {
  if (!value) throw new UsageError(`少了參數。用法：pcprice ${usage}`);
  return value;
}

function parseOptionalSource(value?: string): 'coolpc' | 'sinya' | 'autobuy' | undefined {
  if (!value) return undefined;
  if (value === 'coolpc' || value === 'sinya' || value === 'autobuy') return value;
  throw new UsageError(`refresh 來源只能是 coolpc / sinya / autobuy：${value}`);
}

function printFail(err: unknown, format: 'json' | 'pretty' | 'table'): number {
  const error = err instanceof Error ? err : new Error(String(err));
  const hint = 'hint' in error && typeof error.hint === 'string'
    ? error.hint
    : error instanceof UsageError
      ? 'pcprice --help'
      : undefined;
  const payload = fail(error.message, hint);
  process.stderr.write(render(payload, format === 'table' ? 'pretty' : format));
  return error instanceof UsageError ? 2 : 1;
}

main().then((code) => process.exit(code)).catch((err) => {
  console.error(err);
  process.exit(1);
});
