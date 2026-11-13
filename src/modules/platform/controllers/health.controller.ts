import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { HealthService } from '../services/health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiResponse({ status: 200, description: 'Layanan aktif' })
  async getLive() {
    return await this.healthService.checkLive();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe' })
  @ApiResponse({ status: 200, description: 'Layanan dan dependensi siap' })
  @ApiResponse({ status: 503, description: 'Database atau Redis tidak tersedia' })
  async getReady(@Res({ passthrough: true }) res: Response) {
    const health = await this.healthService.checkReady();
    if (!health.database) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return health;
  }
}

