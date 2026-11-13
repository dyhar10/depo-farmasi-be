import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { UserSessionProfile } from '../../modules/auth/domain/auth.domain';
import { AuditService } from '../../modules/audit/services/audit.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as UserSessionProfile;

    if (!user) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Akses ditolak: pengguna tidak terotentikasi.',
      });
    }

    const hasAll = requiredPermissions.every((perm) =>
      user.permissions.includes(perm),
    );

    if (!hasAll) {
      const requestId = request.headers['x-request-id'] || request.id;
      // Record access denial to audit logs (Acceptance Criteria #4)
      await this.auditService.log({
        actor_id: user.id,
        action: 'access_denied',
        entity_type: 'endpoint',
        old_values: null,
        new_values: {
          path: request.url,
          method: request.method,
          required_permissions: requiredPermissions,
          user_permissions: user.permissions,
        },
        request_id: requestId,
        ip: request.ip,
      });

      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Anda tidak memiliki hak akses untuk tindakan ini.',
      });
    }

    return true;
  }
}

