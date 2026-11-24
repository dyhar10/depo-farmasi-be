import { Decimal } from 'decimal.js';

export class ImportNormalizer {
  /**
   * Membersihkan teks umum: pangkas spasi di awal/akhir.
   * Nilai seperti '#N/A', 'N/A', '-', 'null', '' diubah menjadi null.
   */
  static normalizeText(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const str = String(value).trim();
    if (!str) {
      return null;
    }

    const lower = str.toLowerCase();
    if (lower === '#n/a' || lower === 'n/a' || lower === '-' || lower === 'null') {
      return null;
    }

    return str;
  }

  /**
   * Kodifikasi unik item: disimpan apa adanya setelah dipangkas spasi (tidak mengubah case/akhiran -B).
   */
  static normalizeCode(value: unknown): string {
    const cleaned = this.normalizeText(value);
    if (!cleaned) {
      return '';
    }
    return cleaned;
  }

  /**
   * Normalisasi tipe katalog ('ekatalog' | 'non_ekatalog').
   * Menyeragamkan "Non Ekatalog", "Non ekatalog", "NON EKATALOG", "Non-Ekatalog" menjadi 'non_ekatalog'.
   */
  static normalizeCatalogType(value: unknown): 'ekatalog' | 'non_ekatalog' {
    const cleaned = this.normalizeText(value);
    if (!cleaned) {
      return 'ekatalog';
    }

    const lower = cleaned.toLowerCase().replace(/[-_\s]+/g, '');
    if (lower.includes('non')) {
      return 'non_ekatalog';
    }
    return 'ekatalog';
  }

  /**
   * Normalisasi status formularium ('formularium' | 'non_formularium').
   */
  static normalizeFormularyStatus(
    value: unknown,
  ): 'formularium' | 'non_formularium' | null {
    const cleaned = this.normalizeText(value);
    if (!cleaned) {
      return null;
    }

    const lower = cleaned.toLowerCase().replace(/[-_\s]+/g, '');
    if (lower.includes('non')) {
      return 'non_formularium';
    }
    if (lower.includes('formularium')) {
      return 'formularium';
    }
    return null;
  }

  /**
   * Normalisasi kelas Fornas ('fornas_generik' | 'fornas_non_generik' | 'non_fornas_non_generik').
   */
  static normalizeFornasClass(
    value: unknown,
  ): 'fornas_generik' | 'fornas_non_generik' | 'non_fornas_non_generik' | null {
    const cleaned = this.normalizeText(value);
    if (!cleaned) {
      return null;
    }

    const lower = cleaned.toLowerCase();
    if (lower.includes('non fornas') || lower.includes('non-fornas')) {
      return 'non_fornas_non_generik';
    }
    if (lower.includes('non generik') || lower.includes('non-generik')) {
      return 'fornas_non_generik';
    }
    if (lower.includes('generik') || lower.includes('fornas')) {
      return 'fornas_generik';
    }
    return null;
  }

  /**
   * Normalisasi angka desimal dari berbagai format (string Indonesia '1.500,50', standard '1500.50', atau number).
   * Mengembalikan string desimal presisi tinggi atau null jika kosong/tidak valid.
   */
  static normalizeDecimal(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'number') {
      if (isNaN(value)) return null;
      return new Decimal(value).toString();
    }

    const str = this.normalizeText(value);
    if (!str) return null;

    // Bersihkan karakter selain angka, koma, titik, dan minus
    let cleaned = str.replace(/[^\d.,-]/g, '');
    if (!cleaned || cleaned === '-') return null;

    // Deteksi separator ribuan vs desimal:
    // Jika ada koma dan titik:
    // Contoh '1.500,50' -> titik ribuan, koma desimal
    // Contoh '1,500.50' -> koma ribuan, titik desimal
    if (cleaned.includes('.') && cleaned.includes(',')) {
      if (cleaned.indexOf('.') < cleaned.indexOf(',')) {
        // '1.500,50' -> hapus '.', ganti ',' jadi '.'
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        // '1,500.50' -> hapus ','
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (cleaned.includes(',')) {
      // Hanya ada koma: '150,5' atau '1,500'
      // Jika setelah koma ada tepat 3 digit dan bukan desimal -> periksa pola
      const parts = cleaned.split(',');
      if (parts.length === 2 && parts[1].length !== 3) {
        cleaned = cleaned.replace(',', '.');
      } else if (parts.length > 2) {
        cleaned = cleaned.replace(/,/g, '');
      } else {
        // Default koma sebagai pemisah desimal di Indonesia
        cleaned = cleaned.replace(',', '.');
      }
    }

    try {
      const dec = new Decimal(cleaned);
      return dec.toString();
    } catch {
      return null;
    }
  }

  /**
   * Normalisasi jenis item ('obat' | 'bmhp').
   */
  static normalizeItemType(value: unknown): 'obat' | 'bmhp' {
    const cleaned = this.normalizeText(value);
    if (!cleaned) return 'obat';

    const lower = cleaned.toLowerCase();
    if (lower.includes('bmhp') || lower.includes('alkes') || lower.includes('bahan medis')) {
      return 'bmhp';
    }
    return 'obat';
  }
}
