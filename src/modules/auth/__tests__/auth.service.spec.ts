import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from '../services/auth.service';
import { AuthRepository } from '../repositories/auth.repository';
import { AuditService } from '../../audit/services/audit.service';
import { AuthDomain } from '../domain/auth.domain';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let authRepo: Partial<AuthRepository>;
  let auditService: Partial<AuditService>;

  beforeEach(() => {
    authRepo = {
      findUserByUsername: vi.fn(),
      findUserById: vi.fn(),
      recordFailedLogin: vi.fn(),
      resetFailedLogin: vi.fn(),
      updatePassword: vi.fn(),
      getUserPermissions: vi.fn(),
      getUserRoleAssignments: vi.fn(),
      createRefreshToken: vi.fn(),
      findRefreshToken: vi.fn(),
      revokeTokenFamily: vi.fn(),
      rotateRefreshToken: vi.fn(),
    };

    auditService = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    service = new AuthService(authRepo as AuthRepository, auditService as AuditService);
  });

  describe('login', () => {
    it('harus berhasil login dengan kredensial benar dan mengembalikan token', async () => {
      const password = 'PasswordKuat123!';
      const hash = await AuthDomain.hashPassword(password);

      vi.spyOn(authRepo, 'findUserByUsername').mockResolvedValue({
        id: '018f0000-0000-7000-8000-000000000001',
        username: 'admin',
        email: 'admin@hospital.local',
        full_name: 'Administrator',
        password_hash: hash,
        is_active: true,
        must_change_password: false,
        failed_login_count: 0,
        locked_until: null,
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      });

      const result = await service.login(
        { username: 'admin', password },
        { ip: '127.0.0.1' },
      );

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.mustChangePassword).toBe(false);
      expect(authRepo.resetFailedLogin).toHaveBeenCalledWith('018f0000-0000-7000-8000-000000000001');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'login' }),
      );
    });

    it('harus menolak login dan menambah counter gagal jika password salah', async () => {
      const password = 'PasswordBenar123!';
      const hash = await AuthDomain.hashPassword(password);

      vi.spyOn(authRepo, 'findUserByUsername').mockResolvedValue({
        id: '018f0000-0000-7000-8000-000000000001',
        username: 'admin',
        email: 'admin@hospital.local',
        full_name: 'Administrator',
        password_hash: hash,
        is_active: true,
        must_change_password: false,
        failed_login_count: 2,
        locked_until: null,
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      });

      vi.spyOn(authRepo, 'recordFailedLogin').mockResolvedValue({
        newCount: 3,
        lockedUntil: null,
      });

      await expect(
        service.login(
          { username: 'admin', password: 'PasswordSalah123!' },
          { ip: '127.0.0.1' },
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(authRepo.recordFailedLogin).toHaveBeenCalledWith(
        '018f0000-0000-7000-8000-000000000001',
        2,
      );
    });

    it('harus mengunci akun setelah 5 kali gagal (AC-2 Lockout)', async () => {
      const password = 'PasswordBenar123!';
      const hash = await AuthDomain.hashPassword(password);
      const lockedUntil = new Date(Date.now() + 15 * 60 * 1000);

      vi.spyOn(authRepo, 'findUserByUsername').mockResolvedValue({
        id: '018f0000-0000-7000-8000-000000000001',
        username: 'admin',
        email: 'admin@hospital.local',
        full_name: 'Administrator',
        password_hash: hash,
        is_active: true,
        must_change_password: false,
        failed_login_count: 4,
        locked_until: null,
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      });

      vi.spyOn(authRepo, 'recordFailedLogin').mockResolvedValue({
        newCount: 5,
        lockedUntil,
      });

      await expect(
        service.login(
          { username: 'admin', password: 'PasswordSalah123!' },
          { ip: '127.0.0.1' },
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'account_locked' }),
      );
    });
  });

  describe('refresh token & token reuse detection', () => {
    it('harus mencabut seluruh keluarga token jika mendeteksi penggunaan ulang token lama (AC-3)', async () => {
      const rawToken = 'dummy-old-refresh-token';
      const tokenHash = AuthDomain.hashToken(rawToken);

      vi.spyOn(authRepo, 'findRefreshToken').mockResolvedValue({
        id: '018f0000-0000-7000-8000-000000000010',
        user_id: '018f0000-0000-7000-8000-000000000001',
        family_id: '018f0000-0000-7000-8000-000000000099',
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 100000),
        revoked_at: new Date(Date.now() - 5000), // Sudah direvoke / diganti sebelumnya
        replaced_by: '018f0000-0000-7000-8000-000000000020',
        user_agent: null,
        ip: null,
        created_at: new Date(),
      });

      await expect(
        service.refresh(rawToken, { ip: '127.0.0.1' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(authRepo.revokeTokenFamily).toHaveBeenCalledWith(
        '018f0000-0000-7000-8000-000000000099',
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'security_alert_token_reuse' }),
      );
    });
  });
});

