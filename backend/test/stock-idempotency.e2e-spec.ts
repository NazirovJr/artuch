import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { InventoryService } from '../src/inventory/inventory.service';
import { StockMovement } from '../src/stock/entities/stock-movement.entity';
import { deterministicUuid } from '../src/common/deterministic-uuid';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reproduces the latent bug where a client-supplied uuid `idempotencyKey` on
 * POST /inventory/movements made the unified-ledger mirror write
 * "<uuid>:inv-mirror" into stock_movements.idempotencyKey (a uuid column),
 * so Postgres threw 22P02 and rolled back the whole request. The mirror now
 * derives a valid uuid from the namespaced key, so the write succeeds.
 *
 * Drives the service directly (the HTTP route is auth-guarded); the bug lives
 * in the DB insert, not the controller, so this exercises the real failure path.
 */
describe('Stock movement idempotency mirror (e2e)', () => {
  let app: INestApplication;
  let inventory: InventoryService;
  let ds: DataSource;
  let itemId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    inventory = app.get(InventoryService);
    ds = app.get(DataSource);

    const item = await inventory.createItem({
      name: `__test_idem_${randomUUID()}`,
      category: 'test',
      unit: 'pcs',
      price: 0,
      purchasePrice: 0,
      stock: 0,
    });
    itemId = item.id;
  }, 60000);

  afterAll(async () => {
    // Raw SQL bypasses the append-only ImmutableLedgerSubscriber, which blocks
    // entity-level DELETE on the ledger tables. This is test teardown removing
    // our own synthetic rows, not tampering with real ledger history.
    if (ds?.isInitialized && itemId) {
      await ds.query('DELETE FROM stock_movements WHERE "itemId" = $1', [itemId]);
      await ds.query('DELETE FROM stock_levels WHERE "itemId" = $1', [itemId]);
      await ds.query('DELETE FROM inventory_movements WHERE "itemId" = $1', [
        itemId,
      ]);
      await ds.query('DELETE FROM inventory_items WHERE id = $1', [itemId]);
    }
    await app?.close();
  });

  it('accepts a movement WITH a uuid idempotencyKey and writes a stock_movements row', async () => {
    const clientKey = randomUUID();

    const movement = await inventory.addMovement({
      itemId,
      type: 'income',
      quantity: 5,
      employeeId: 'test-employee',
      employee: 'Test Employee',
      idempotencyKey: clientKey,
    });
    expect(movement.id).toBeDefined();
    expect(movement.idempotencyKey).toBe(clientKey);

    // The mirror derived a VALID uuid from "<clientKey>:inv-mirror".
    const mirrorKey = deterministicUuid(`${clientKey}:inv-mirror`);
    const rows = await ds
      .getRepository(StockMovement)
      .find({ where: { idempotencyKey: mirrorKey } });
    expect(rows).toHaveLength(1);
    expect(rows[0].itemId).toBe(itemId);
    expect(rows[0].type).toBe('receipt');
    expect(rows[0].idempotencyKey).toMatch(UUID_RE);
  });

  it('is idempotent: re-submitting the same key does not double-write the ledger', async () => {
    const clientKey = randomUUID();

    await inventory.addMovement({
      itemId,
      type: 'income',
      quantity: 3,
      employeeId: 'test-employee',
      employee: 'Test Employee',
      idempotencyKey: clientKey,
    });
    // Retry with the identical key — must be a no-op for the ledger.
    await inventory.addMovement({
      itemId,
      type: 'income',
      quantity: 3,
      employeeId: 'test-employee',
      employee: 'Test Employee',
      idempotencyKey: clientKey,
    });

    const mirrorKey = deterministicUuid(`${clientKey}:inv-mirror`);
    const rows = await ds
      .getRepository(StockMovement)
      .find({ where: { idempotencyKey: mirrorKey } });
    expect(rows).toHaveLength(1);
  });
});
