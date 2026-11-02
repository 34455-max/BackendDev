import { randomUUID } from 'node:crypto';

const MAX_FILES = 150;
const MAX_SOURCE_BYTES = 500_000;
const MAX_OUTPUT = 12_000;
const WORKDIR = '/home/user/backenddev';
const SANDBOX_LIFETIME_MS = 30 * 60 * 1000;

export function hostedRunnerConfigured(env = process.env) {
  return env.E2B_HOSTED_RUNNER === 'true' && Boolean(env.E2B_API_KEY);
}

function validatedProject(language, files) {
  const lang = String(language || '').toLowerCase();
  if (!['javascript', 'python'].includes(lang)) {
    throw Object.assign(Error('Hosted runs currently support JavaScript and Python. Other languages can still run locally.'), { status: 400 });
  }
  if (!files || typeof files !== 'object' || Array.isArray(files) || Object.keys(files).length === 0 || Object.keys(files).length > MAX_FILES) {
    throw Object.assign(Error(`Provide 1–${MAX_FILES} source files.`), { status: 400 });
  }
  let total = 0;
  const safeFiles = {};
  for (const [name, content] of Object.entries(files)) {
    const parts = name.split('/');
    const base = parts.at(-1).toLowerCase();
    if (!name || name.startsWith('/') || name.includes('\\') || name.includes('\0') || parts.some(part => !part || part === '.' || part === '..') || name.includes(':')) {
      throw Object.assign(Error(`Unsafe project file path: ${name}`), { status: 400 });
    }
    if (base === '.env' || (base.startsWith('.env.') && !['.env.example', '.env.sample', '.env.template'].includes(base)) || ['id_rsa', 'id_ed25519', 'credentials.json', 'secrets.json'].includes(base) || /\.(pem|p12|key)$/i.test(base)) {
      throw Object.assign(Error(`Private file ${name} cannot be sent to the hosted runner. Keep secrets out of project source.`), { status: 400 });
    }
    if (typeof content !== 'string') throw Object.assign(Error(`File ${name} must contain text.`), { status: 400 });
    const bytes = Buffer.byteLength(content);
    total += bytes;
    if (bytes > 200_000 || total > MAX_SOURCE_BYTES) throw Object.assign(Error('Hosted projects are limited to 200 KB per file and 500 KB total source.'), { status: 413 });
    safeFiles[name] = content;
  }
  const main = lang === 'python' ? 'main.py' : 'index.js';
  if (!Object.keys(safeFiles).some(name => name.split('/').at(-1) === main)) {
    throw Object.assign(Error(`No ${main} entry file found.`), { status: 400 });
  }
  return { lang, files: safeFiles };
}

async function createSandbox() {
  if (!hostedRunnerConfigured()) throw Object.assign(Error('Hosted runner is not configured. Set E2B_API_KEY and E2B_HOSTED_RUNNER=true on the Render service.'), { status: 503 });
  if (process.env.NODE_ENV === 'test' && process.env.E2B_TEST_MOCK === 'true') return createMockSandbox();
  const { Sandbox } = await import('e2b');
  const options = { timeoutMs: SANDBOX_LIFETIME_MS, metadata: { service: 'BackendDev' } };
  if (process.env.E2B_ALLOW_OUTBOUND !== 'true') options.network = { denyOut: ({ allTraffic }) => [allTraffic] };
  return Sandbox.create(process.env.E2B_TEMPLATE_ID || 'base', options);
}

function createMockSandbox() {
  let killed = false;
  return {
    files: { write: async () => {} },
    commands: {
      run: async (_command, options = {}) => {
        if (options.background) {
          let finish;
          const done = new Promise(resolve => { finish = resolve; });
          return { kill: async () => finish({ exitCode: 0 }), wait: () => done };
        }
        return { exitCode: 0, stdout: 'mock runner ok\n', stderr: '' };
      }
    },
    getHost: port => `${port}-mock.e2b.app`,
    kill: async () => { killed = true; },
    get killed() { return killed; }
  };
}

async function uploadFiles(sandbox, files) {
  await sandbox.commands.run(`mkdir -p ${WORKDIR}`, { timeoutMs: 10_000 });
  for (const [name, content] of Object.entries(files)) await sandbox.files.write(`${WORKDIR}/${name}`, content);
}

function allowedAppOrigins() {
  const origins = new Set();
  for (const value of [process.env.APP_URL, process.env.RENDER_EXTERNAL_URL]) {
    try { if (value) origins.add(new URL(value).origin); } catch {}
  }
  return [...origins].join(',');
}

function taskCommand(lang, task) {
  if (!['run', 'build', 'test'].includes(task)) throw Object.assign(Error('Choose Run, Build, or Test.'), { status: 400 });
  if (lang === 'javascript') {
    if (task === 'run') return 'node index.js';
    if (task === 'build') return 'node --check index.js';
    return 'node --test';
  }
  if (task === 'run') return 'python3 main.py';
  if (task === 'build') return 'python3 -m py_compile main.py';
  return 'python3 -m unittest discover -v';
}

export async function runHostedTask({ language, files, task }) {
  const project = validatedProject(language, files);
  const sandbox = await createSandbox();
  try {
    await uploadFiles(sandbox, project.files);
    const result = await sandbox.commands.run(taskCommand(project.lang, task), {
      cwd: WORKDIR,
      timeoutMs: task === 'run' ? 25_000 : 15_000,
      envs: { PYTHONDONTWRITEBYTECODE: '1' }
    });
    return { exitCode: result.exitCode ?? 1, output: `${result.stdout || ''}${result.stderr || ''}`.slice(0, MAX_OUTPUT) || '(no output)' };
  } finally {
    await sandbox.kill().catch(() => {});
  }
}

export async function startHostedService({ language, files, ownerId }) {
  const project = validatedProject(language, files);
  const sandbox = await createSandbox();
  try {
    await uploadFiles(sandbox, project.files);
    const output = { value: '' };
    const append = chunk => { output.value = (output.value + chunk).slice(-40_000); };
    const handle = await sandbox.commands.run(project.lang === 'python' ? 'python3 main.py' : 'node index.js', {
      background: true,
      cwd: WORKDIR,
      timeoutMs: 20_000,
      envs: { PORT: '3000', HOST: '0.0.0.0', PYTHONDONTWRITEBYTECODE: '1', ...(allowedAppOrigins() ? { ALLOWED_ORIGINS: allowedAppOrigins() } : {}) },
      onStdout: append,
      onStderr: append
    });
    const session = {
      id: randomUUID(), ownerId, sandbox, handle, language: project.lang,
      output, running: true, exitCode: null, startedAt: Date.now(),
      url: `https://${sandbox.getHost(3000)}`
    };
    session.finished = handle.wait().then(result => {
      session.running = false;
      session.exitCode = result.exitCode ?? 1;
    }).catch(error => {
      session.running = false;
      session.exitCode = 1;
      append(`\nRunner error: ${error.message}`);
    }).finally(() => sandbox.kill().catch(() => {}));
    session.lifetime = setTimeout(() => stopHostedService(session), SANDBOX_LIFETIME_MS);
    session.lifetime.unref?.();
    return session;
  } catch (error) {
    await sandbox.kill().catch(() => {});
    throw error;
  }
}

export async function stopHostedService(session) {
  if (!session) return false;
  clearTimeout(session.lifetime);
  try { await session.handle.kill(); } catch {}
  try { await session.sandbox.kill(); } catch {}
  session.running = false;
  return true;
}


