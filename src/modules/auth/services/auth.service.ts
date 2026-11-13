import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { validateEnv } from '../../../config/env.config';
import { generateUuidV7 } from '../../../common/utils/uuid';
import { AuditService } from '../../audit/services/audit.service';
import { AuthDomain, JwtUserPayload, UserSessionProfile } from '../domain/auth.domain';
import { ChangePasswordDto, LoginDto } from '../dto/auth.dto';
import { AuthRepository } from '../repositories/auth.repository';

@Injectable()
export class AuthService {
  private readonly env = validateEnv();

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly auditService: AuditService,
  ) {}

  async login(
    dto: LoginDto,
    meta: { ip?: string; userAgent?: string; requestId?: string },
  ) {
    const user = await this.authRepository.findUserByUsername(dto.username);

    if (!user) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Username atau password salah.',
      });
    }

    if (!user.is_active) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_INACTIVE',
        message: 'Akun dinonaktifkan. Hubungi administrator.',
      });
    }

    if (AuthDomain.isAccountLocked(user.locked_until)) {
      const lockUntil = new Date(user.locked_until!).toLocaleTimeString('id-ID');
      throw new ForbiddenException({
        code: 'ACCOUNT_LOCKED',
        message: `Akun terkunci sementara karena 5 kali percobaan gagal. Coba lagi setelah pukul ${lockUntil}.`,
      });
    }

    const isValid = await AuthDomain.verifyPassword(user.password_hash, dto.password);

    if (!isValid) {
      const { newCount, lockedUntil } = await this.authRepository.recordFailedLogin(
        user.id,
        user.failed_login_count,
      );

      if (lockedUntil) {
        await this.auditService.log({
          actor_id: user.id,
          action: 'account_locked',
          entity_type: 'users',
          entity_id: user.id,
          request_id: meta.requestId,
          ip: meta.ip,
          new_values: { failed_login_count: newCount, locked_until: lockedUntil },
        });

        throw new ForbiddenException({
          code: 'ACCOUNT_LOCKED',
          message: 'Akun terkunci sementara karena 5 kali percobaan gagal.',
        });
      }

      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Username atau password salah.',
      });
    }

    // Success
    await this.authRepository.resetFailedLogin(user.id);

    const payload: JwtUserPayload = {
      sub: user.id,
      username: user.username,
      must_change_password: user.must_change_password,
    };

    const accessToken = jwt.sign(payload, this.env.JWT_ACCESS_SECRET, {
      expiresIn: this.env.JWT_ACCESS_TTL_SECONDS,
    });

    const rawRefreshToken = randomBytes(40).toString('hex');
    const tokenHash = AuthDomain.hashToken(rawRefreshToken);
    const familyId = generateUuidV7();
    const expiresAt = new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    await this.authRepository.createRefreshToken({
      userId: user.id,
      familyId,
      tokenHash,
      expiresAt,
      userAgent: meta.userAgent,
      ip: meta.ip,
    });

    await this.auditService.log({
      actor_id: user.id,
      action: 'login',
      entity_type: 'users',
      entity_id: user.id,
      request_id: meta.requestId,
      ip: meta.ip,
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: this.env.JWT_ACCESS_TTL_SECONDS,
      mustChangePassword: user.must_change_password,
    };
  }

  async refresh(
    rawRefreshToken: string,
    meta: { ip?: string; userAgent?: string; requestId?: string },
  ) {
    if (!rawRefreshToken) {
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_REQUIRED',
        message: 'Refresh token tidak ditemukan.',
      });
    }

    const tokenHash = AuthDomain.hashToken(rawRefreshToken);
    const stored = await this.authRepository.findRefreshToken(tokenHash);

    if (!stored) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Sesi kedaluwarsa atau tidak valid.',
      });
    }

    // Reuse detection: token has already been revoked or replaced!
    if (stored.revoked_at || stored.replaced_by) {
      await this.authRepository.revokeTokenFamily(stored.family_id);
      await this.auditService.log({
        actor_id: stored.user_id,
        action: 'security_alert_token_reuse',
        entity_type: 'refresh_tokens',
        entity_id: stored.id,
        request_id: meta.requestId,
        ip: meta.ip,
        new_values: { family_id: stored.family_id, revoked_all: true },
      });

      throw new UnauthorizedException({
        code: 'TOKEN_REUSE_DETECTED',
        message: 'Terdeteksi pemakaian ulang token yang tidak sah. Semua sesi dicabut demi keamanan.',
      });
    }

    if (new Date(stored.expires_at).getTime() < Date.now()) {
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_EXPIRED',
        message: 'Sesi telah berakhir. Silakan login kembali.',
      });
    }

    const user = await this.authRepository.findUserById(stored.user_id);
    if (!user || !user.is_active) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_INACTIVE',
        message: 'Akun dinonaktifkan.',
      });
    }

    // Rotate refresh token
    const newRawRefreshToken = randomBytes(40).toString('hex');
    const newTokenHash = AuthDomain.hashToken(newRawRefreshToken);
    const expiresAt = new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    await this.authRepository.rotateRefreshToken(stored.id, {
      userId: user.id,
      familyId: stored.family_id,
      tokenHash: newTokenHash,
      expiresAt,
      userAgent: meta.userAgent,
      ip: meta.ip,
    });

    const payload: JwtUserPayload = {
      sub: user.id,
      username: user.username,
      must_change_password: user.must_change_password,
    };

    const accessToken = jwt.sign(payload, this.env.JWT_ACCESS_SECRET, {
      expiresIn: this.env.JWT_ACCESS_TTL_SECONDS,
    });

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
      expiresIn: this.env.JWT_ACCESS_TTL_SECONDS,
      mustChangePassword: user.must_change_password,
    };
  }

  async logout(rawRefreshToken?: string) {
    if (rawRefreshToken) {
      const tokenHash = AuthDomain.hashToken(rawRefreshToken);
      const stored = await this.authRepository.findRefreshToken(tokenHash);
      if (stored) {
        await this.authRepository.revokeTokenFamily(stored.family_id);
      }
    }
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    meta: { ip?: string; requestId?: string },
  ) {
    const user = await this.authRepository.findUserById(userId);
    if (!user) {
      throw new BadRequestException('Pengguna tidak ditemukan.');
    }

    const isMatch = await AuthDomain.verifyPassword(user.password_hash, dto.old_password);
    if (!isMatch) {
      throw new BadRequestException({
        code: 'OLD_PASSWORD_INCORRECT',
        message: 'Password lama tidak sesuai.',
      });
    }

    const newHash = await AuthDomain.hashPassword(dto.new_password);
    await this.authRepository.updatePassword(userId, newHash);

    await this.auditService.log({
      actor_id: userId,
      action: 'change_password',
      entity_type: 'users',
      entity_id: userId,
      request_id: meta.requestId,
      ip: meta.ip,
    });
  }

  async getMe(userId: string): Promise<UserSessionProfile> {
    const user = await this.authRepository.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException('Pengguna tidak ditemukan.');
    }

    const permissions = await this.authRepository.getUserPermissions(userId);
    const assignments = await this.authRepository.getUserRoleAssignments(userId);

    const roles = assignments.map((a) => ({
      id: a.role_id,
      code: a.role_code,
      name: a.role_name,
      location_id: a.location_id,
    }));

    const assignedLocationIds = Array.from(
      new Set(
        assignments
          .map((a) => a.location_id)
          .filter((locId): locId is string => locId !== null),
      ),
    );

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      must_change_password: user.must_change_password,
      roles,
      permissions,
      assigned_location_ids: assignedLocationIds,
    };
  }
}

