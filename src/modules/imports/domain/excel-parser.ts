import * as ExcelJS from 'exceljs';
import { ImportNormalizer } from './import-normalizer';

export interface RawRowData {
  rowNumber: number;
  values: Record<string, any>;
}

export class ExcelParser {
  /**
   * Mengekstrak nilai dari cell excel (menangani formula, text berformat, number, dsb).
   */
  static extractCellValue(cell: ExcelJS.Cell): any {
    if (!cell || cell.value === null || cell.value === undefined) {
      return null;
    }

    const val = cell.value;

    // Jika cell bertipe formula, ambil result-nya
    if (typeof val === 'object' && 'result' in val) {
      return (val as any).result;
    }

    // Jika cell berupa rich text
    if (typeof val === 'object' && 'richText' in val) {
      const rich = (val as any).richText;
      return rich.map((r: any) => r.text).join('');
    }

    // Jika cell berupa hyperlink
    if (typeof val === 'object' && 'text' in val) {
      return (val as any).text;
    }

    return val;
  }

  /**
   * Membaca workbook dari buffer dan mengembalikan worksheet yang dicari.
   */
  static async loadWorksheet(
    buffer: Buffer,
    sheetName?: string,
  ): Promise<ExcelJS.Worksheet> {
    const workbook = new ExcelJS.Workbook();
    // Gunakan load dari buffer
    await workbook.xlsx.load(buffer as any);

    if (sheetName) {
      const targetName = sheetName.trim().toLowerCase();
      const found = workbook.worksheets.find(
        (ws) => ws.name.trim().toLowerCase() === targetName,
      );
      if (found) {
        return found;
      }
    }

    // Fallback ke worksheet pertama yang ada
    const firstWs = workbook.worksheets[0];
    if (!firstWs) {
      throw new Error('Berkas Excel tidak memiliki sheet yang dapat dibaca.');
    }
    return firstWs;
  }

  /**
   * Menemukan baris header berdasarkan kata kunci dan memetakan nama kolom ke indeks kolom.
   */
  static findHeaderRow(
    worksheet: ExcelJS.Worksheet,
    keywords: string[],
    maxSearchRows = 10,
  ): { headerRowNumber: number; headerMap: Map<string, number> } {
    let headerRowNumber = 1;
    let found = false;

    for (let r = 1; r <= maxSearchRows && r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      let matchCount = 0;

      row.eachCell((cell) => {
        const text = ImportNormalizer.normalizeText(this.extractCellValue(cell));
        if (text) {
          const lower = text.toLowerCase();
          if (keywords.some((k) => lower.includes(k.toLowerCase()))) {
            matchCount++;
          }
        }
      });

      if (matchCount >= 2 || (keywords.length === 1 && matchCount >= 1)) {
        headerRowNumber = r;
        found = true;
        break;
      }
    }

    const headerMap = new Map<string, number>();
    const headerRow = worksheet.getRow(headerRowNumber);

    headerRow.eachCell((cell, colNumber) => {
      const text = ImportNormalizer.normalizeText(this.extractCellValue(cell));
      if (text) {
        headerMap.set(text.toLowerCase(), colNumber);
      }
    });

    return { headerRowNumber: found ? headerRowNumber : 1, headerMap };
  }
}
