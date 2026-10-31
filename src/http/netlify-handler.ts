// state: draft | engine-generated
import serverless from 'serverless-http';

type LambdaResponse = {
  statusCode: number;
  headers: Record<string, string>;
  multiValueHeaders?: Record<string, string[]>;
  body: string;
  isBase64Encoded: boolean;
};

/** TINA.YUN.HTTP.NETLIFY_REQUEST.v1.LOW.INSTITUTIONAL */
export async function handleNetlifyRequest(
  request: Request,
  context?: { ip?: string }
): Promise<Response> {
  const url = new URL(request.url);
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = request.body?.getReader();
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 256 * 1024) {
          await reader.cancel();
          return Response.json({ success: false, error: 'Payload too large' }, { status: 413 });
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  const bytes = Buffer.concat(chunks);
  const { default: app } = await import('../server');
  const multiValueQueryStringParameters: Record<string, string[]> = {};
  for (const [key, value] of url.searchParams) {
    (multiValueQueryStringParameters[key] ??= []).push(value);
  }
  const result = (await serverless(app, { binary: true })(
    {
      httpMethod: request.method,
      path: url.pathname,
      headers: Object.fromEntries(request.headers),
      multiValueQueryStringParameters,
      body: bytes.toString('base64'),
      isBase64Encoded: true,
      requestContext: { identity: { sourceIp: context?.ip ?? '127.0.0.1' } },
    },
    {}
  )) as LambdaResponse;
  const headers = new Headers(result.headers);
  for (const [key, values] of Object.entries(result.multiValueHeaders ?? {})) {
    headers.delete(key);
    for (const value of values) headers.append(key, value);
  }
  const body =
    request.method === 'HEAD' || [204, 205, 304].includes(result.statusCode)
      ? null
      : Buffer.from(result.body, result.isBase64Encoded ? 'base64' : 'utf8');
  return new Response(body, { status: result.statusCode, headers });
}
