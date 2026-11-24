import { Controller, Get, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { LocationGuard } from '../../../common/guards/location.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { UserSessionProfile } from '../../auth/domain/auth.domain';
import { StockQueryService } from '../services/stock-query.service';
import { StockBalanceQueryDto, StockBalanceItemDto, ItemStockDetailDto } from '../dto/stock.dto';

@ApiTags('Stock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, LocationGuard)
@Controller('api/v1')
export class StockController {
  constructor(private readonly stockQueryService: StockQueryService) {}

  @Get('stock')
  @RequirePermissions('stock.balance.read')
  @ApiOperation({
    summary: 'Melihat ringkasan saldo stok (per item & lokasi)',
    description: 'Menampilkan saldo stok, status ketersediaan (cito, menipis, aman), dan nilai persediaan.',
  })
  @ApiResponse({ status: 200, type: [StockBalanceItemDto], description: 'Daftar saldo stok' })
  async getStock(
    @Query() query: StockBalanceQueryDto,
    @CurrentUser() user: UserSessionProfile,
  ): Promise<StockBalanceItemDto[]> {
    return await this.stockQueryService.getStockBalances(query, user);
  }

  @Get('items/:id/stock')
  @RequirePermissions('stock.balance.read')
  @ApiOperation({
    summary: 'Melihat rincian stok per item (per lokasi & batch)',
    description: 'Menampilkan rincian batch, tanggal kadaluarsa (ED), harga pokok, dan nilai persediaan per lokasi.',
  })
  @ApiResponse({ status: 200, type: ItemStockDetailDto, description: 'Rincian stok item' })
  async getItemStock(
    @Param('id', new ParseUUIDPipe({ version: '7' })) id: string,
    @CurrentUser() user: UserSessionProfile,
  ): Promise<ItemStockDetailDto> {
    return await this.stockQueryService.getItemStockDetail(id, user);
  }
}
