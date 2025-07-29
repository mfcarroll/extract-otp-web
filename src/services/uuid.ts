/**
 * Generates a v4 UUID.
 *
 * This function uses the browser's built-in `crypto.randomUUID()` if available,
 * otherwise it falls back to a simple implementation that uses `Math.random()`.
 *
 * @returns A v4 UUID string.
 */
export function generateUUID(): string {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for insecure contexts or older browsers
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
