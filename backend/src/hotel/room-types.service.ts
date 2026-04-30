import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateRoomTypeDto,
  UpdateRoomTypeDto,
} from './dto/room-type.dto';
import { Room } from './entities/room.entity';
import { RoomType } from './entities/room-type.entity';

@Injectable()
export class RoomTypesService {
  constructor(
    @InjectRepository(RoomType)
    private repo: Repository<RoomType>,
    @InjectRepository(Room)
    private roomsRepo: Repository<Room>,
  ) {}

  findAll(includeInactive = false): Promise<RoomType[]> {
    return this.repo.find({
      where: includeInactive ? {} : { isActive: true },
      order: { displayOrder: 'ASC', name: 'ASC' },
    });
  }

  async findById(id: string): Promise<RoomType> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Room type not found');
    return found;
  }

  async findByCode(code: string): Promise<RoomType | null> {
    return this.repo.findOne({ where: { code } });
  }

  async create(data: CreateRoomTypeDto): Promise<RoomType> {
    const existing = await this.findByCode(data.code);
    if (existing) {
      throw new ConflictException(
        `Room type with code "${data.code}" already exists`,
      );
    }
    const created = this.repo.create({
      ...data,
      photos: data.photos ?? [],
      amenities: data.amenities ?? [],
    });
    return this.repo.save(created);
  }

  async update(id: string, data: UpdateRoomTypeDto): Promise<RoomType> {
    const found = await this.findById(id);
    Object.assign(found, data);
    return this.repo.save(found);
  }

  /**
   * Soft-deactivate. Refuses if any active rooms still reference this
   * type — prevents orphaning the FK + losing the marketing spec while
   * the rooms are bookable.
   */
  async remove(id: string): Promise<void> {
    const found = await this.findById(id);
    const linked = await this.roomsRepo.count({
      where: { roomTypeId: id, isActive: true },
    });
    if (linked > 0) {
      throw new ConflictException(
        `${linked} active room(s) still use this type. Reassign or deactivate them first.`,
      );
    }
    found.isActive = false;
    await this.repo.save(found);
  }

  /**
   * Stats per type — used in the admin grid to show "5 rooms" badge.
   * Returns counts by isActive so admins can see deactivated rooms too.
   */
  async statsByType(): Promise<
    Record<string, { active: number; inactive: number }>
  > {
    const rows: Array<{ roomTypeId: string; isActive: boolean; count: string }> =
      await this.roomsRepo
        .createQueryBuilder('r')
        .select('r.roomTypeId', 'roomTypeId')
        .addSelect('r.isActive', 'isActive')
        .addSelect('COUNT(*)', 'count')
        .where('r.roomTypeId IS NOT NULL')
        .groupBy('r.roomTypeId')
        .addGroupBy('r.isActive')
        .getRawMany();
    const out: Record<string, { active: number; inactive: number }> = {};
    for (const row of rows) {
      const id = row.roomTypeId;
      if (!out[id]) out[id] = { active: 0, inactive: 0 };
      const n = Number(row.count);
      if (row.isActive) out[id].active += n;
      else out[id].inactive += n;
    }
    return out;
  }
}
