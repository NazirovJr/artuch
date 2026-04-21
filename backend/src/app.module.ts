import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { databaseConfig } from './config/database.config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ToursModule } from './tours/tours.module';
import { BookingsModule } from './bookings/bookings.module';
import { InventoryModule } from './inventory/inventory.module';
import { PosModule } from './pos/pos.module';
import { RestaurantModule } from './restaurant/restaurant.module';
import { HotelModule } from './hotel/hotel.module';
import { WarehouseModule } from './warehouse/warehouse.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { RolesModule } from './roles/roles.module';
import { CaslModule } from './casl/casl.module';
import { OutletsModule } from './outlets/outlets.module';
import { FoliosModule } from './folios/folios.module';
import { RentalsModule } from './rentals/rentals.module';
import { EventsModule } from './events/events.module';
import { AuditModule } from './audit/audit.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SyncModule } from './sync/sync.module';
import { ShiftsModule } from './shifts/shifts.module';
import { ManagerApprovalModule } from './auth/manager-approval.module';
import { CleaningModule } from './cleaning/cleaning.module';
import { SeedService } from './seed.service';

@Module({
  imports: [
    TypeOrmModule.forRoot(databaseConfig()),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    AuthModule,
    UsersModule,
    ToursModule,
    BookingsModule,
    InventoryModule,
    PosModule,
    RestaurantModule,
    HotelModule,
    WarehouseModule,
    WarehousesModule,
    RolesModule,
    CaslModule,
    OutletsModule,
    FoliosModule,
    RentalsModule,
    EventsModule,
    AuditModule,
    AnalyticsModule,
    NotificationsModule,
    SyncModule,
    ShiftsModule,
    ManagerApprovalModule,
    CleaningModule,
  ],
  providers: [
    SeedService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule implements OnModuleInit {
  constructor(private seedService: SeedService) {}

  async onModuleInit() {
    await this.seedService.seed();
  }
}
