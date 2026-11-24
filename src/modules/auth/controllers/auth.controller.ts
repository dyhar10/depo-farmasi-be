import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { validateEnv } from '../../../config/env.config';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { UserSessionProfile } from '../domain/auth.domain';
import { AuthResponseDto, ChangePasswordDto, LoginDto } from '../dto/auth.dto';
import { AuthService } from '../services/auth.service';

const REFRESH_COOKIE_NAME = 'depo_refresh_token';

@ApiTags('Auth')
@Controller('api/v1')
export class AuthController {
  private readonly env = validateEnv();

  constructor(private readonly authService: AuthService) {}

  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login pengguna dengan username dan password' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Kredensial tidak valid' })
  @ApiResponse({ status: 403, description: 'Akun terkunci sementara' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const meta = {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: (req.headers['x-request-id'] as string) || (req as any).id,
    };

    const result = await this.authService.login(dto, meta);

    // Set refresh token in httpOnly cookie
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
      httpOnly: true,
      secure: this.env.NODE_ENV === 'production',
      sameSite: 'lax',
      domain: this.env.COOKIE_DOMAIN !== 'localhost' ? this.env.COOKIE_DOMAIN : undefined,
      maxAge: this.env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth',
    });

    return {
      access_token: result.accessToken,
      token_type: 'Bearer',
      expires_in: result.expiresIn,
      must_change_password: result.mustChangePassword,
    };
  }

  @Post('auth/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotasi refresh token dan dapatkan access token baru' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    const meta = {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: (req.headers['x-request-id'] as string) || (req as any).id,
    };

    const result = await this.authService.refresh(rawRefreshToken, meta);

    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
      httpOnly: true,
      secure: this.env.NODE_ENV === 'production',
      sameSite: 'lax',
      domain: this.env.COOKIE_DOMAIN !== 'localhost' ? this.env.COOKIE_DOMAIN : undefined,
      maxAge: this.env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth',
    });

    return {
      access_token: result.accessToken,
      token_type: 'Bearer',
      expires_in: result.expiresIn,
      must_change_password: result.mustChangePassword,
    };
  }

  @Post('auth/logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout dan mencabut refresh token' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    await this.authService.logout(rawRefreshToken);

    res.clearCookie(REFRESH_COOKIE_NAME, {
      path: '/api/v1/auth',
    });

    return { message: 'Logout berhasil.' };
  }

  @Post('auth/change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ganti password pengguna' })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const meta = {
      ip: req.ip,
      requestId: (req.headers['x-request-id'] as string) || (req as any).id,
    };

    await this.authService.changePassword(userId, dto, meta);
    return { message: 'Password berhasil diubah.' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mendapatkan data profil, peran, lokasi, dan hak akses aktif' })
  async getMe(@CurrentUser() user: UserSessionProfile) {
    return user;
  }
}

