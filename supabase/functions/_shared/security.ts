const encoder = new TextEncoder();
export const PASSWORD_ITERATIONS = 600_000;
export const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
export const bytesToBase64 = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const fromBase64 = (value: string) =>
  Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0),
  );
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let difference = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    difference |= (a[i] || 0) ^ (b[i] || 0);
  return difference === 0;
}
export async function digest(value: string): Promise<string> {
  return bytesToBase64(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", encoder.encode(value)),
    ),
  );
}
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(24));
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PASSWORD_ITERATIONS },
    key,
    256,
  );
  return `pbkdf2-sha256:${PASSWORD_ITERATIONS}:${bytesToBase64(salt)}:${bytesToBase64(new Uint8Array(bits))}`;
}
export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  try {
    const [algorithm, rounds, salt64, expected64] = encoded.split(":");
    const iterations = Number(rounds);
    if (
      algorithm !== "pbkdf2-sha256" ||
      iterations < PASSWORD_ITERATIONS ||
      iterations > 1_000_000
    )
      return false;
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const salt = fromBase64(salt64);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations },
      key,
      256,
    );
    return constantTimeEqual(new Uint8Array(bits), fromBase64(expected64));
  } catch {
    return false;
  }
}
export const newToken = () =>
  bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));

// The header MIME is only a hint. Check signatures before accepting active media.
export function matchesFileSignature(bytes: Uint8Array, mime: string): boolean {
  const ascii = (start: number, length: number) =>
    String.fromCharCode(...bytes.slice(start, start + length));
  if (mime === "image/png") return bytes[0] === 137 && ascii(1, 3) === "PNG";
  if (mime === "image/jpeg")
    return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mime === "image/webp")
    return ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP";
  if (mime === "image/gif") return /^GIF8[79]a$/.test(ascii(0, 6));
  if (mime === "image/avif")
    return ascii(4, 4) === "ftyp" && /avif|avis/.test(ascii(8, 24));
  if (mime === "audio/wav" || mime === "audio/x-wav")
    return ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE";
  if (mime === "audio/mpeg")
    return (
      ascii(0, 3) === "ID3" || (bytes[0] === 255 && (bytes[1] & 0xe0) === 0xe0)
    );
  if (mime === "audio/ogg") return ascii(0, 4) === "OggS";
  if (mime === "audio/mp4") return ascii(4, 4) === "ftyp";
  if (mime === "application/pdf") return ascii(0, 5) === "%PDF-";
  if (mime === "application/zip")
    return (
      bytes[0] === 0x50 && bytes[1] === 0x4b && [3, 5, 7].includes(bytes[2])
    );
  if (mime === "text/plain") {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return !bytes.includes(0);
    } catch {
      return false;
    }
  }
  return false;
}
