import type { Env } from '../../_lib/env';
import { ALLOWED_TYPES, MAX_UPLOAD_BYTES } from '../../_lib/env';
import { getRelationshipIds } from '../../_lib/auth';
import { HttpError, errorResponse, json } from '../../_lib/http';

// PUT /api/media/upload?rid=<relationshipId>   body = raw file bytes, Content-Type = file type
export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const rid = new URL(request.url).searchParams.get('rid') ?? '';
    const spaces = await getRelationshipIds(request, env);
    if (!spaces.has(rid)) throw new HttpError(403, 'You are not a member of this space');

    const type = (request.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
    const ext = ALLOWED_TYPES[type];
    if (!ext) throw new HttpError(415, 'This file type is not supported');

    const length = Number(request.headers.get('Content-Length') ?? 0);
    if (!length) throw new HttpError(411, 'Empty upload');
    if (length > MAX_UPLOAD_BYTES) throw new HttpError(413, 'File is too large (100 MB max)');
    if (!request.body) throw new HttpError(400, 'Empty upload');

    const key = `${rid}/${crypto.randomUUID()}.${ext}`;
    await env.MEDIA.put(key, request.body, { httpMetadata: { contentType: type } });

    return json({ key, contentType: type, size: length });
  } catch (e) {
    return errorResponse(e);
  }
};
