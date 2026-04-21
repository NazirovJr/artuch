import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { ManagerApprovalService } from './manager-approval.service';
import { ManagerApprovalGuard } from '../common/guards/manager-approval.guard';

/**
 * Provides ManagerApprovalService and ManagerApprovalGuard globally so any
 * controller can use `@UseGuards(JwtAuthGuard, ManagerApprovalGuard, …)`
 * together with `@RequireManagerPin('reason')`.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [ManagerApprovalService, ManagerApprovalGuard],
  exports: [ManagerApprovalService, ManagerApprovalGuard],
})
export class ManagerApprovalModule {}
