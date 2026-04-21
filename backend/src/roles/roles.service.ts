import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { RolePermission } from './entities/role-permission.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private rolesRepo: Repository<Role>,
    @InjectRepository(RolePermission)
    private permissionsRepo: Repository<RolePermission>,
  ) {}

  findAll(): Promise<Role[]> {
    return this.rolesRepo.find({ relations: ['permissions'] });
  }

  async findById(id: string): Promise<Role> {
    const role = await this.rolesRepo.findOne({ where: { id }, relations: ['permissions'] });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async findByName(name: string): Promise<Role> {
    const role = await this.rolesRepo.findOne({ where: { name }, relations: ['permissions'] });
    if (!role) throw new NotFoundException(`Role "${name}" not found`);
    return role;
  }

  async getPermissionsForRole(roleName: string): Promise<RolePermission[]> {
    const role = await this.findByName(roleName);
    return role.permissions;
  }

  async create(data: Partial<Role>): Promise<Role> {
    const role = this.rolesRepo.create(data);
    return this.rolesRepo.save(role);
  }

  async update(id: string, data: Partial<Role>): Promise<Role> {
    await this.findById(id);
    await this.rolesRepo.update(id, data);
    return this.findById(id);
  }

  async addPermission(roleId: string, permission: Partial<RolePermission>): Promise<RolePermission> {
    await this.findById(roleId);
    const perm = this.permissionsRepo.create({ ...permission, roleId });
    return this.permissionsRepo.save(perm);
  }

  async removePermission(permissionId: string): Promise<void> {
    await this.permissionsRepo.delete(permissionId);
  }
}
