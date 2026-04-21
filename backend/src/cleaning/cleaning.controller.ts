import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CleaningService } from './cleaning.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { Audit } from '../common/decorators/audit.decorator';

@Controller('v2/cleaning')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class CleaningController {
  constructor(private cleaningService: CleaningService) {}

  // ---- Templates ---------------------------------------------------------

  @Get('checklists')
  @CheckPolicies((ability) => ability.can('read', 'CleaningTask'))
  findTemplates() {
    return this.cleaningService.findActiveTemplates();
  }

  // ---- Tasks -------------------------------------------------------------

  @Get('tasks')
  @CheckPolicies((ability) => ability.can('read', 'CleaningTask'))
  findAll(
    @Query('status') status?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('type') type?: string,
    @Query('roomNumber') roomNumber?: string,
  ) {
    return this.cleaningService.findAll({
      status,
      assignedTo,
      type,
      roomNumber: roomNumber ? Number(roomNumber) : undefined,
    });
  }

  @Get('tasks/:id')
  @CheckPolicies((ability) => ability.can('read', 'CleaningTask'))
  findById(@Param('id') id: string) {
    return this.cleaningService.findById(id);
  }

  @Post('tasks')
  @CheckPolicies((ability) => ability.can('create', 'CleaningTask'))
  @Audit('create', 'CleaningTask')
  create(
    @Body()
    body: {
      roomNumber: number;
      type: string;
      reservationId?: string;
      assignedTo?: string;
    },
  ) {
    return this.cleaningService.create(body);
  }

  @Post('tasks/:id/assign')
  @CheckPolicies((ability) => ability.can('update', 'CleaningTask'))
  @Audit('assign', 'CleaningTask')
  assign(
    @Param('id') id: string,
    @Body() body: { userId: string },
    @Req() req: any,
  ) {
    return this.cleaningService.assign(id, body.userId, {
      userId: req.user.id || req.user.sub,
    });
  }

  @Post('tasks/:id/start')
  @CheckPolicies((ability) => ability.can('update', 'CleaningTask'))
  @Audit('start', 'CleaningTask')
  start(@Param('id') id: string, @Req() req: any) {
    return this.cleaningService.start(id, {
      userId: req.user.id || req.user.sub,
    });
  }

  @Post('tasks/:id/submit')
  @CheckPolicies((ability) => ability.can('update', 'CleaningTask'))
  @Audit('submit', 'CleaningTask')
  submit(
    @Param('id') id: string,
    @Body() body: { checklistResult?: any; notes?: string; photos?: string[] },
    @Req() req: any,
  ) {
    return this.cleaningService.submitForReview(
      id,
      { userId: req.user.id || req.user.sub },
      body,
    );
  }

  @Post('tasks/:id/approve')
  @CheckPolicies((ability) => ability.can('update', 'CleaningTask'))
  @Audit('approve', 'CleaningTask')
  approve(@Param('id') id: string, @Req() req: any) {
    return this.cleaningService.approve(id, {
      userId: req.user.id || req.user.sub,
      fullName: req.user.username,
    });
  }

  @Post('tasks/:id/reject')
  @CheckPolicies((ability) => ability.can('update', 'CleaningTask'))
  @Audit('reject', 'CleaningTask')
  reject(
    @Param('id') id: string,
    @Body() body: { notes: string },
    @Req() req: any,
  ) {
    return this.cleaningService.reject(
      id,
      {
        userId: req.user.id || req.user.sub,
        fullName: req.user.username,
      },
      body.notes,
    );
  }

  @Post('tasks/:id/skip')
  @CheckPolicies((ability) => ability.can('update', 'CleaningTask'))
  @Audit('skip', 'CleaningTask')
  skip(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @Req() req: any,
  ) {
    return this.cleaningService.skip(
      id,
      {
        userId: req.user.id || req.user.sub,
        fullName: req.user.username,
      },
      body.reason,
    );
  }

  @Post('tasks/generate-stayovers')
  @CheckPolicies((ability) => ability.can('create', 'CleaningTask'))
  @Audit('generate-stayovers', 'CleaningTask')
  generateStayovers() {
    return this.cleaningService.generateStayoverTasks();
  }
}
