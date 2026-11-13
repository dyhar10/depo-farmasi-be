import * as argon2 from 'argon2';
import { createHash } from 'crypto';

export interface JwtUserPayload {
  sub: string; // user id (UUID v7)
  username: string;
  must_change_password: boolean;
}

export interface UserSessionProfile {
  id: string;
  username: string;
  email: string | null;
  full_name: string;
  must_change_password: boolean;
  roles: Array<{
    id: string;
    code: string;
    name: string;
    location_id: string | null;
  }>;
  permissions: string[];
  assigned_location_ids: string[];
}

export class AuthDomain {
  static async hashPassword(password: string): Promise<string> {
    return await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  }

  static async verifyPassword(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  static isAccountLocked(lockedUntil: Date | null | undefined): boolean {
    if (!lockedUntil) return false;
    return new Date(lockedUntil).getTime() > Date.now();
  }
}

