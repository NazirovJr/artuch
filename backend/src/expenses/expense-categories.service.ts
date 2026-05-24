import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { ExpenseCategory } from './entities/expense-category.entity';
import {
  CreateExpenseCategoryDto,
  UpdateExpenseCategoryDto,
} from './dto/expense.dto';

@Injectable()
export class ExpenseCategoriesService {
  constructor(
    @InjectRepository(ExpenseCategory)
    private readonly repo: Repository<ExpenseCategory>,
  ) {}

  findAll(includeInactive = false): Promise<ExpenseCategory[]> {
    return this.repo.find({
      where: includeInactive ? {} : { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async create(data: CreateExpenseCategoryDto): Promise<ExpenseCategory> {
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
    data: UpdateExpenseCategoryDto,
  ): Promise<ExpenseCategory> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Категория затрат не найдена');
    Object.assign(found, data);
    return this.repo.save(found);
  }

  async remove(id: string): Promise<void> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Категория затрат не найдена');
    if (found.isSystem) {
      throw new ConflictException('Системную категорию нельзя удалить');
    }
    found.isActive = false;
    await this.repo.save(found);
  }
}
