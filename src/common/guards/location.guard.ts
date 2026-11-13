import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserSessionProfile } from '../../modules/auth/domain/auth.domain';

@Injectable()
export class LocationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as UserSessionProfile;

    if (!user) {
      return true;
    }

    // Check if user is an admin or has unconstrained role assignment (location_id == null)
    const hasGlobalAccess = user.roles.some((r) => r.location_id === null);
    if (hasGlobalAccess) {
      return true;
    }

    // Check if target location is passed in params, body, or query
    const targetLocationId =
      request.params?.location_id ||
      request.body?.location_id ||
      request.query?.location_id;

    if (targetLocationId) {
      const isAssigned = user.assigned_location_ids.includes(targetLocationId);
      if (!isAssigned) {
        throw new ForbiddenException({
          code: 'LOCATION_ACCESS_DENIED',
          message: 'Anda tidak memiliki wewenang untuk mengakses data lokasi ini.',
        });
      }
    }

    return true;
  }
}

