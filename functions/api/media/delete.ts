import type { Env } from '../../_lib/env';
import { KEY_PATTERN } from '../../_lib/env';
import { getRelationshipIds, spaceOfKey } from '../../_lib/auth';
import { HttpError, errorResponse, json } from '../../_lib/http';

// POST /api/media/delete   { key }
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = (await request.json().catch(() => null)) as { key?: unknown } | null;
    const key = typeof body?.key === 'string' ? body.key : '';
    if (!KEY_PATTERN.test(key)) throw new HttpError(400, 'Invalid key');

    const spaces = await getRelationshipIds(request, env);
    if (!spaces.has(spaceOfKey(key))) throw new HttpError(403, 'Not your space');

    await env.MEDIA.delete(key);
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
};
