import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runScan } from '../src/index.js';

function repo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'missing-twin-'));
  git(dir, ['init', '-b', 'main']);
  git(dir, ['config', 'user.name', 'Human']);
  git(dir, ['config', 'user.email', 'human@example.com']);
  return dir;
}

function git(cwd: string, args: string[], env: Record<string, string> = {}): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, ...env } }).trim();
}

function write(cwd: string, file: string, content: string): void {
  fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
  fs.writeFileSync(path.join(cwd, file), content);
}

function commit(cwd: string, message: string, author = 'Human'): void {
  git(cwd, ['add', '.']);
  git(cwd, ['commit', '-m', message], {
    GIT_AUTHOR_NAME: author,
    GIT_AUTHOR_EMAIL: author.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '@example.com',
    GIT_COMMITTER_NAME: author,
    GIT_COMMITTER_EMAIL: author.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '@example.com'
  });
}

describe('missing-twin', () => {
  it('detects a missing companion file from co-change history', async () => {
    const cwd = repo();
    for (let i = 0; i < 5; i += 1) {
      write(cwd, 'openapi/customer.yaml', 'version: ' + i + '\n');
      write(cwd, 'src/generated/customer-client.ts', 'export const version = ' + i + ';\n');
      commit(cwd, 'api/client ' + i);
    }
    const base = git(cwd, ['rev-parse', 'HEAD']);
    write(cwd, 'openapi/customer.yaml', 'version: pr\n');
    commit(cwd, 'change api only');
    const result = await runScan({ base, head: 'HEAD', cwd, configOverrides: { min_support: 4, min_confidence: 0.7, min_lift: 1, max_findings: 5 } });
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.message).toContain('src/generated/customer-client.ts');
  });

  it('ignores bot and huge commits when learning', async () => {
    const cwd = repo();
    for (let i = 0; i < 3; i += 1) {
      write(cwd, 'a.ts', 'a' + i);
      write(cwd, 'b.ts', 'b' + i);
      commit(cwd, 'bot pair ' + i, 'dependabot[bot]');
    }
    const many: string[] = [];
    for (let i = 0; i < 10; i += 1) { const file = 'bulk/' + i + '.ts'; write(cwd, file, String(i)); many.push(file); }
    write(cwd, 'a.ts', 'huge');
    write(cwd, 'b.ts', 'huge');
    commit(cwd, 'huge human commit');
    const base = git(cwd, ['rev-parse', 'HEAD']);
    write(cwd, 'a.ts', 'pr');
    commit(cwd, 'change a');
    const result = await runScan({ base, head: 'HEAD', cwd, configOverrides: { min_support: 2, min_confidence: 0.7, min_lift: 1, max_files_per_commit: 5 } });
    expect(result.findings).toHaveLength(0);
  });

  it('filters low-confidence pairs', async () => {
    const cwd = repo();
    for (let i = 0; i < 2; i += 1) { write(cwd, 'a.ts', 'pair' + i); write(cwd, 'b.ts', 'pair' + i); commit(cwd, 'pair ' + i); }
    for (let i = 0; i < 4; i += 1) { write(cwd, 'a.ts', 'solo' + i); commit(cwd, 'solo ' + i); }
    const base = git(cwd, ['rev-parse', 'HEAD']);
    write(cwd, 'a.ts', 'pr');
    commit(cwd, 'change a');
    const result = await runScan({ base, head: 'HEAD', cwd, configOverrides: { min_support: 2, min_confidence: 0.7, min_lift: 1 } });
    expect(result.findings).toHaveLength(0);
  });
});
