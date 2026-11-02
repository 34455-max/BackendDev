import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.E2B_API_KEY = 'mock-e2b-key';
process.env.E2B_HOSTED_RUNNER = 'true';
process.env.E2B_TEST_MOCK = 'true';
const { runHostedTask, startHostedService, stopHostedService } = await import('../sandbox-runner.mjs');

test('hosted sandbox runs a one-shot build and returns bounded output', async () => {
  const result = await runHostedTask({ language: 'JavaScript', task: 'build', files: { 'index.js': 'console.log("ok")' } });
  assert.equal(result.exitCode, 0);
  assert.match(result.output, /mock runner ok/);
});

test('hosted service returns an expiring URL and stops cleanly', async () => {
  const session = await startHostedService({ language: 'python', files: { 'main.py': 'print("ready")' }, ownerId: 'user-1' });
  assert.equal(session.running, true);
  assert.match(session.url, /^https:\/\/3000-mock\.e2b\.app$/);
  assert.equal(await stopHostedService(session), true);
  await session.finished;
  assert.equal(session.running, false);
});

test('hosted runner refuses unsupported languages, private secrets, and unsafe paths', async () => {
  await assert.rejects(runHostedTask({ language: 'C++', task: 'build', files: { 'main.cpp': 'int main(){}' } }), /support JavaScript and Python/);
  await assert.rejects(runHostedTask({ language: 'Python', task: 'run', files: { 'main.py': 'pass', '.env': 'TOKEN=secret' } }), /Private file/);
  await assert.rejects(runHostedTask({ language: 'Python', task: 'run', files: { '../main.py': 'pass' } }), /Unsafe project file path/);
});
