import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './users/entities/user.entity';
import { Role } from './roles/entities/role.entity';
import { RolePermission } from './roles/entities/role-permission.entity';
import { InventoryItem } from './inventory/entities/inventory-item.entity';
import { MenuItem } from './restaurant/entities/menu-item.entity';
import { Tour } from './tours/entities/tour.entity';
import { Room } from './hotel/entities/room.entity';
import { WarehouseItem } from './warehouse/entities/warehouse-item.entity';
import { Warehouse } from './warehouses/entities/warehouse.entity';
import { Outlet } from './outlets/entities/outlet.entity';
import { UserOutlet } from './outlets/entities/user-outlet.entity';
import { CleaningChecklistTemplate } from './cleaning/entities/cleaning-checklist-template.entity';

@Injectable()
export class SeedService {
  constructor(private dataSource: DataSource) {}

  async seed() {
    const userRepo = this.dataSource.getRepository(User);
    const roleRepo = this.dataSource.getRepository(Role);

    const roleCount = await roleRepo.count();
    const userCount = await userRepo.count();

    // Always ensure system roles exist — this is cheap and idempotent,
    // and it lets us add new roles (like `owner`) to older databases
    // without resetting anything.
    await this.ensureSystemRoles();

    if (userCount > 0 && roleCount > 0) {
      console.log('Database already seeded, skipping user/data seeding...');
      return;
    }

    console.log('Seeding database...');

    // Seed everything else only if users don't exist
    if (userCount > 0) {
      console.log('Users already exist, skipping user/data seeding...');
      return;
    }

    await this.seedUsers();
    await this.seedOutlets();
    await this.seedWarehouses();
    await this.seedInventory();
    await this.seedMenu();
    await this.seedTours();
    await this.seedRooms();
    await this.seedWarehouse();
    await this.seedCleaningTemplates();

    console.log('Database seeded successfully!');
  }

  /**
   * Idempotent variant of seedRoles: inserts any roles from the canonical
   * list that are missing from the DB and tops up missing permissions on
   * roles that *do* exist. Existing permissions are never touched.
   *
   * Why two passes: the original seed only ran on an empty DB, so roles
   * added later (e.g. `owner`) never reached already-initialised installs.
   * And permissions grow over time too — cashier gains `update Folio` the
   * day POS learns to bill to a room, etc. — so we reconcile both here.
   */
  private async ensureSystemRoles() {
    const roleRepo = this.dataSource.getRepository(Role);
    const permRepo = this.dataSource.getRepository(RolePermission);

    const existingRoles = await roleRepo.find({ relations: ['permissions'] });
    const byName = new Map(existingRoles.map((r) => [r.name, r]));
    const defs = this.canonicalRoleDefs();
    let rolesAdded = 0;
    let permsAdded = 0;

    // Cheap equality for a permission tuple. Conditions are compared via
    // canonical JSON, so `null` and missing match.
    const sameCondJson = (a: any, b: any) =>
      JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

    for (const def of defs) {
      const current = byName.get(def.name);
      const { permissions, ...roleData } = def;

      if (!current) {
        const role = await roleRepo.save(roleRepo.create(roleData));
        for (const perm of permissions) {
          await permRepo.save(
            permRepo.create({
              roleId: role.id,
              action: perm.action,
              subject: perm.subject,
              conditions: (perm as any).conditions || null,
            }),
          );
        }
        rolesAdded += 1;
        continue;
      }

      // Role exists — top up missing permissions only.
      const existingPerms = current.permissions || [];
      for (const perm of permissions) {
        const already = existingPerms.some(
          (p) =>
            p.action === perm.action &&
            p.subject === perm.subject &&
            sameCondJson(p.conditions, (perm as any).conditions),
        );
        if (already) continue;
        await permRepo.save(
          permRepo.create({
            roleId: current.id,
            action: perm.action,
            subject: perm.subject,
            conditions: (perm as any).conditions || null,
          }),
        );
        permsAdded += 1;
      }
    }

    if (rolesAdded > 0) console.log(`  Added ${rolesAdded} missing system role(s)`);
    if (permsAdded > 0) console.log(`  Added ${permsAdded} missing permission(s) on existing roles`);
  }

  private canonicalRoleDefs(): Array<{
    name: string;
    description: string;
    isSystem: boolean;
    permissions: Array<{ action: string; subject: string; conditions?: any }>;
  }> {
    return [
      { name: 'owner', description: 'Владелец — полный доступ ко всей системе', isSystem: true,
        permissions: [{ action: 'manage', subject: 'all' }] },
      { name: 'admin', description: 'Полный доступ ко всей системе', isSystem: true,
        permissions: [{ action: 'manage', subject: 'all' }] },
      { name: 'manager', description: 'Менеджер — POS, заказы, склад, бронирования', isSystem: true,
        permissions: [
          { action: 'manage', subject: 'Transaction' },
          { action: 'manage', subject: 'Refund' },
          { action: 'manage', subject: 'Order' },
          { action: 'manage', subject: 'Warehouse' },
          { action: 'manage', subject: 'Reservation' },
          { action: 'manage', subject: 'Folio' },
          { action: 'manage', subject: 'Rental' },
          { action: 'manage', subject: 'CleaningTask' },
          { action: 'manage', subject: 'Shift' },
          { action: 'read', subject: 'OrderEditLog' },
          { action: 'read', subject: 'Room' },
          { action: 'read', subject: 'User' },
          { action: 'read', subject: 'Outlet' },
          { action: 'read', subject: 'Analytics' },
        ] },
      { name: 'cashier', description: 'Кассир магазина', isSystem: true,
        permissions: [
          { action: 'create', subject: 'Transaction' },
          { action: 'read', subject: 'Transaction', conditions: { employeeId: '${user.id}' } },
          { action: 'read', subject: 'InventoryItem' },
          { action: 'create', subject: 'Refund' },
          { action: 'read', subject: 'Refund' },
          // Post charges onto a guest's folio (e.g. shop purchase billed to room).
          { action: 'read', subject: 'Folio' },
          { action: 'update', subject: 'Folio' },
        ] },
      { name: 'barman', description: 'Бармен', isSystem: true,
        permissions: [
          { action: 'create', subject: 'Transaction' },
          { action: 'read', subject: 'Transaction', conditions: { employeeId: '${user.id}' } },
          { action: 'read', subject: 'InventoryItem' },
          { action: 'create', subject: 'Refund' },
          { action: 'read', subject: 'Refund' },
          // Post charges onto a guest's folio (bar drinks billed to room).
          { action: 'read', subject: 'Folio' },
          { action: 'update', subject: 'Folio' },
        ] },
      { name: 'waiter', description: 'Официант', isSystem: true,
        permissions: [
          { action: 'create', subject: 'Order' },
          { action: 'read', subject: 'Order', conditions: { waiterId: '${user.id}' } },
          { action: 'update', subject: 'Order', conditions: { waiterId: '${user.id}' } },
          { action: 'read', subject: 'MenuItem' },
          // Post restaurant charges onto a guest's folio (meal billed to room).
          { action: 'read', subject: 'Folio' },
          { action: 'update', subject: 'Folio' },
        ] },
      { name: 'cook', description: 'Повар', isSystem: true,
        permissions: [
          { action: 'read', subject: 'Order' },
          { action: 'update', subject: 'Order' },
        ] },
      { name: 'reception', description: 'Ресепшен', isSystem: true,
        permissions: [
          { action: 'manage', subject: 'Room' },
          { action: 'manage', subject: 'Reservation' },
          { action: 'manage', subject: 'Guest' },
          { action: 'manage', subject: 'Folio' },
          { action: 'read', subject: 'CleaningTask' },
          { action: 'create', subject: 'CleaningTask' },
        ] },
      { name: 'cleaning', description: 'Уборка', isSystem: true,
        permissions: [
          { action: 'read', subject: 'Room' },
          { action: 'update', subject: 'Room' },
          { action: 'read', subject: 'CleaningTask' },
          { action: 'update', subject: 'CleaningTask' },
        ] },
      { name: 'warehouse-keeper', description: 'Кладовщик', isSystem: true,
        permissions: [
          { action: 'manage', subject: 'WarehouseItem' },
          { action: 'manage', subject: 'WarehouseTransaction' },
          { action: 'read', subject: 'Warehouse' },
        ] },
      { name: 'rental-operator', description: 'Оператор проката', isSystem: true,
        permissions: [
          { action: 'manage', subject: 'Rental' },
          { action: 'read', subject: 'InventoryItem' },
        ] },
    ];
  }

  private async seedRoles() {
    const roleRepo = this.dataSource.getRepository(Role);
    const permRepo = this.dataSource.getRepository(RolePermission);

    const roleDefs = this.canonicalRoleDefs();

    for (const def of roleDefs) {
      const { permissions, ...roleData } = def;
      const role = await roleRepo.save(roleRepo.create(roleData));
      for (const perm of permissions) {
        await permRepo.save(permRepo.create({
          roleId: role.id,
          action: perm.action,
          subject: perm.subject,
          conditions: (perm as any).conditions || null,
        }));
      }
    }

    console.log(`  Seeded ${roleDefs.length} roles with permissions`);
  }

  private async seedUsers() {
    const repo = this.dataSource.getRepository(User);
    const roleRepo = this.dataSource.getRepository(Role);
    const hash = (pw: string) => bcrypt.hashSync(pw, 12);

    // Build a map of role name -> role id for linking users to roles
    const roles = await roleRepo.find();
    const roleMap = new Map<string, string>();
    for (const r of roles) {
      roleMap.set(r.name, r.id);
    }

    await repo.save([
      // Shop/Bar users
      { username: 'shop', passwordHash: hash('1234'), fullName: 'Продавец магазина', role: 'shop-seller', roleId: roleMap.get('cashier') },
      { username: 'bar', passwordHash: hash('1234'), fullName: 'Бармен', role: 'bartender', roleId: roleMap.get('barman') },
      { username: 'owner', passwordHash: hash('admin'), fullName: 'Владелец', role: 'owner', roleId: roleMap.get('owner'), pin: hash('2222') },
      // Restaurant/Hotel users
      { username: 'waiter1', passwordHash: hash('waiter123'), fullName: 'Фарход', role: 'waiter', roleId: roleMap.get('waiter'), pin: hash('3333') },
      { username: 'waiter2', passwordHash: hash('waiter123'), fullName: 'Малика', role: 'waiter', roleId: roleMap.get('waiter') },
      { username: 'cook1', passwordHash: hash('cook123'), fullName: 'Рустам', role: 'cook', roleId: roleMap.get('cook') },
      { username: 'admin', passwordHash: hash('admin123'), fullName: 'Администратор', role: 'admin', roleId: roleMap.get('admin'), pin: hash('1111') },
      { username: 'warehouse1', passwordHash: hash('warehouse123'), fullName: 'Склад', role: 'warehouse', roleId: roleMap.get('warehouse-keeper') },
      { username: 'reception1', passwordHash: hash('reception123'), fullName: 'Ресепшн', role: 'reception', roleId: roleMap.get('reception') },
      { username: 'cleaning1', passwordHash: hash('cleaning123'), fullName: 'Уборка', role: 'cleaning', roleId: roleMap.get('cleaning') },
      // Tourist
      { username: 'tourist', passwordHash: hash('tourist123'), fullName: 'Иван Петров', role: 'tourist', email: 'ivan.petrov@example.com' },
    ]);
  }

  private async seedOutlets() {
    const outletRepo = this.dataSource.getRepository(Outlet);
    const userOutletRepo = this.dataSource.getRepository(UserOutlet);
    const userRepo = this.dataSource.getRepository(User);

    // Any outlet on a hotel property should be able to post a sale onto a
    // guest's folio — it's a universal "bill to room" workflow, not a
    // per-outlet capability. Flag all four accordingly.
    const outlets = await outletRepo.save([
      { name: 'Магазин снаряжения', type: 'shop', supportsRental: true, supportsFolio: true },
      { name: 'Бар', type: 'bar', supportsFolio: true },
      { name: 'Ресторан', type: 'restaurant', supportsFolio: true },
      { name: 'Прокат', type: 'rental', supportsRental: true, supportsFolio: true },
    ]);

    // Build a map of outlet type -> outlet for user assignments
    const outletByType = new Map<string, Outlet>();
    for (const outlet of outlets) {
      outletByType.set(outlet.type, outlet);
    }

    // Assign users to their respective outlets
    const userAssignments: { username: string; outletType: string }[] = [
      { username: 'shop', outletType: 'shop' },
      { username: 'bar', outletType: 'bar' },
      { username: 'waiter1', outletType: 'restaurant' },
      { username: 'waiter2', outletType: 'restaurant' },
      { username: 'cook1', outletType: 'restaurant' },
    ];

    for (const assignment of userAssignments) {
      const user = await userRepo.findOne({ where: { username: assignment.username } });
      const outlet = outletByType.get(assignment.outletType);
      if (user && outlet) {
        await userOutletRepo.save(userOutletRepo.create({
          userId: user.id,
          outletId: outlet.id,
        }));
      }
    }

    // Admin and owner get assigned to all outlets
    const adminUsers = await userRepo.find({
      where: [{ username: 'admin' }, { username: 'owner' }],
    });
    for (const adminUser of adminUsers) {
      for (const outlet of outlets) {
        await userOutletRepo.save(userOutletRepo.create({
          userId: adminUser.id,
          outletId: outlet.id,
        }));
      }
    }

    console.log(`  Seeded ${outlets.length} outlets with user assignments`);
  }

  private async seedInventory() {
    const repo = this.dataSource.getRepository(InventoryItem);
    await repo.save([
      // Climbing
      { name: 'Альпинистская верёвка 50м', price: 950, purchasePrice: 600, category: 'climbing', barcode: '1001', stock: 12, minStock: 3, unit: 'шт.', soldCount: 8 },
      { name: 'Карабины (набор 5шт)', price: 320, purchasePrice: 180, category: 'climbing', barcode: '1002', stock: 25, minStock: 10, unit: 'набор', soldCount: 15 },
      { name: 'Страховочная система', price: 520, purchasePrice: 320, category: 'climbing', barcode: '1003', stock: 7, minStock: 3, unit: 'шт.', soldCount: 5 },
      { name: 'Ледоруб', price: 650, purchasePrice: 420, category: 'climbing', barcode: '1004', stock: 1, minStock: 3, unit: 'шт.', soldCount: 3 },
      { name: 'Перчатки альпинистские', price: 220, purchasePrice: 120, category: 'climbing', barcode: '1005', stock: 16, minStock: 8, unit: 'пар', soldCount: 22 },
      { name: 'Каска защитная', price: 450, purchasePrice: 280, category: 'climbing', barcode: '1006', stock: 8, minStock: 4, unit: 'шт.', soldCount: 6 },
      // Camping
      { name: 'Палатка 2-местная', price: 1200, purchasePrice: 800, category: 'camping', barcode: '1007', stock: 5, minStock: 3, unit: 'шт.', soldCount: 10 },
      { name: 'Рюкзак 60л', price: 680, purchasePrice: 420, category: 'camping', barcode: '1008', stock: 10, minStock: 5, unit: 'шт.', soldCount: 14 },
      { name: 'Спальный мешок', price: 550, purchasePrice: 350, category: 'camping', barcode: '1009', stock: 8, minStock: 4, unit: 'шт.', soldCount: 12 },
      { name: 'Газовая горелка', price: 380, purchasePrice: 220, category: 'camping', barcode: '1010', stock: 15, minStock: 5, unit: 'шт.', soldCount: 18 },
      { name: 'Коврик туристический', price: 180, purchasePrice: 90, category: 'camping', barcode: '1011', stock: 20, minStock: 8, unit: 'шт.', soldCount: 25 },
      { name: 'Фонарик налобный', price: 150, purchasePrice: 80, category: 'camping', barcode: '1012', stock: 30, minStock: 10, unit: 'шт.', soldCount: 35 },
      { name: 'Палки для трекинга', price: 280, purchasePrice: 160, category: 'camping', barcode: '1013', stock: 14, minStock: 6, unit: 'пар', soldCount: 20 },
      { name: 'Компас', price: 120, purchasePrice: 60, category: 'camping', barcode: '1014', stock: 18, minStock: 8, unit: 'шт.', soldCount: 15 },
      { name: 'Термос 1л', price: 250, purchasePrice: 140, category: 'camping', barcode: '1015', stock: 22, minStock: 10, unit: 'шт.', soldCount: 28 },
      // Clothing
      { name: 'Ботинки трекинговые', price: 780, purchasePrice: 480, category: 'clothing', barcode: '1016', stock: 6, minStock: 4, unit: 'пар', soldCount: 8 },
      { name: 'Термобельё комплект', price: 420, purchasePrice: 250, category: 'clothing', barcode: '1017', stock: 12, minStock: 6, unit: 'компл.', soldCount: 18 },
      { name: 'Куртка ветрозащитная', price: 650, purchasePrice: 400, category: 'clothing', barcode: '1018', stock: 9, minStock: 4, unit: 'шт.', soldCount: 11 },
      { name: 'Носки трекинговые', price: 80, purchasePrice: 35, category: 'clothing', barcode: '1019', stock: 40, minStock: 15, unit: 'пар', soldCount: 52 },
      { name: 'Дождевик', price: 180, purchasePrice: 90, category: 'clothing', barcode: '1020', stock: 15, minStock: 8, unit: 'шт.', soldCount: 20 },
      // Hot drinks
      { name: 'Кофе эспрессо', price: 18, purchasePrice: 6, category: 'hot-drinks', barcode: '2001', stock: 50, minStock: 15, unit: 'порций', soldCount: 85 },
      { name: 'Капучино', price: 24, purchasePrice: 8, category: 'hot-drinks', barcode: '2002', stock: 45, minStock: 15, unit: 'порций', soldCount: 92 },
      { name: 'Латте', price: 26, purchasePrice: 9, category: 'hot-drinks', barcode: '2003', stock: 40, minStock: 15, unit: 'порций', soldCount: 78 },
      { name: 'Горный чай', price: 20, purchasePrice: 5, category: 'hot-drinks', barcode: '2004', stock: 80, minStock: 20, unit: 'порций', soldCount: 110 },
      { name: 'Какао с маршмеллоу', price: 26, purchasePrice: 10, category: 'hot-drinks', barcode: '2005', stock: 30, minStock: 10, unit: 'порций', soldCount: 45 },
      // Напитки
      { name: 'Глинтвейн', price: 40, purchasePrice: 20, category: 'drinks', barcode: '2006', stock: 12, minStock: 5, unit: 'л', soldCount: 18, isDraft: true, pricePerLiter: 80 },
      { name: 'Крафтовое пиво', price: 35, purchasePrice: 18, category: 'drinks', barcode: '2007', stock: 35, minStock: 15, unit: 'бут.', soldCount: 55, isDraft: true, pricePerLiter: 70 },
      { name: 'Виски шотландский', price: 70, purchasePrice: 45, category: 'drinks', barcode: '2008', stock: 8, minStock: 3, unit: 'бут.', soldCount: 12 },
      { name: 'Красное вино (бокал)', price: 48, purchasePrice: 25, category: 'drinks', barcode: '2009', stock: 4, minStock: 5, unit: 'бут.', soldCount: 22, isDraft: true, pricePerLiter: 160 },
      { name: 'Коньяк', price: 60, purchasePrice: 38, category: 'drinks', barcode: '2010', stock: 6, minStock: 3, unit: 'бут.', soldCount: 10 },
      // Cold drinks
      { name: 'Лимонад домашний', price: 18, purchasePrice: 7, category: 'cold-drinks', barcode: '2011', stock: 25, minStock: 10, unit: 'л', soldCount: 45 },
      { name: 'Сок свежевыжатый', price: 22, purchasePrice: 10, category: 'cold-drinks', barcode: '2012', stock: 15, minStock: 8, unit: 'л', soldCount: 38 },
      { name: 'Морс клюквенный', price: 14, purchasePrice: 5, category: 'cold-drinks', barcode: '2013', stock: 20, minStock: 10, unit: 'л', soldCount: 30 },
      { name: 'Минеральная вода', price: 10, purchasePrice: 4, category: 'cold-drinks', barcode: '2014', stock: 60, minStock: 20, unit: 'бут.', soldCount: 95 },
      // Food
      { name: 'Сэндвич клубный', price: 52, purchasePrice: 28, category: 'food', barcode: '2015', stock: 18, minStock: 8, unit: 'шт.', soldCount: 42 },
      { name: 'Суп дня', price: 45, purchasePrice: 20, category: 'food', barcode: '2016', stock: 25, minStock: 10, unit: 'порций', soldCount: 50 },
      { name: 'Паста карбонара', price: 65, purchasePrice: 32, category: 'food', barcode: '2017', stock: 15, minStock: 8, unit: 'порций', soldCount: 35 },
      { name: 'Бургер альпиниста', price: 60, purchasePrice: 30, category: 'food', barcode: '2018', stock: 20, minStock: 10, unit: 'шт.', soldCount: 48 },
      { name: 'Салат цезарь', price: 50, purchasePrice: 25, category: 'food', barcode: '2019', stock: 12, minStock: 8, unit: 'порций', soldCount: 38 },
      { name: 'Стейк из говядины', price: 100, purchasePrice: 60, category: 'food', barcode: '2020', stock: 3, minStock: 5, unit: 'шт.', soldCount: 25 },
      { name: 'Картофель фри', price: 24, purchasePrice: 10, category: 'food', barcode: '2021', stock: 40, minStock: 15, unit: 'порций', soldCount: 75 },
      { name: 'Блины с мёдом', price: 32, purchasePrice: 15, category: 'food', barcode: '2022', stock: 30, minStock: 12, unit: 'порций', soldCount: 52 },
      { name: 'Сырная тарелка', price: 75, purchasePrice: 45, category: 'food', barcode: '2023', stock: 8, minStock: 5, unit: 'шт.', soldCount: 18 },
      { name: 'Пицца маргарита', price: 56, purchasePrice: 28, category: 'food', barcode: '2024', stock: 2, minStock: 6, unit: 'шт.', soldCount: 34 },
    ]);
  }

  private async seedMenu() {
    const repo = this.dataSource.getRepository(MenuItem);
    await repo.save([
      { name: 'Osh (Plov)', nameRu: 'Ош (Плов)', category: 'tajik', price: 45, description: 'Традиционный таджикский плов с бараниной, морковью и специями' },
      { name: 'Qurutob', nameRu: 'Куруто́б', category: 'tajik', price: 38, description: 'Традиционное блюдо из курута с лепёшкой, луком и зеленью' },
      { name: 'Sambusa', nameRu: 'Самбуса', category: 'tajik', price: 25, description: 'Пирожки с мясом и луком, запечённые в тандыре' },
      { name: 'Shashlik', nameRu: 'Шашлык', category: 'tajik', price: 55, description: 'Маринованное мясо на углях' },
      { name: 'Manti', nameRu: 'Манты', category: 'tajik', price: 42, description: 'Большие пельмени на пару с мясной начинкой' },
      { name: 'Lagman', nameRu: 'Лагман', category: 'tajik', price: 40, description: 'Суп-лапша с мясом и овощами' },
      { name: 'Mastoba', nameRu: 'Мастоба', category: 'tajik', price: 35, description: 'Рисовый суп с мясом и овощами' },
      { name: 'Plov with Beef', nameRu: 'Плов с говядиной', category: 'tajik', price: 43, description: 'Плов с нежной говядиной' },
      { name: 'Kabuli Palaw', nameRu: 'Кабули палав', category: 'tajik', price: 48, description: 'Плов с изюмом и морковью по-кабульски' },
      { name: 'Shorpo', nameRu: 'Шурпо', category: 'tajik', price: 37, description: 'Наваристый мясной суп с овощами' },
      { name: 'Fried Sambusa', nameRu: 'Самса жареная', category: 'tajik', price: 28, description: 'Жареные пирожки с мясом' },
      { name: 'Non (Flatbread)', nameRu: 'Нон', category: 'tajik', price: 8, description: 'Традиционная лепёшка из тандыра' },
      { name: 'Grilled Chicken', nameRu: 'Курица гриль', category: 'international', price: 48, description: 'Сочная курица на гриле с травами' },
      { name: 'Caesar Salad', nameRu: 'Салат Цезарь', category: 'international', price: 32, description: 'Классический салат с курицей и пармезаном' },
      { name: 'Pasta Carbonara', nameRu: 'Паста Карбонара', category: 'international', price: 42, description: 'Итальянская паста со сливочным соусом' },
      { name: 'French Fries', nameRu: 'Картофель фри', category: 'international', price: 18, description: 'Хрустящий картофель фри' },
      { name: 'Greek Salad', nameRu: 'Греческий салат', category: 'international', price: 28, description: 'Свежий салат с фетой и оливками' },
      { name: 'Beef Steak', nameRu: 'Стейк из говядины', category: 'international', price: 65, description: 'Стейк средней прожарки' },
      { name: 'Vegetable Soup', nameRu: 'Овощной суп', category: 'international', price: 22, description: 'Лёгкий суп из свежих овощей' },
      { name: 'Club Sandwich', nameRu: 'Клаб-сэндвич', category: 'international', price: 35, description: 'Многослойный сэндвич с курицей' },
      { name: 'Margherita Pizza', nameRu: 'Пицца Маргарита', category: 'international', price: 38, description: 'Классическая пицца с томатом и моцареллой' },
      { name: 'Fish and Chips', nameRu: 'Рыба с картофелем', category: 'international', price: 45, description: 'Рыба в кляре с картофелем фри' },
    ]);
  }

  private async seedTours() {
    const repo = this.dataSource.getRepository(Tour);
    await repo.save([
      {
        categoryId: 'fann', name: 'Алаудинские озёра', duration: '3-5 дней', difficulty: 'easy',
        price: 650, description: 'Треккинг к живописным Алаудинским озёрам в сердце Фанских гор',
        highlights: ['Бирюзовые озёра', 'Горные пейзажи', 'Кемпинг под звёздами'],
        rating: 4.8, reviewCount: 24, groupSize: '4-12 человек', season: 'Июнь - Сентябрь',
      },
      {
        categoryId: 'fann', name: 'Куликалонские озёра', duration: '4-6 дней', difficulty: 'medium',
        price: 780, description: 'Поход к Куликалонским озёрам через живописные перевалы',
        highlights: ['Перевал Алаудин', 'Озеро Куликалон', 'Альпийские луга'],
        rating: 4.7, reviewCount: 18, groupSize: '4-10 человек', season: 'Июнь - Сентябрь',
      },
      {
        categoryId: 'fann', name: 'Пик Энергия 4150м', duration: '7-10 дней', difficulty: 'hard',
        price: 950, description: 'Восхождение на пик Энергия — одну из красивейших вершин Фанских гор',
        highlights: ['Восхождение на 4150м', 'Ледник', 'Панорамные виды'],
        rating: 4.9, reviewCount: 12, groupSize: '2-6 человек', season: 'Июль - Август',
      },
      {
        categoryId: 'pamir', name: 'Памирский тракт — полный маршрут', duration: '12-14 дней', difficulty: 'medium',
        price: 1450, description: 'Легендарное путешествие по одной из самых высокогорных дорог мира',
        highlights: ['Каракуль', 'Мургаб', 'Ваханский коридор', 'Хорог'],
        rating: 4.9, reviewCount: 32, groupSize: '4-8 человек', season: 'Июнь - Сентябрь',
      },
      {
        categoryId: 'pamir', name: 'Ваханский коридор', duration: '8-10 дней', difficulty: 'hard',
        price: 1250, description: 'Путешествие по древнему Ваханскому коридору вдоль границы с Афганистаном',
        highlights: ['Крепости', 'Горячие источники', 'Виды на Гиндукуш'],
        rating: 4.8, reviewCount: 15, groupSize: '4-8 человек', season: 'Июнь - Сентябрь',
      },
      {
        categoryId: 'pamir', name: 'Базовый лагерь пика Ленина', duration: '6-8 дней', difficulty: 'medium',
        price: 980, description: 'Треккинг к базовому лагерю одного из семитысячников',
        highlights: ['Вид на пик Ленина 7134м', 'Поляна Эдельвейсов', 'Ледник'],
        rating: 4.7, reviewCount: 20, groupSize: '4-10 человек', season: 'Июль - Август',
      },
      {
        categoryId: 'cultural', name: 'Великий Шёлковый путь', duration: '7-9 дней', difficulty: 'easy',
        price: 850, description: 'По следам древних караванов через Самарканд, Бухару и Душанбе',
        highlights: ['Исторические города', 'Базары', 'Архитектура'],
        rating: 4.6, reviewCount: 28, groupSize: '4-15 человек', season: 'Март - Ноябрь',
      },
      {
        categoryId: 'fann', name: 'Семь озёр Маргузор', duration: '2-3 дня', difficulty: 'easy',
        price: 350, description: 'Живописная поездка к семи цветным озёрам долины Маргузор',
        highlights: ['Семь озёр', 'Горные деревни', 'Водопады'],
        rating: 4.5, reviewCount: 35, groupSize: '4-15 человек', season: 'Апрель - Октябрь',
      },
    ]);
  }

  private async seedRooms() {
    const repo = this.dataSource.getRepository(Room);
    await repo.save([
      { number: 1, type: 'luxury', beds: 2, maxGuests: 2, pricePerNight: 350, status: 'available', cleaningStatus: 'clean' },
      { number: 2, type: 'luxury', beds: 2, maxGuests: 3, pricePerNight: 400, status: 'available', cleaningStatus: 'clean' },
      { number: 3, type: 'semi-luxury', beds: 2, maxGuests: 2, pricePerNight: 250, status: 'available', cleaningStatus: 'clean' },
      { number: 4, type: 'semi-luxury', beds: 3, maxGuests: 3, pricePerNight: 280, status: 'available', cleaningStatus: 'clean' },
      { number: 5, type: 'economy', beds: 2, maxGuests: 2, pricePerNight: 150, status: 'available', cleaningStatus: 'clean' },
      { number: 6, type: 'economy', beds: 4, maxGuests: 4, pricePerNight: 200, status: 'available', cleaningStatus: 'clean' },
      { number: 7, type: 'economy', beds: 3, maxGuests: 3, pricePerNight: 180, status: 'available', cleaningStatus: 'clean' },
      { number: 8, type: 'luxury', beds: 2, maxGuests: 4, pricePerNight: 450, status: 'available', cleaningStatus: 'clean' },
    ]);
  }

  private async seedWarehouses() {
    const repo = this.dataSource.getRepository(Warehouse);
    await repo.save([
      { name: 'Склад продуктов', type: 'products', description: 'Продовольственные товары и ингредиенты' },
      { name: 'Склад напитков', type: 'beverages', description: 'Напитки, соки, вода' },
      { name: 'Склад снаряжения', type: 'equipment', description: 'Туристическое и альпинистское снаряжение' },
      { name: 'Склад проката', type: 'rental', description: 'Оборудование для проката туристам' },
      { name: 'Общий склад', type: 'general', description: 'Хозяйственные товары и расходные материалы' },
    ]);
    console.log('  Seeded 5 warehouses');
  }

  private async seedWarehouse() {
    const repo = this.dataSource.getRepository(WarehouseItem);
    const warehouseRepo = this.dataSource.getRepository(Warehouse);

    // Build a map of warehouse type -> warehouse id
    const warehouses = await warehouseRepo.find();
    const warehouseMap = new Map<string, string>();
    for (const w of warehouses) {
      warehouseMap.set(w.type, w.id);
    }

    const productsId = warehouseMap.get('products');
    const beveragesId = warehouseMap.get('beverages');
    const generalId = warehouseMap.get('general');

    await repo.save([
      { name: 'Мука', category: 'products', unit: 'кг', quantity: 150, minQuantity: 50, price: 5, warehouseId: productsId },
      { name: 'Рис', category: 'products', unit: 'кг', quantity: 200, minQuantity: 50, price: 8, warehouseId: productsId },
      { name: 'Баранина', category: 'products', unit: 'кг', quantity: 80, minQuantity: 20, price: 45, warehouseId: productsId },
      { name: 'Говядина', category: 'products', unit: 'кг', quantity: 60, minQuantity: 15, price: 40, warehouseId: productsId },
      { name: 'Курица', category: 'products', unit: 'кг', quantity: 100, minQuantity: 25, price: 25, warehouseId: productsId },
      { name: 'Помидоры', category: 'products', unit: 'кг', quantity: 45, minQuantity: 15, price: 12, warehouseId: productsId },
      { name: 'Лук', category: 'products', unit: 'кг', quantity: 35, minQuantity: 10, price: 6, warehouseId: productsId },
      { name: 'Морковь', category: 'products', unit: 'кг', quantity: 40, minQuantity: 10, price: 7, warehouseId: productsId },
      { name: 'Вода минеральная', category: 'beverages', unit: 'л', quantity: 500, minQuantity: 100, price: 2, warehouseId: beveragesId },
      { name: 'Сок', category: 'beverages', unit: 'л', quantity: 150, minQuantity: 30, price: 8, warehouseId: beveragesId },
      { name: 'Кофе', category: 'beverages', unit: 'кг', quantity: 25, minQuantity: 5, price: 80, warehouseId: beveragesId },
      { name: 'Чай', category: 'beverages', unit: 'кг', quantity: 30, minQuantity: 5, price: 50, warehouseId: beveragesId },
      { name: 'Салфетки', category: 'supplies', unit: 'уп', quantity: 100, minQuantity: 30, price: 3, warehouseId: generalId },
      { name: 'Посуда одноразовая', category: 'supplies', unit: 'уп', quantity: 80, minQuantity: 20, price: 15, warehouseId: generalId },
      { name: 'Моющее средство', category: 'supplies', unit: 'л', quantity: 40, minQuantity: 10, price: 12, warehouseId: generalId },
    ]);
  }

  private async seedCleaningTemplates() {
    const repo = this.dataSource.getRepository(CleaningChecklistTemplate);
    await repo.save([
      {
        name: 'Уборка после выезда',
        type: 'departure',
        items: [
          { key: 'beds', label: 'Сменено постельное бельё', required: true },
          { key: 'bathroom', label: 'Помыта ванная и санузел', required: true },
          { key: 'floor', label: 'Помыт пол', required: true },
          { key: 'minibar', label: 'Проверен мини-бар', required: true },
          { key: 'towels', label: 'Заменены полотенца', required: true },
          { key: 'trash', label: 'Вынесен мусор', required: true },
          { key: 'damage', label: 'Проверены повреждения', required: true },
          { key: 'supplies', label: 'Пополнены расходники (мыло, шампунь)', required: false },
        ],
      },
      {
        name: 'Уборка проживающего',
        type: 'stayover',
        items: [
          { key: 'beds', label: 'Заправлены кровати', required: true },
          { key: 'bathroom', label: 'Освежена ванная', required: true },
          { key: 'trash', label: 'Вынесен мусор', required: true },
          { key: 'towels', label: 'Заменены полотенца по запросу', required: false },
          { key: 'supplies', label: 'Пополнены расходники', required: false },
        ],
      },
      {
        name: 'Генеральная уборка',
        type: 'deep',
        items: [
          { key: 'beds', label: 'Полностью переменено бельё', required: true },
          { key: 'bathroom', label: 'Глубокая чистка санузла', required: true },
          { key: 'windows', label: 'Помыты окна', required: true },
          { key: 'furniture', label: 'Протёрта вся мебель', required: true },
          { key: 'carpet', label: 'Почищены ковры', required: true },
          { key: 'aircon', label: 'Проверен кондиционер/обогреватель', required: false },
        ],
      },
    ]);
    console.log('  Seeded 3 cleaning checklist templates');
  }
}
