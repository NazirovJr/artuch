import { Injectable } from '@nestjs/common';
import { AbilityBuilder, PureAbility } from '@casl/ability';
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
  | 'all';

export type AppAbility = PureAbility<[Actions, Subjects]>;

@Injectable()
export class CaslAbilityFactory {
  constructor(private rolesService: RolesService) {}

  async createForUser(user: {
    id: string;
    role: string;
  }): Promise<AppAbility> {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(PureAbility);

    try {
      const permissions =
        await this.rolesService.getPermissionsForRole(user.role);

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
    } catch {
      // Role not found in DB — fallback: no permissions
    }

    return build();
  }
}
