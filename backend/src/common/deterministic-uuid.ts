import { createHash } from 'crypto';

/**
 * Deterministic, RFC-shaped UUID (v5-style) derived from an arbitrary string
 * via SHA-1. Same input → same UUID, so it can seed a uuid idempotency column
 * without pulling in the `uuid` package (which lacks types under this tsconfig).
 */
export function deterministicUuid(input: string): string {
  const h = createHash('sha1').update(input).digest('hex');
  const b = h.slice(0, 32).split('');
  b[12] = '5'; // version 5
  b[16] = ((parseInt(b[16], 16) & 0x3) | 0x8).toString(16); // RFC variant
  const s = b.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

/**
 * Derive a valid uuid idempotency key for a *mirrored* write by namespacing the
 * caller's key with a suffix and hashing the result to a uuid. Returns
 * `undefined` when no key was supplied, leaving the mirror non-idempotent
 * (unchanged from prior behaviour).
 *
 * Why this exists: `stock_movements.idempotencyKey` is typed `uuid`. Mirror
 * paths (inventory/warehouse → unified ledger) namespace the client's key so
 * the legacy and mirror rows don't collide — but a raw `"<uuid>:inv-mirror"`
 * string is not a valid uuid and makes Postgres throw 22P02. Hashing the
 * namespaced string back into a uuid keeps it both valid and stable (a retry
 * with the same client key derives the same uuid, so dedup still works).
 */
export function mirrorIdempotencyKey(
  key: string | undefined,
  suffix: string,
): string | undefined {
  return key ? deterministicUuid(`${key}:${suffix}`) : undefined;
}
