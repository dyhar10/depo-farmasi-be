import { Injectable } from '@nestjs/common';
import { StockRepository } from '../repositories/stock.repository';
import { StockBalanceQueryDto, StockBalanceItemDto, ItemStockDetailDto } from '../dto/stock.dto';
import { StockDomainRules } from '../domain/stock.rules';
import { UserSessionProfile } from '../../auth/domain/auth.domain';
import { Decimal } from 'decimal.js';

@Injectable()
export class StockQueryService {
  constructor(private readonly stockRepository: StockRepository) {}

  async getStockBalances(
    query: StockBalanceQueryDto,
    user?: UserSessionProfile,
  ): Promise<StockBalanceItemDto[]> {
    const hasGlobalAccess = !user || user.roles.some((r) => r.location_id === null);
    let allowedLocationIds: string[] | undefined;

    if (!hasGlobalAccess && user) {
      if (user.assigned_location_ids.length === 0) {
        return [];
      }
      allowedLocationIds = user.assigned_location_ids;
    }

    const rows = await this.stockRepository.findStockBalances({
      itemId: query.item_id,
      locationId: query.location_id,
      allowedLocationIds,
    });

    return rows.map((r) => {
      const status = StockDomainRules.determineStockStatus(
        r.quantity.toString(),
        r.safety_stock.toString(),
        r.min_stock.toString(),
      );
      const valuation = StockDomainRules.calculateValuation(
        r.quantity.toString(),
        r.unit_cost.toString(),
      );

      return {
        item_id: r.item_id,
        item_code: r.item_code,
        item_name: r.item_name,
        item_type: r.item_type,
        location_id: r.location_id,
        location_name: r.location_name,
        quantity: new Decimal(r.quantity.toString()).toFixed(3),
        safety_stock: new Decimal(r.safety_stock.toString()).toFixed(3),
        min_stock: new Decimal(r.min_stock.toString()).toFixed(3),
        status,
        total_valuation: valuation.toFixed(4),
      };
    });
  }

  async getItemStockDetail(
    itemId: string,
    user?: UserSessionProfile,
  ): Promise<ItemStockDetailDto> {
    const hasGlobalAccess = !user || user.roles.some((r) => r.location_id === null);
    let allowedLocationIds: string[] | undefined;

    if (!hasGlobalAccess && user) {
      if (user.assigned_location_ids.length === 0) {
        return {
          item_id: itemId,
          item_code: '',
          item_name: '',
          total_quantity: '0.000',
          total_valuation: '0.0000',
          locations: [],
        };
      }
      allowedLocationIds = user.assigned_location_ids;
    }

    const rows = await this.stockRepository.findBatchesByItem(itemId, allowedLocationIds);

    if (rows.length === 0) {
      // Periksa apakah item ada
      return {
        item_id: itemId,
        item_code: '',
        item_name: '',
        total_quantity: '0.000',
        total_valuation: '0.0000',
        locations: [],
      };
    }

    let totalQty = new Decimal(0);
    let totalVal = new Decimal(0);

    const locationMap = new Map<
      string,
      {
        location_id: string;
        location_code: string;
        location_name: string;
        quantity: Decimal;
        batches: Array<{
          batch_id: string;
          batch_number: string;
          expiry_date: string | null;
          unit_cost: string;
          quantity: string;
          is_legacy: boolean;
          valuation: string;
        }>;
      }
    >();

    for (const r of rows) {
      const rowQty = new Decimal(r.quantity.toString());
      const rowCost = new Decimal(r.unit_cost.toString());
      const rowVal = rowQty.times(rowCost);

      totalQty = totalQty.plus(rowQty);
      totalVal = totalVal.plus(rowVal);

      if (!locationMap.has(r.location_id)) {
        locationMap.set(r.location_id, {
          location_id: r.location_id,
          location_code: r.location_code,
          location_name: r.location_name,
          quantity: new Decimal(0),
          batches: [],
        });
      }

      const loc = locationMap.get(r.location_id)!;
      loc.quantity = loc.quantity.plus(rowQty);
      loc.batches.push({
        batch_id: r.batch_id,
        batch_number: r.batch_number,
        expiry_date: r.expiry_date ? new Date(r.expiry_date).toISOString().slice(0, 10) : null,
        unit_cost: rowCost.toFixed(4),
        quantity: rowQty.toFixed(3),
        is_legacy: r.is_legacy,
        valuation: rowVal.toFixed(4),
      });
    }

    return {
      item_id: itemId,
      item_code: '',
      item_name: '',
      total_quantity: totalQty.toFixed(3),
      total_valuation: totalVal.toFixed(4),
      locations: Array.from(locationMap.values()).map((l) => ({
        location_id: l.location_id,
        location_code: l.location_code,
        location_name: l.location_name,
        quantity: l.quantity.toFixed(3),
        batches: l.batches,
      })),
    };
  }
}
