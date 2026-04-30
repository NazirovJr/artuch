import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  RemoveEvent,
  UpdateEvent,
} from 'typeorm';

const IMMUTABLE_TABLES = new Set([
  'warehouse_transactions',
  'inventory_movements',
  'stock_movements',
]);

/**
 * Enforces append-only semantics on the stock ledgers. Once a movement is
 * persisted it MUST NOT be edited or deleted — corrections happen by
 * appending a new compensating movement (e.g. a 'return' or 'adjustment').
 * This guarantees the ledger is replayable and gives auditors a tamper-
 * evident history.
 */
@Injectable()
@EventSubscriber()
export class ImmutableLedgerSubscriber
  implements EntitySubscriberInterface<any>
{
  constructor(@InjectDataSource() dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  beforeUpdate(event: UpdateEvent<any>) {
    const table = event.metadata?.tableName;
    if (table && IMMUTABLE_TABLES.has(table)) {
      throw new InternalServerErrorException(
        `Ledger table ${table} is append-only; UPDATE is not allowed. Append a compensating movement instead.`,
      );
    }
  }

  beforeRemove(event: RemoveEvent<any>) {
    const table = event.metadata?.tableName;
    if (table && IMMUTABLE_TABLES.has(table)) {
      throw new InternalServerErrorException(
        `Ledger table ${table} is append-only; DELETE is not allowed.`,
      );
    }
  }
}
