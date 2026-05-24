import { deterministicUuid, mirrorIdempotencyKey } from './deterministic-uuid';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('deterministicUuid', () => {
  it('produces a valid RFC-shaped uuid from an arbitrary string', () => {
    expect(deterministicUuid('anything:goes-here')).toMatch(UUID_RE);
  });

  it('is deterministic — same input maps to the same uuid', () => {
    expect(deterministicUuid('refund-restock:abc:0')).toBe(
      deterministicUuid('refund-restock:abc:0'),
    );
  });

  it('maps different inputs to different uuids', () => {
    expect(deterministicUuid('x:inv-mirror')).not.toBe(
      deterministicUuid('x:wh-mirror'),
    );
  });
});

describe('mirrorIdempotencyKey', () => {
  it('returns undefined when no key is supplied (mirror stays non-idempotent)', () => {
    expect(mirrorIdempotencyKey(undefined, 'inv-mirror')).toBeUndefined();
  });

  // Regression: the old code wrote "<client-uuid>:inv-mirror" straight into
  // stock_movements.idempotencyKey (a uuid column), which Postgres rejected
  // with 22P02. The derived value must be a valid uuid with no suffix in it.
  it('turns a suffixed client uuid into a VALID uuid', () => {
    const clientKey = '11111111-2222-3333-4444-555555555555';
    const derived = mirrorIdempotencyKey(clientKey, 'inv-mirror');
    expect(derived).toMatch(UUID_RE);
    expect(derived).not.toContain('inv-mirror');
  });

  it('namespaces by suffix so inventory and warehouse mirrors never collide', () => {
    const clientKey = '11111111-2222-3333-4444-555555555555';
    expect(mirrorIdempotencyKey(clientKey, 'inv-mirror')).not.toBe(
      mirrorIdempotencyKey(clientKey, 'wh-mirror'),
    );
  });
});
