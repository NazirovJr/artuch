import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CleaningTask } from './entities/cleaning-task.entity';
import { CleaningChecklistTemplate } from './entities/cleaning-checklist-template.entity';
import { Reservation } from '../hotel/entities/reservation.entity';
import { Room } from '../hotel/entities/room.entity';
import { User } from '../users/entities/user.entity';
import { EventsService } from '../events/events.service';

const TERMINAL_STATUSES = ['done', 'skipped'];

@Injectable()
export class CleaningService {
  constructor(
    @InjectRepository(CleaningTask)
    private tasksRepo: Repository<CleaningTask>,
    @InjectRepository(CleaningChecklistTemplate)
    private templatesRepo: Repository<CleaningChecklistTemplate>,
    @InjectRepository(Reservation)
    private reservationsRepo: Repository<Reservation>,
    @InjectRepository(Room)
    private roomsRepo: Repository<Room>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private eventsService: EventsService,
  ) {}

  // ---- Templates ---------------------------------------------------------

  async findActiveTemplates(): Promise<CleaningChecklistTemplate[]> {
    return this.templatesRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async getTemplateForType(
    type: string,
  ): Promise<CleaningChecklistTemplate | null> {
    return this.templatesRepo.findOne({
      where: { type, isActive: true },
    });
  }

  // ---- Tasks -------------------------------------------------------------

  async findAll(filters: {
    status?: string;
    assignedTo?: string;
    type?: string;
    roomNumber?: number;
  } = {}): Promise<CleaningTask[]> {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.assignedTo) where.assignedTo = filters.assignedTo;
    if (filters.type) where.type = filters.type;
    if (filters.roomNumber) where.roomNumber = filters.roomNumber;
    return this.tasksRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<CleaningTask> {
    const task = await this.tasksRepo.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Cleaning task not found');
    return task;
  }

  /**
   * Create a task and broadcast it. Skips creation if there is already an
   * unfinished task of the same type for the same room — prevents duplicate
   * tasks when a reservation is updated multiple times in a row.
   */
  async create(data: {
    roomNumber: number;
    type: string;
    reservationId?: string;
    assignedTo?: string;
    templateId?: string;
  }): Promise<CleaningTask> {
    const existing = await this.tasksRepo.findOne({
      where: {
        roomNumber: data.roomNumber,
        type: data.type,
        status: In(['pending', 'in-progress', 'review']),
      },
    });
    if (existing) return existing;

    let assignedToName: string | null = null;
    if (data.assignedTo) {
      const user = await this.usersRepo.findOne({
        where: { id: data.assignedTo },
      });
      assignedToName = user?.fullName ?? null;
    }

    let templateId = data.templateId;
    if (!templateId) {
      const tpl = await this.getTemplateForType(data.type);
      if (tpl) templateId = tpl.id;
    }

    const task = this.tasksRepo.create({
      roomNumber: data.roomNumber,
      type: data.type,
      reservationId: data.reservationId,
      assignedTo: data.assignedTo,
      assignedToName,
      templateId,
      status: 'pending',
    });
    const saved = await this.tasksRepo.save(task);
    this.eventsService.emitCleaningTaskCreated(saved);
    if (saved.assignedTo) {
      this.eventsService.emitCleaningTaskAssigned(saved);
    }
    return saved;
  }

  async assign(
    taskId: string,
    userId: string,
    actor: { userId: string },
  ): Promise<CleaningTask> {
    const task = await this.findById(taskId);
    if (TERMINAL_STATUSES.includes(task.status)) {
      throw new BadRequestException(
        'Cannot reassign a task that is already done or skipped',
      );
    }
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    task.assignedTo = userId;
    task.assignedToName = user.fullName;
    const saved = await this.tasksRepo.save(task);
    this.eventsService.emitCleaningTaskAssigned(saved);
    return saved;
  }

  async start(
    taskId: string,
    actor: { userId: string },
  ): Promise<CleaningTask> {
    const task = await this.findById(taskId);
    if (task.status !== 'pending') {
      throw new BadRequestException(
        `Task must be pending to start (was ${task.status})`,
      );
    }
    if (task.assignedTo && task.assignedTo !== actor.userId) {
      throw new ForbiddenException('Task is assigned to a different cleaner');
    }
    if (!task.assignedTo) {
      // Auto-claim — first cleaner to start owns the task.
      const user = await this.usersRepo.findOne({
        where: { id: actor.userId },
      });
      task.assignedTo = actor.userId;
      task.assignedToName = user?.fullName ?? null;
    }
    task.status = 'in-progress';
    task.startedAt = new Date();
    const saved = await this.tasksRepo.save(task);
    this.eventsService.emitCleaningTaskStatusChanged(saved);
    return saved;
  }

  /**
   * Cleaner submits the task for inspection. Required checklist items must
   * all have a truthy answer; otherwise the submission is rejected.
   */
  async submitForReview(
    taskId: string,
    actor: { userId: string },
    body: { checklistResult?: any; notes?: string; photos?: string[] },
  ): Promise<CleaningTask> {
    const task = await this.findById(taskId);
    if (task.status !== 'in-progress') {
      throw new BadRequestException(
        `Task must be in-progress to submit (was ${task.status})`,
      );
    }
    if (task.assignedTo && task.assignedTo !== actor.userId) {
      throw new ForbiddenException('Only the assigned cleaner can submit');
    }

    if (task.templateId) {
      const tpl = await this.templatesRepo.findOne({
        where: { id: task.templateId },
      });
      if (tpl) {
        const result = body.checklistResult || {};
        for (const item of tpl.items || []) {
          if (item.required && !result[item.key]) {
            throw new BadRequestException(
              `Checklist item "${item.label}" is required`,
            );
          }
        }
      }
    }

    task.checklistResult = body.checklistResult ?? task.checklistResult;
    task.notes = body.notes ?? task.notes;
    task.photos = body.photos ?? task.photos;
    task.status = 'review';
    const saved = await this.tasksRepo.save(task);
    this.eventsService.emitCleaningTaskStatusChanged(saved);
    return saved;
  }

  async approve(
    taskId: string,
    supervisor: { userId: string; fullName?: string },
  ): Promise<CleaningTask> {
    const task = await this.findById(taskId);
    if (task.status !== 'review') {
      throw new BadRequestException(
        `Task must be in review to approve (was ${task.status})`,
      );
    }
    task.status = 'done';
    task.completedAt = new Date();
    task.supervisorId = supervisor.userId;
    task.supervisorName = supervisor.fullName ?? null;
    task.supervisorApprovedAt = task.completedAt;
    const saved = await this.tasksRepo.save(task);

    // Reflect approved cleaning back onto the room so existing UIs stay in
    // sync (room grid, reception flow).
    await this.roomsRepo.update(task.roomNumber, { cleaningStatus: 'clean' });
    this.eventsService.emitCleaningTaskStatusChanged(saved);
    this.eventsService.emitRoomStatusChanged(
      task.roomNumber,
      (await this.roomsRepo.findOne({ where: { number: task.roomNumber } }))
        ?.status || 'available',
      'clean',
    );
    return saved;
  }

  async reject(
    taskId: string,
    supervisor: { userId: string; fullName?: string },
    notes: string,
  ): Promise<CleaningTask> {
    const task = await this.findById(taskId);
    if (task.status !== 'review') {
      throw new BadRequestException(
        `Task must be in review to reject (was ${task.status})`,
      );
    }
    task.status = 'in-progress';
    task.notes = `${task.notes ? task.notes + '\n' : ''}[Inspection rejected by ${supervisor.fullName}]: ${notes}`;
    task.supervisorId = supervisor.userId;
    task.supervisorName = supervisor.fullName ?? null;
    const saved = await this.tasksRepo.save(task);
    this.eventsService.emitCleaningTaskStatusChanged(saved);
    return saved;
  }

  async skip(
    taskId: string,
    supervisor: { userId: string; fullName?: string },
    reason: string,
  ): Promise<CleaningTask> {
    const task = await this.findById(taskId);
    if (TERMINAL_STATUSES.includes(task.status)) {
      throw new BadRequestException('Task is already in a terminal state');
    }
    if (!reason || !reason.trim()) {
      throw new BadRequestException('Reason is required to skip a task');
    }
    task.status = 'skipped';
    task.completedAt = new Date();
    task.supervisorId = supervisor.userId;
    task.supervisorName = supervisor.fullName ?? null;
    task.notes = `${task.notes ? task.notes + '\n' : ''}[Skipped]: ${reason}`;
    const saved = await this.tasksRepo.save(task);
    this.eventsService.emitCleaningTaskStatusChanged(saved);
    this.eventsService.emitRiskyAction({
      type: 'cleaning-skip',
      severity: 'warning',
      title: `Уборка пропущена (номер ${task.roomNumber})`,
      detail: reason,
      actorId: supervisor.userId,
      actorName: supervisor.fullName,
      subjectId: saved.id,
      subject: 'CleaningTask',
    });
    return saved;
  }

  /**
   * Generate a stayover task per active reservation that doesn't already
   * have a pending/in-progress one for today. Designed to be called by an
   * external cron or scheduler at ~06:00 daily; can also be triggered
   * manually by admin/manager from the staff app.
   */
  async generateStayoverTasks(): Promise<{ created: number }> {
    const active = await this.reservationsRepo.find({
      where: { status: 'checked-in' },
    });
    let created = 0;
    for (const r of active) {
      const result = await this.create({
        roomNumber: r.roomNumber,
        type: 'stayover',
        reservationId: r.id,
      });
      // create() is idempotent — only count when the returned task was made now.
      const isFresh =
        Date.now() - new Date(result.createdAt).getTime() < 5_000;
      if (isFresh) created++;
    }
    return { created };
  }
}
