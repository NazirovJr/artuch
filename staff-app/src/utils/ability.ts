import { AbilityBuilder, PureAbility } from '@casl/ability';

type Actions = 'create' | 'read' | 'update' | 'delete' | 'manage';
type Subjects = 'Transaction' | 'Order' | 'Room' | 'Reservation' | 'Guest' | 'WarehouseItem' | 'WarehouseTransaction' | 'User' | 'InventoryItem' | 'MenuItem' | 'Folio' | 'Rental' | 'all';

export type AppAbility = PureAbility<[Actions, Subjects]>;

export function buildAbility(permissions: Array<{ action: string; subject: string; conditions?: any; inverted?: boolean }>): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(PureAbility);

  for (const perm of permissions) {
    if (perm.inverted) {
      cannot(perm.action as Actions, perm.subject as Subjects);
    } else {
      can(perm.action as Actions, perm.subject as Subjects, perm.conditions || undefined);
    }
  }

  return build();
}
