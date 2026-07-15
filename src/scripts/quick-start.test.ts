import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cmdPath = resolve(projectRoot, 'start.cmd');
const powerShellPath = resolve(projectRoot, 'start.ps1');

describe('Windows 一鍵啟動腳本', () => {
  it('提供可雙擊的 CMD 入口並轉交 PowerShell 腳本', () => {
    const script = readFileSync(cmdPath, 'utf8');

    expect(script).toContain('powershell.exe');
    expect(script).toContain('-ExecutionPolicy Bypass');
    expect(script).toContain('start.ps1');
  });

  it('涵蓋重複啟動、依賴安裝、健康檢查後開瀏覽器與開發伺服器', () => {
    const script = readFileSync(powerShellPath, 'utf8');

    expect(script).toContain('Test-HealthEndpoint');
    expect(script).toContain('Install-DependenciesIfNeeded');
    expect(script).toContain('Start-BrowserWhenReady');
    expect(script).toContain("@('run', 'dev')");
  });

  it('可用 CheckOnly 模式安全檢查本機啟動條件', () => {
    const result = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        powerShellPath,
        '-CheckOnly',
        '-NoBrowser',
      ],
      {
        cwd: projectRoot,
        encoding: 'utf8',
        env: { ...process.env, PORT: '65530' },
      },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('[OK] Node.js');
    expect(result.stdout).toContain('[OK] npm');
    expect(result.stdout).toContain('[OK] Quick-start check completed.');
  });
});
