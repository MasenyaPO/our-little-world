export interface Env {
  MEDIA: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  MEDIA_SIGNING_SECRET: string;
}

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // Cloudflare's request-body limit on free/pro plans

// Only these types are accepted (no SVG/HTML: they can carry scripts).
export const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/3gpp': '3gp',
};

// <relationship uuid>/<random uuid>.<ext>
export const KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$/;
