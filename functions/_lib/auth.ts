import type { Env } from './env';
import { HttpError } from './http';

/**
 * Asks Supabase which spaces the caller belongs to, using the caller's own JWT.
 * Row Level Security does the real work: an invalid token gets a 401, a valid
 * token only ever sees its own relationship_members rows. We never trust an
 * id sent by the browser without checking it against this set.
 */
export async function getRelationshipIds(request: Request, env: Env): Promise<Set<string>> {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) throw new HttpError(401, 'Not signed in');

  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/relationship_members?select=relationship_id`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: auth },
  });
  if (res.status === 401 || res.status === 403) throw new HttpError(401, 'Session expired, please sign in again');
  if (!res.ok) throw new HttpError(502, 'Could not verify your space');

  const rows = (await res.json()) as { relationship_id: string }[];
  return new Set(rows.map((r) => r.relationship_id));
}

export const spaceOfKey = (key: string) => key.split('/')[0];
