import type { Env } from '../../_lib/env';
import { KEY_PATTERN } from '../../_lib/env';
import { getRelationshipIds, spaceOfKey } from '../../_lib/auth';
import { HttpError, errorResponse, json } from '../../_lib/http';
import { signMedia } from '../../_lib/sign';

const WINDOW = 6 * 60 * 60; // seconds

// POST /api/media/sign   { keys: string[] }  ->  { urls: { [key]: "/api/media/file?..." } }
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = (await request.json().catch(() => null)) as { keys?: unknown } | null;
    const keys = Array.isArray(body?.keys) ? (body!.keys as unknown[]).filter((k): k is string => typeof k === 'string') : [];
    if (keys.length > 200) throw new HttpError(400, 'Too many keys');

    const spaces = await getRelationshipIds(request, env);

    // Expiry is rounded to a fixed window so the same URL is returned for hours,
    // which lets the browser cache images instead of re-downloading them each visit.
    const now = Math.floor(Date.now() / 1000);
    const exp = (Math.floor(now / WINDOW) + 2) * WINDOW;

    const urls: Record<string, string> = {};
    for (const key of keys) {
      if (!KEY_PATTERN.test(key) || !spaces.has(spaceOfKey(key))) continue; // silently skip anything not theirs
      const sig = await signMedia(key, exp, env.MEDIA_SIGNING_SECRET);
      urls[key] = `/api/media/file?key=${encodeURIComponent(key)}&exp=${exp}&sig=${sig}`;
    }
    return json({ urls });
  } catch (e) {
    return errorResponse(e);
  }
};
