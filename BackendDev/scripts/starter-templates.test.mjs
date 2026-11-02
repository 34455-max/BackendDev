import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStarterFiles } from '../starter-templates.js';

test('Supabase Postgres starters generate runnable, owner-scoped Python and Node APIs', t => {
  const dir = mkdtempSync(join(tmpdir(), 'backenddev-starters-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const [language, filename, runtime, args] of [
    ['Python', 'main.py', 'python', ['-m', 'py_compile']],
    ['JavaScript', 'index.js', process.execPath, ['--check']],
  ]) {
    const files = createStarterFiles(language, 'Example API', 'Manage users and products', 'Supabase Postgres');
    const source = files[filename];
    const sourcePath = join(dir, filename);
    writeFileSync(sourcePath, source);
    const result = spawnSync(runtime, [...args, sourcePath], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${language} syntax failed: ${result.stderr}`);
    assert.match(files['migrations/001_initial_schema.sql'], /ENABLE ROW LEVEL SECURITY/);
    assert.match(files['migrations/001_initial_schema.sql'], /auth\.uid\(\) = owner_id/);
    assert.match(source, /SUPABASE_PUBLISHABLE_KEY/);
    assert.match(source, /Authorization/);
    assert.match(source, /access token/);
    assert.doesNotMatch(source, /SUPABASE_SECRET_KEY|service_role/i);
  }
  const python = createStarterFiles('Python', 'Example API', 'Manage users', 'Supabase Postgres')['main.py'];
  assert.match(python, /def handle_api\(self\):/);
  assert.doesNotMatch(python, /def handle\(self\):/);
});

test('unsupported database requests fall back explicitly to the supported SQLite starter', () => {
  const files = createStarterFiles('Go', 'Example API', 'Manage users', 'Supabase Postgres');
  assert.match(files['DATABASE.md'], /does not yet connect/i);
  assert.doesNotMatch(files['README.md'], /per-user .* REST API backed by Supabase Postgres/);
});
