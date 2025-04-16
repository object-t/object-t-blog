import { Hono } from 'hono'

export interface Env {
  OGP_CACHE: KVNamespace;
  OGP_BUCKET: R2Bucket;
}

const app = new Hono<{ Bindings: Env }>();

const allowedOrigins = ['https://object-t.com', 'http://localhost:5173']

app.use('*', async (c, next) => {
  await next()

  const origin = c.req.header('Origin')
  if (origin && allowedOrigins.includes(origin)) {
    c.header('Access-Control-Allow-Origin', origin)
    c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    c.header('Access-Control-Allow-Headers', 'Content-Type')
    c.header('Vary', 'Origin')
  }
})

app.options('*', (c) => {
  const origin = c.req.header('Origin')
  if (origin && allowedOrigins.includes(origin)) {
    return c.body(null, 204, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    })
  }
  return c.body(null, 204)
})


function extractOGP(html: string): Record<string, string> {
  const og: Record<string, string> = {};
  const regex = /<meta\s+(?:property|name)="og:([^"]+)"\s+content="([^"]+)"\s*\/?>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const key = match[1].trim();
    const value = match[2].trim();
    og[key] = value;
  }
  return og;
}

app.get('/ogp', async (c) => {
  const url = c.req.query('url');
  if (!url) {
    return c.json({ error: 'Missing url parameter' }, 400);
  }

  const kvKey = encodeURIComponent(url);

  const cachedUuid = await c.env.OGP_CACHE.get(kvKey);
  if (cachedUuid) {
    return c.json({ uuid: cachedUuid });
  }

  let html: string;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'OGPFetcherBot/1.0' },
    });
    if (!res.ok) {
      return c.json({ error: 'Failed to fetch url' }, 500);
    }
    html = await res.text();
  } catch (err: any) {
    return c.json({ error: err.message || 'Fetch error' }, 500);
  }

  const ogpInfo = extractOGP(html);

  const uuid = crypto.randomUUID();

  const ogpJson = JSON.stringify(ogpInfo, null, 2);
  await c.env.OGP_BUCKET.put(`${uuid}/ogp.json`, ogpJson, {
    httpMetadata: { contentType: 'application/json' },
  });

  if (ogpInfo.image) {
    try {
      const imgRes = await fetch(ogpInfo.image, {
        headers: { 'User-Agent': 'OGPFetcherBot/1.0' },
      });
      if (imgRes.ok) {
        const imgBuffer = await imgRes.arrayBuffer();
        await c.env.OGP_BUCKET.put(`${uuid}/image.jpg`, imgBuffer, {
          httpMetadata: { contentType: imgRes.headers.get('content-type') || 'image/jpeg' },
        });
      }
    } catch (err) {
      console.error('Image fetch error:', err);
    }
  }

  await c.env.OGP_CACHE.put(kvKey, uuid, { expirationTtl: 604800 });

  return c.json({ uuid });
});

export default app;
