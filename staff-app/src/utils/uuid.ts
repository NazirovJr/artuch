/**
 * RFC-4122 v4 UUID generator (Math.random-based — fine for idempotency keys
 * and local request ids, not for cryptographic use). Extracted so screens
 * stop each redefining their own copy.
 */
export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
