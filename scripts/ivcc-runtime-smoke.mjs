import assert from 'node:assert/strict';
import { createServer } from 'node:http';

// Import the compiled server without opening the production listener.
process.env.VERCEL = '1';
process.env.RUNTIME_SMOKE = '1';
const { default: app } = await import('../dist/server.js');
assert.equal(typeof app, 'function', 'Express app must be exported as a request handler');

const server = createServer(app);
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});

const address = server.address();
assert.ok(address && typeof address === 'object', 'smoke server must bind an ephemeral port');
const baseUrl = `http://127.0.0.1:${address.port}`;
const json = async (path, init) => {
  const response = await fetch(baseUrl + path, {
    ...init,
    signal: AbortSignal.timeout(10_000),
  });
  return { status: response.status, body: await response.json() };
};

try {
  const status = await json('/api/v1/ivcc/status');
  assert.equal(status.status, 200, 'IVCC status must be available');
  assert.equal(status.body.engine, 'ivcc-cognitive-voice-core');
  assert.equal(status.body.policy, 'IVCC-ECP-1');
  assert.equal(status.body.tiers.L.breathing, true, 'tier L must include breathing planning');
  assert.equal(status.body.tiers.S.emphasis, false, 'tier S must disclose feature gating');
  assert.ok(
    status.body.notImplemented.includes('neural voice cloning'),
    'status must disclose that neural cloning is not implemented'
  );
  assert.ok(
    status.body.notImplemented.includes('IVCC-S/M/L/X 4B/12B/32B/70B neural weights'),
    'status must not claim neural weights that are not present'
  );
  assert.equal(typeof status.body.persistence.durable, 'boolean');
  assert.equal(status.body.consent.rawBiometricsStored, false);

  const plan = await json('/api/v1/ivcc/plan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      text: 'Hola Isabella, explica el informe urgente con calma y precisión.',
      tier: 'L',
      mode: 'CONVERSACION',
    }),
  });
  assert.equal(plan.status, 200, `plan returned HTTP ${plan.status}: ${JSON.stringify(plan.body)}`);
  assert.equal(plan.body.status, 'planned');
  assert.equal(plan.body.identity.synthetic, true);
  assert.equal(plan.body.identity.cloning, false);
  assert.equal(plan.body.plan.tier, 'L');
  assert.ok(plan.body.plan.units.length > 0, 'plan must produce speech units');
  assert.equal(plan.body.breathing.modeled, false, 'breathing timing is planned, not neural');
  assert.equal(plan.body.authorizationPerformed, false);
  assert.equal(plan.body.executionPerformed, false);
  assert.ok(plan.body.auditSeq > 0, 'planning must append a hash-chained audit event');

  const privatePlan = await json('/api/v1/ivcc/plan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'Lee mi perfil privado', subjectRef: 'person:smoke-runtime' }),
  });
  assert.ok(
    [403, 404].includes(privatePlan.status),
    'public requests must not resolve personal profiles without a usage token'
  );

  const unauthenticated = await json('/api/v1/voice/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ subjectRef: 'person:smoke-runtime', label: 'Smoke' }),
  });
  assert.ok(
    [401, 403, 503].includes(unauthenticated.status),
    'voice profile creation must fail closed without an administrator token'
  );
  assert.equal(unauthenticated.body.success, false);

  const audit = await json('/api/v1/audit');
  assert.ok(
    [401, 403, 503].includes(audit.status),
    'audit access must fail closed without an administrator token'
  );
  assert.equal(audit.body.success, false);

  console.log('IVCC_RUNTIME_SMOKE_OK', {
    engine: status.body.engine,
    tier: plan.body.plan.tier,
    units: plan.body.plan.units.length,
    auditSeq: plan.body.auditSeq,
  });
} finally {
  server.closeAllConnections();
  server.close();
}
// Node's fetch keeps its keep-alive sockets referenced; the smoke process is done.
process.exit(0);
