import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { LocationGuard } from '../../../common/guards/location.guard';
import { AssignUserRolesDto, CreateUserDto, UpdateUserDto } from '../dto/user.dto';
import { UserService } from '../services/user.service';

@ApiTags('Users & RBAC')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, LocationGuard)
@Controller('api/v1')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('users')
  @RequirePermissions('iam.user.manage')
  @ApiOperation({ summary: 'Mendapatkan daftar semua pengguna' })
  async listUsers() {
    return await this.userService.listUsers();
  }

  @Post('users')
  @RequirePermissions('iam.user.manage')
  @ApiOperation({ summary: 'Membuat pengguna baru' })
  async createUser(
    @Body() dto: CreateUserDto,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
  ) {
    const meta = {
      actorId,
      ip: req.ip,
      requestId: (req.headers['x-request-id'] as string) || (req as any).id,
    };
    return await this.userService.createUser(dto, meta);
  }

  @Get('users/:id')
  @RequirePermissions('iam.user.manage')
  @ApiOperation({ summary: 'Mendapatkan detail pengguna' })
  async getUser(@Param('id') id: string) {
    return await this.userService.getUser(id);
  }

  @Patch('users/:id')
  @RequirePermissions('iam.user.manage')
  @ApiOperation({ summary: 'Mengubah profil atau status pengguna' })
  async updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
  ) {
    const meta = {
      actorId,
      ip: req.ip,
      requestId: (req.headers['x-request-id'] as string) || (req as any).id,
    };
    return await this.userService.updateUser(id, dto, meta);
  }

  @Delete('users/:id')
  @RequirePermissions('iam.user.manage')
  @ApiOperation({ summary: 'Menghapus (soft delete) pengguna' })
  async deleteUser(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
  ) {
    const meta = {
      actorId,
      ip: req.ip,
      requestId: (req.headers['x-request-id'] as string) || (req as any).id,
    };
    return await this.userService.softDeleteUser(id, meta);
  }

  @Get('roles')
  @RequirePermissions('iam.user.manage')
  @ApiOperation({ summary: 'Mendapatkan daftar semua peran' })
  async listRoles() {
    return await this.userService.listRoles();
  }

  @Put('users/:id/roles')
  @RequirePermissions('iam.user.manage')
  @ApiOperation({ summary: 'Menetapkan peran dan lokasi untuk pengguna' })
  async assignRoles(
    @Param('id') id: string,
    @Body() dto: AssignUserRolesDto,
    @CurrentUser('id') actorId: string,
    @Req() req: Request,
  ) {
    const meta = {
      actorId,
      ip: req.ip,
      requestId: (req.headers['x-request-id'] as string) || (req as any).id,
    };
    return await this.userService.assignRoles(id, dto, meta);
  }
}

