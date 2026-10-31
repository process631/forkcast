/** Absolute http(s) URL, or undefined. Recipe links come from a third party, so other schemes are dropped. */
export function httpUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

/** An image src that is safe to put on an <img>: remote http(s), a blob URL, or an image data URL. */
export function safeImageSrc(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const src = value.trim();
  if (src.startsWith('blob:') || /^data:image\/[a-z0-9.+-]+;/i.test(src)) return src;
  return httpUrl(src);
}

/** YouTube video ids are 11 characters. Anything else must not be interpolated into an embed URL. */
export const YOUTUBE_ID = /^[\w-]{11}$/;
