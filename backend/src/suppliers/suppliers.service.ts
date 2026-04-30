import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
} from './dto/supplier.dto';
import { Supplier } from './entities/supplier.entity';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private repo: Repository<Supplier>,
  ) {}

  findAll(includeInactive = false): Promise<Supplier[]> {
    return this.repo.find({
      where: includeInactive ? {} : { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findById(id: string): Promise<Supplier> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Supplier not found');
    return found;
  }

  async findByName(name: string): Promise<Supplier | null> {
    return this.repo.findOne({ where: { name: ILike(name) } });
  }

  async create(data: CreateSupplierDto): Promise<Supplier> {
    const existing = await this.findByName(data.name);
    if (existing) {
      throw new ConflictException(
        `Supplier "${data.name}" already exists`,
      );
    }
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, data: UpdateSupplierDto): Promise<Supplier> {
    const found = await this.findById(id);
    Object.assign(found, data);
    return this.repo.save(found);
  }

  async remove(id: string): Promise<void> {
    const found = await this.findById(id);
    found.isActive = false;
    await this.repo.save(found);
  }

  /**
   * Find by name OR create on demand. Used by import flows and the legacy
   * `supplier: string` ingestion path so callers can opt into FK linkage
   * without constructing a Supplier explicitly.
   */
  async ensureByName(name: string): Promise<Supplier> {
    const existing = await this.findByName(name);
    if (existing) return existing;
    return this.repo.save(this.repo.create({ name }));
  }
}
