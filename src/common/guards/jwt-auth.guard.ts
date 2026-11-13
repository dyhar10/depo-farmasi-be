import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { validateEnv } from '../../config/env.config';
import { AuthService } from '../../modules/auth/services/auth.service';
import { JwtUserPayload } from '../../modules/auth/domain/auth.domain';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly env = validateEnv();

  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Token otentikasi tidak ditemukan.',
      });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, this.env.JWT_ACCESS_SECRET) as JwtUserPayload;
      const userProfile = await this.authService.getMe(decoded.sub);
      request.user = userProfile;
      return true;
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedException({
          code: 'TOKEN_EXPIRED',
          message: 'Access token telah kedaluwarsa.',
        });
      }
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Token otentikasi tidak valid.',
      });
    }
  }
}

