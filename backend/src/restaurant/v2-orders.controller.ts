import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RestaurantService } from './restaurant.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { ManagerApprovalService } from '../auth/manager-approval.service';

@Controller('v2/orders')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class V2OrdersController {
  constructor(
    private restaurantService: RestaurantService,
    private managerApproval: ManagerApprovalService,
  ) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Order'))
  findAll(@Query('status') status?: string) {
    return this.restaurantService.findAllOrders(status);
  }

  @Get(':id')
  @CheckPolicies((ability) => ability.can('read', 'Order'))
  findOne(@Param('id') id: string) {
    return this.restaurantService.findOrderById(id);
  }

  @Get(':id/edit-logs')
  @CheckPolicies((ability) => ability.can('read', 'Order'))
  findEditLogs(@Param('id') id: string) {
    return this.restaurantService.findOrderEditLogs(id);
  }

  @Post()
  @CheckPolicies((ability) => ability.can('create', 'Order'))
  @Audit('create', 'Order')
  create(@Body() body: any) {
    return this.restaurantService.createOrder(body);
  }

  @Patch(':id/status')
  @CheckPolicies((ability) => ability.can('update', 'Order'))
  @Audit('update-status', 'Order')
  updateStatus(@Param('id') id: string, @Body() body: any) {
    return this.restaurantService.updateOrderStatus(id, body.status);
  }

  /**
   * Replace order items. If the order has already left the waiter's hands
   * (cooking/ready/served/paid), the body must include a valid `managerPin`
   * — we validate it here so a denied PIN never reaches the service or the
   * audit log as a successful edit.
   */
  @Patch(':id/items')
  @CheckPolicies((ability) => ability.can('update', 'Order'))
  @Audit('update-items', 'Order')
  async updateItems(
    @Param('id') id: string,
    @Body() body: { items: any[]; reason?: string; managerPin?: string },
    @Req() req: any,
  ) {
    const order = await this.restaurantService.findOrderById(id);
    let approval: { userId: string; reason: string; approvedAt: Date } | undefined;
    if (
      this.restaurantService.isProtectedStatus(
        order.status,
        order.paymentStatus,
      )
    ) {
      const userId = await this.managerApproval.validatePin(
        body?.managerPin || '',
      );
      approval = {
        userId,
        reason: body?.reason || 'order-edit',
        approvedAt: new Date(),
      };
    }
    return this.restaurantService.updateOrderItems(
      id,
      body.items,
      { userId: req.user.id || req.user.sub, userName: req.user.username },
      { reason: body?.reason, approval },
    );
  }
}
