import type { Env } from '../../_lib/env';
import { KEY_PATTERN } from '../../_lib/env';
import { verifyMedia } from '../../_lib/sign';

// GET /api/media/file?key=&exp=&sig=   (signed, so <img>/<video> tags can load it without headers)
// Supports HTTP Range so videos can seek and stream on iOS/Android.
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const key = url.searchParams.get('key') ?? '';
  const exp = Number(url.searchParams.get('exp'));
  const sig = url.searchParams.get('sig') ?? '';

  if (!KEY_PATTERN.test(key) || !(await verifyMedia(key, exp, sig, env.MEDIA_SIGNING_SECRET))) {
    return new Response('Forbidden', { status: 403 });
  }

  const object = await env.MEDIA.get(key, { range: request.headers });
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'private, max-age=21600');
  headers.set('X-Content-Type-Options', 'nosniff');

  let status = 200;
  if (object.range) {
    const r = object.range as { offset?: number; length?: number };
    const start = r.offset ?? 0;
    const length = r.length ?? object.size - start;
    headers.set('Content-Range', `bytes ${start}-${start + length - 1}/${object.size}`);
    headers.set('Content-Length', String(length));
    status = 206;
  } else {
    headers.set('Content-Length', String(object.size));
  }

  return new Response(object.body, { status, headers });
};
