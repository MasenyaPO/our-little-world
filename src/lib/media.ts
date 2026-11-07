import { supabase } from './supabaseClient';

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // matches the Cloudflare request limit

export type MediaKind = 'image' | 'video';

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  avif: 'image/avif', heic: 'image/heic', heif: 'image/heif',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', '3gp': 'video/3gpp',
};

/** Some phones report an empty file.type (e.g. HEIC), so fall back to the extension. */
export const mimeOf = (file: File): string => {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXT_TO_MIME[ext] ?? '';
};

export const kindOf = (mime: string): MediaKind | null =>
  mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : null;

const authHeader = async () => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('You are signed out. Please sign in again.');
  return { Authorization: `Bearer ${token}` };
};

/** Shrinks big photos before upload so the 10 GB free R2 tier lasts much longer. */
export async function prepareFile(file: File): Promise<{ blob: Blob; mime: string }> {
  const mime = mimeOf(file);
  const shrinkable = ['image/jpeg', 'image/png', 'image/webp'].includes(mime);
  if (!shrinkable || file.size < 1.5 * 1024 * 1024) return { blob: file, mime };

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const MAX_SIDE = 2560;
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return { blob: file, mime };
    ctx.fillStyle = '#fff'; // PNG transparency becomes white instead of black
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
    if (out && out.size < file.size) return { blob: out, mime: 'image/jpeg' };
  } catch {
    /* unsupported format: just upload the original */
  }
  return { blob: file, mime };
}

export interface UploadResult { key: string; contentType: string; size: number }

/** Uploads through our Cloudflare Function into R2, with progress for big videos. */
export async function uploadMedia(
  blob: Blob,
  mime: string,
  relationshipId: string,
  onProgress?: (fraction: number) => void,
): Promise<UploadResult> {
  if (blob.size > MAX_UPLOAD_BYTES) throw new Error('That file is over 100 MB. Try trimming the video.');
  const headers = await authHeader();

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `/api/media/upload?rid=${encodeURIComponent(relationshipId)}`);
    xhr.setRequestHeader('Authorization', headers.Authorization);
    xhr.setRequestHeader('Content-Type', mime);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      let body: any = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* not json */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as UploadResult);
      else reject(new Error(body.error || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Network error while uploading'));
    xhr.send(blob);
  });
}

/** Turns storage keys into short-lived signed URLs the <img>/<video> tags can load directly. */
export async function signMediaKeys(keys: string[]): Promise<Record<string, string>> {
  if (keys.length === 0) return {};
  const res = await fetch('/api/media/sign', {
    method: 'POST',
    headers: { ...(await authHeader()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ keys }),
  });
  if (!res.ok) return {};
  return (await res.json()).urls ?? {};
}

export async function deleteMediaObject(key: string): Promise<void> {
  try {
    await fetch('/api/media/delete', {
      method: 'POST',
      headers: { ...(await authHeader()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
  } catch {
    /* an orphaned file is harmless; the database row is what matters */
  }
}
