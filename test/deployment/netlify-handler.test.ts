// state: draft | engine-generated
import { describe, expect, it } from 'vitest';
import { gunzipSync } from 'node:zlib';
import { handleNetlifyRequest } from '../../src/http/netlify-handler';

const request = (path: string, init?: RequestInit) =>
  handleNetlifyRequest(new Request(`https://isabella.example${path}`, init));

describe('Netlify Express adapter', () => {
  it('serves the workspace and its scripts without opening a listener', async () => {
    const response = await request('/');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    const html = await response.text();
    expect(html).toContain('id="chat"');
    expect(html.indexOf('/ui/cognition-client.js')).toBeGreaterThan(-1);
    expect(html.indexOf('/ui/cognition-client.js')).toBeLessThan(html.indexOf('/ui/app.js'));
    const script = await request('/ui/app.js?v=test');
    expect(script.status).toBe(200);
    expect(await script.text()).toContain('window.IsabellaCognition');
    const client = await request('/ui/cognition-client.js?v=test');
    expect(client.status).toBe(200);
    expect(await client.text()).toContain('/api/v1/cognition/route');
    // First request boots the full server module and builds the workspace; under
    // parallel CI load that alone can exceed a minute, so it must sit above the
    // global testTimeout rather than the old 60_000 override that capped it.
  }, 180_000);

  it('preserves cache validation and HEAD semantics', async () => {
    const response = await request('/');
    const cached = await request('/', {
      headers: { 'if-none-match': response.headers.get('etag')! },
    });
    expect(cached.status).toBe(304);
    expect(await cached.text()).toBe('');
    const head = await request('/', { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
  });

  it('serves health and preserves malformed JSON errors', async () => {
    const health = await request('/api/v1/health');
    expect(health.status).toBe(200);
    expect(await health.json()).toHaveProperty('status', 'ok');
    const invalid = await request('/api/v1/cognition/route', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    expect(invalid.status).toBe(400);
  });

  it('preserves compressed binary assets without corrupting bytes', async () => {
    const response = await request('/ui/cognition-client.js', {
      headers: { 'accept-encoding': 'gzip' },
    });
    expect(response.headers.get('content-encoding')).toBe('gzip');
    const script = gunzipSync(Buffer.from(await response.arrayBuffer())).toString('utf8');
    expect(script).toContain('/api/v1/cognition/route');
  });

  it('rejects oversized request bodies', async () => {
    const response = await request('/api/v1/cognition/route', {
      method: 'POST',
      body: 'x'.repeat(256 * 1024 + 1),
    });
    expect(response.status).toBe(413);
  });
});
