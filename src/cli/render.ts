import type { AgentCard } from '../shared/agent.js';
import type { OutputFormat } from './args.js';

export function render(payload: unknown, format: OutputFormat): string {
  if (format === 'pretty') return `${JSON.stringify(payload, null, 2)}\n`;
  if (format === 'json') return `${JSON.stringify(payload)}\n`;
  return `${renderTable(payload)}\n`;
}

function renderTable(payload: unknown): string {
  if (!isRecord(payload)) return String(payload);
  const data = payload.data;
  if (isRecord(data) && Array.isArray(data.items)) {
    return tableCards(data.items as unknown as AgentCard[], Number(data.total ?? data.items.length));
  }
  if (isRecord(data) && isRecord(data.card)) {
    return tableCards([data.card as unknown as AgentCard], 1);
  }
  return JSON.stringify(payload, null, 2);
}

function tableCards(items: readonly AgentCard[], total: number): string {
  if (items.length === 0) return `（沒有結果，共 ${total} 組）`;
  const rows = [
    ['最低', '最高', '店', '貨', '分類', '名稱', 'id'],
    ...items.map((item) => [
      String(item.lowest),
      String(item.highest),
      String(item.stores.length),
      item.in_stock ? 'Y' : 'N',
      item.category ?? '',
      item.name,
      item.id,
    ]),
  ];
  const widths = rows[0].map((_, col) => Math.max(...rows.map((row) => [...row[col]].length)));
  const lines = rows.map((row, index) => {
    const cells = row.map((cell, col) => pad(cell, widths[col] ?? 0));
    return cells.join('  ');
  });
  lines.splice(1, 0, widths.map((width) => '-'.repeat(width)).join('  '));
  lines.push(`共 ${total} 組，本頁 ${items.length} 張`);
  return lines.join('\n');
}

function pad(text: string, width: number): string {
  const extra = width - [...text].length;
  return extra > 0 ? text + ' '.repeat(extra) : text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
