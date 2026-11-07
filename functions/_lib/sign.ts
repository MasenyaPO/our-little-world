const enc = new TextEncoder();

const importKey = (secret: string) =>
  crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

const toB64Url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromB64Url = (s: string) => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};

export async function signMedia(key: string, exp: number, secret: string): Promise<string> {
  const k = await importKey(secret);
  return toB64Url(await crypto.subtle.sign('HMAC', k, enc.encode(`${key}\n${exp}`)));
}

export async function verifyMedia(key: string, exp: number, sig: string, secret: string): Promise<boolean> {
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  try {
    const k = await importKey(secret);
    return await crypto.subtle.verify('HMAC', k, fromB64Url(sig), enc.encode(`${key}\n${exp}`));
  } catch {
    return false;
  }
}
