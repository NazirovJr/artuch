import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { IncomeCategory } from './entities/income-category.entity';
import {
  CreateIncomeCategoryDto,
  UpdateIncomeCategoryDto,
} from './dto/income.dto';

@Injectable()
export class IncomeCategoriesService {
  constructor(
    @InjectRepository(IncomeCategory)
    private readonly repo: Repository<IncomeCategory>,
  ) {}

  findAll(includeInactive = false): Promise<IncomeCategory[]> {
    return this.repo.find({
      where: includeInactive ? {} : { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async create(data: CreateIncomeCategoryDto): Promise<IncomeCategory> {
    const existing = await this.repo.findOne({
      where: { name: ILike(data.name) },
    });
    if (existing) {
      throw new ConflictException(`Категория «${data.name}» уже существует`);
    }
    return this.repo.save(this.repo.create(data));
  }

  async update(
    id: string,
    data: UpdateIncomeCategoryDto,
  ): Promise<IncomeCategory> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Категория доходов не найдена');
    Object.assign(found, data);
    return this.repo.save(found);
  }

  async remove(id: string): Promise<void> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Категория доходов не найдена');
    if (found.isSystem) {
      throw new ConflictException('Системную категорию нельзя удалить');
    }
    found.isActive = false;
    await this.repo.save(found);
  }
}
