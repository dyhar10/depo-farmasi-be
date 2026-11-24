import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../../audit/services/audit.service';
import { AuthDomain } from '../../auth/domain/auth.domain';
import { AssignUserRolesDto, CreateUserDto, UpdateUserDto } from '../dto/user.dto';
import { UserRepository } from '../repositories/user.repository';
import { UnitOfWork } from '../../../infrastructure/database/unit-of-work';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly auditService: AuditService,
    private readonly uow: UnitOfWork,
  ) {}

  async listUsers() {
    return await this.userRepository.findAll();
  }

  async getUser(id: string) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan.');
    }
    const roles = await this.userRepository.getUserRoleAssignments(id);
    return {
      ...user,
      password_hash: undefined,
      roles,
    };
  }

  async createUser(
    dto: CreateUserDto,
    meta: { actorId: string; ip?: string; requestId?: string },
  ) {
    const existing = await this.userRepository.findByUsername(dto.username);
    if (existing) {
      throw new ConflictException({
        code: 'USERNAME_ALREADY_EXISTS',
        message: 'Username sudah digunakan.',
      });
    }

    const passwordHash = await AuthDomain.hashPassword(dto.password);
    const created = await this.userRepository.create({
      username: dto.username,
      email: dto.email,
      full_name: dto.full_name,
      password_hash: passwordHash,
      must_change_password: dto.must_change_password ?? true,
    });

    await this.auditService.log({
      actor_id: meta.actorId,
      action: 'create',
      entity_type: 'users',
      entity_id: created.id,
      new_values: {
        username: created.username,
        full_name: created.full_name,
        email: created.email,
      },
      request_id: meta.requestId,
      ip: meta.ip,
    });

    return created;
  }

  async updateUser(
    id: string,
    dto: UpdateUserDto,
    meta: { actorId: string; ip?: string; requestId?: string },
  ) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan.');
    }

    // Check last admin rule if deactivating an admin
    if (dto.is_active === false) {
      const userRoles = await this.userRepository.getUserRoleAssignments(id);
      const isAdmin = userRoles.some((r) => r.role_code === 'admin');
      if (isAdmin) {
        const adminCount = await this.userRepository.countAdminUsers();
        if (adminCount <= 1) {
          throw new ForbiddenException({
            code: 'CANNOT_REMOVE_LAST_ADMIN',
            message: 'Tidak dapat menonaktifkan pengguna dengan peran admin terakhir di sistem.',
          });
        }
      }
    }

    const updates: any = {};
    if (dto.full_name !== undefined) updates.full_name = dto.full_name;
    if (dto.email !== undefined) updates.email = dto.email;
    if (dto.is_active !== undefined) updates.is_active = dto.is_active;
    if (dto.password) {
      updates.password_hash = await AuthDomain.hashPassword(dto.password);
    }

    const updated = await this.userRepository.update(id, updates);

    await this.auditService.log({
      actor_id: meta.actorId,
      action: 'update',
      entity_type: 'users',
      entity_id: id,
      old_values: {
        full_name: user.full_name,
        email: user.email,
        is_active: user.is_active,
      },
      new_values: {
        full_name: updated.full_name,
        email: updated.email,
        is_active: updated.is_active,
      },
      request_id: meta.requestId,
      ip: meta.ip,
    });

    return updated;
  }

  async softDeleteUser(
    id: string,
    meta: { actorId: string; ip?: string; requestId?: string },
  ) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan.');
    }

    const userRoles = await this.userRepository.getUserRoleAssignments(id);
    const isAdmin = userRoles.some((r) => r.role_code === 'admin');
    if (isAdmin) {
      const adminCount = await this.userRepository.countAdminUsers();
      if (adminCount <= 1) {
        throw new ForbiddenException({
          code: 'CANNOT_REMOVE_LAST_ADMIN',
          message: 'Tidak dapat menghapus admin terakhir di sistem.',
        });
      }
    }

    await this.userRepository.softDelete(id);

    await this.auditService.log({
      actor_id: meta.actorId,
      action: 'delete',
      entity_type: 'users',
      entity_id: id,
      old_values: { username: user.username, is_active: user.is_active },
      new_values: { is_active: false, deleted: true },
      request_id: meta.requestId,
      ip: meta.ip,
    });

    return { message: 'Pengguna berhasil dihapus.' };
  }

  async listRoles() {
    return await this.userRepository.findAllRoles();
  }

  async assignRoles(
    id: string,
    dto: AssignUserRolesDto,
    meta: { actorId: string; ip?: string; requestId?: string },
  ) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan.');
    }

    const currentRoles = await this.userRepository.getUserRoleAssignments(id);
    const wasAdmin = currentRoles.some((r) => r.role_code === 'admin');

    const allRoles = await this.userRepository.findAllRoles();
    const adminRole = allRoles.find((r) => r.code === 'admin');

    const willBeAdmin = adminRole
      ? dto.assignments.some((a) => a.role_id === adminRole.id)
      : false;

    if (wasAdmin && !willBeAdmin) {
      const adminCount = await this.userRepository.countAdminUsers();
      if (adminCount <= 1) {
        throw new ForbiddenException({
          code: 'CANNOT_REMOVE_LAST_ADMIN',
          message: 'Admin tidak dapat mencabut peran admin terakhir di sistem.',
        });
      }
    }

    await this.uow.run(async (tx) => {
      await this.userRepository.replaceUserRoles(id, dto.assignments, tx);
      await this.auditService.log(
        {
          actor_id: meta.actorId,
          action: 'assign_roles',
          entity_type: 'users',
          entity_id: id,
          old_values: { roles: currentRoles },
          new_values: { assignments: dto.assignments },
          request_id: meta.requestId,
          ip: meta.ip,
        },
        tx,
      );
    });

    return await this.userRepository.getUserRoleAssignments(id);
  }
}

