import { Injectable } from '@nestjs/common';
import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
} from '@casl/ability';
import { RolesService } from '../roles/roles.service';

export type Actions =
  | 'manage'
  | 'create'
  | 'read'
  | 'update'
  | 'delete';

export type Subjects =
  | 'Transaction'
  | 'Order'
  | 'Room'
  | 'Reservation'
  | 'Guest'
  | 'WarehouseItem'
  | 'WarehouseTransaction'
  | 'StockTransfer'
  | 'Stocktake'
  | 'StocktakeLine'
  | 'LowStockAlert'
  | 'InventoryItem'
  | 'InventoryMovement'
  | 'User'
  | 'MenuItem'
  | 'Folio'
  | 'FolioCharge'
  | 'Rental'
  | 'Refund'
  | 'Role'
  | 'Outlet'
  | 'Warehouse'
  | 'AuditLog'
  | 'Analytics'
  | 'Shift'
  | 'CleaningTask'
  | 'OrderEditLog'
  | 'Supplier'
  | 'RoomType'
  | 'BookingGroup'
  | 'Check'
  | 'Expense'
  | 'ExpenseCategory'
  | 'Income'
  | 'IncomeCategory'
  | 'all';

// MongoAbility ships with a built-in MongoDB-query conditionsMatcher, which
// every role in seed.service.ts uses (e.g. `conditions: { employeeId:
// '${user.id}' }`). Without it, AbilityBuilder.build() throws "You need to
// pass conditionsMatcher option" the moment a single conditional rule is
// added — surfacing as a 500 on every authorised request from cashier /
// waiter / barman, while owner (manage:all, no conditions) stays unaffected.
export type AppAbility = MongoAbility<[Actions, Subjects]>;

/**
 * Some users were seeded with display-style role strings (e.g. 'shop-seller',
 * 'bartender', 'warehouse') while permissions live under canonical names
 * ('cashier', 'barman', 'warehouse-keeper'). New code should use canonical
 * names everywhere; this map keeps existing JWTs working until accounts are
 * re-seeded. Update both this map and seed.service.ts when adding roles.
 */
const ROLE_ALIASES: Record<string, string> = {
  'shop-seller': 'cashier',
  bartender: 'barman',
  warehouse: 'warehouse-keeper',
};

@Injectable()
export class CaslAbilityFactory {
  constructor(private rolesService: RolesService) {}

  async createForUser(user: {
    id: string;
    role: string;
  }): Promise<AppAbility> {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(
      createMongoAbility,
    );

    const candidates = [user.role, ROLE_ALIASES[user.role]].filter(
      Boolean,
    ) as string[];

    for (const candidate of candidates) {
      try {
        const permissions =
          await this.rolesService.getPermissionsForRole(candidate);

        for (const perm of permissions) {
          // Replace ${user.id} placeholders in conditions
          let conditions = perm.conditions;
          if (conditions) {
            const condStr = JSON.stringify(conditions).replace(
              /\$\{user\.id\}/g,
              user.id,
            );
            conditions = JSON.parse(condStr);
          }

          if (perm.inverted) {
            cannot(perm.action as Actions, perm.subject as Subjects);
          } else if (conditions) {
            can(perm.action as Actions, perm.subject as Subjects, conditions);
          } else {
            can(perm.action as Actions, perm.subject as Subjects);
          }
        }
        // First match wins — don't double-apply if both literal and alias
        // resolve.
        break;
      } catch {
        // Try the next candidate
        continue;
      }
    }

    return build();
  }
}
