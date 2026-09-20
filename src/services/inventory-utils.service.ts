import { Injectable } from '@nestjs/common';
import { InventoryResponse } from 'src/dtos/inventory/inventory.response.dto';
import { LowStockThresholdMode } from 'src/enums';
import { Category } from 'src/schemas/category.schema';
import { Inventory } from 'src/schemas/inventory.schema';
import { Settings } from 'src/schemas/settings.schema';
import { generateNumericCode } from 'src/utils';

const SERIAL_NUMBER_LENGTH = 12;

// How far back to look when estimating an item's daily sales velocity for
// DaysOfCover mode - long enough to smooth out day-to-day noise, short
// enough to reflect how the item is actually moving right now.
export const VELOCITY_WINDOW_DAYS = 14;

export type StockHealth = 'out' | 'low' | 'ok';

// EAN-13 digit encodings, 7 modules ('0'/'1') each.
const L_CODE: Record<string, string> = {
  '0': '0001101',
  '1': '0011001',
  '2': '0010011',
  '3': '0111101',
  '4': '0100011',
  '5': '0110001',
  '6': '0101111',
  '7': '0111011',
  '8': '0110111',
  '9': '0001011',
};
const G_CODE: Record<string, string> = {
  '0': '0100111',
  '1': '0110011',
  '2': '0011011',
  '3': '0100001',
  '4': '0011101',
  '5': '0111001',
  '6': '0000101',
  '7': '0010001',
  '8': '0001001',
  '9': '0010111',
};
const R_CODE: Record<string, string> = {
  '0': '1110010',
  '1': '1100110',
  '2': '1101100',
  '3': '1000010',
  '4': '1011100',
  '5': '1001110',
  '6': '1010000',
  '7': '1000100',
  '8': '1001000',
  '9': '1110100',
};
// Which of the 6 left digits use L vs G, keyed by the (unencoded) first digit.
const FIRST_DIGIT_PARITY: Record<string, string> = {
  '0': 'LLLLLL',
  '1': 'LLGLGG',
  '2': 'LLGGLG',
  '3': 'LLGGGL',
  '4': 'LGLLGG',
  '5': 'LGGLLG',
  '6': 'LGGGLL',
  '7': 'LGLGLG',
  '8': 'LGLGGL',
  '9': 'LGGLGL',
};

const START_GUARD = '101';
const CENTER_GUARD = '01010';
const END_GUARD = '101';

const MODULE_WIDTH = 2;
const BAR_HEIGHT = 60;
const TEXT_HEIGHT = 16;
const QUIET_ZONE_MODULES = 10;

/**
 * Pure, stateless helpers for an inventory item's serialNumber and the
 * barcode derived from it. Uniqueness of the serialNumber itself is the
 * repository's job (it has the DB access needed to check for collisions).
 */
@Injectable()
export class InventoryUtilsService {
  //a raw, 12-digit numeric serial number
  generateSerialNumber(): string {
    return generateNumericCode(SERIAL_NUMBER_LENGTH);
  }

  //derives a 13-digit, EAN-13-valid barcode from a 12-digit serial number
  generateBarcode(serialNumber: string): string {
    const digits = serialNumber.padStart(SERIAL_NUMBER_LENGTH, '0');
    return `${digits}${this.calculateEan13CheckDigit(digits)}`;
  }

  /**
   * Renders a real, scannable EAN-13 barcode as an SVG string. Bars stay a
   * fixed dark-on-light contrast regardless of the app's theme - scanners
   * (and eyes) need that contrast, so this is never theme-adaptive.
   */
  generateBarcodeSvg(barcode: string): string {
    const digits = barcode.replace(/\D/g, '').padStart(13, '0').slice(-13);
    const bits = this.toEan13Bits(digits);

    const width =
      bits.length * MODULE_WIDTH + QUIET_ZONE_MODULES * 2 * MODULE_WIDTH;
    const height = BAR_HEIGHT + TEXT_HEIGHT;
    const quietZone = QUIET_ZONE_MODULES * MODULE_WIDTH;

    let bars = '';
    let x = quietZone;
    for (const bit of bits) {
      if (bit === '1') {
        bars += `<rect x="${x}" y="0" width="${MODULE_WIDTH}" height="${BAR_HEIGHT}" fill="#000000" />`;
      }
      x += MODULE_WIDTH;
    }

    const label = `${digits[0]} ${digits.slice(1, 7)} ${digits.slice(7, 13)}`;

    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Barcode ${digits}">` +
      `<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />` +
      bars +
      `<text x="${width / 2}" y="${height - 2}" text-anchor="middle" font-family="monospace" font-size="12" fill="#000000">${label}</text>` +
      `</svg>`
    );
  }

  //shapes an inventory item for an API response: attaches its barcodeSvg
  //and its category's name/description, both computed at read time rather
  //than persisted, so they always reflect current data
  toInventoryResponse(
    inventory: Inventory,
    category?: Category,
    dailyVelocity?: number | null,
    settings?: Settings,
  ): InventoryResponse {
    const { stockHealth, daysOfCover } = this.computeStockHealth({
      quantity: inventory.quantity,
      reorderLevel: inventory.reorderLevel,
      mode:
        settings?.lowStockThresholdMode ?? LowStockThresholdMode.FixedQuantity,
      thresholdQuantity: settings?.lowStockThresholdQuantity ?? 10,
      thresholdDays: settings?.lowStockThresholdDays ?? 3,
      dailyVelocity: dailyVelocity ?? null,
    });
    return {
      ...inventory,
      barcodeSvg: this.generateBarcodeSvg(inventory.barcode),
      categoryName: category?.name ?? '',
      categoryDescription: category?.description ?? null,
      stockHealth,
      daysOfCover,
    };
  }

  /**
   * Whether an item counts as low stock, and (in DaysOfCover mode) how many
   * days its remaining quantity is projected to last. Out-of-stock (<= 0)
   * always wins regardless of mode - there's no meaningful "healthy" or
   * "low" reading for a shelf that's already empty.
   *
   * FixedQuantity mode prefers the item's own reorderLevel (a real,
   * per-product setting) over the platform-wide default, since a merchant
   * who bothered to set one presumably knows this product better than a
   * blanket number does; the default only covers items nobody has tuned.
   */
  computeStockHealth(params: {
    quantity: number;
    reorderLevel: number;
    mode: LowStockThresholdMode;
    thresholdQuantity: number;
    thresholdDays: number;
    dailyVelocity: number | null;
  }): { stockHealth: StockHealth; daysOfCover: number | null } {
    if (params.quantity <= 0) {
      return {
        stockHealth: 'out',
        daysOfCover: params.dailyVelocity ? 0 : null,
      };
    }

    if (params.mode === LowStockThresholdMode.DaysOfCover) {
      if (!params.dailyVelocity) {
        // Not selling in the lookback window - nothing projects it running
        // out, so there's no "low" reading to make under this mode.
        return { stockHealth: 'ok', daysOfCover: null };
      }
      const daysOfCover = params.quantity / params.dailyVelocity;
      return {
        stockHealth: daysOfCover <= params.thresholdDays ? 'low' : 'ok',
        daysOfCover,
      };
    }

    const effectiveThreshold =
      params.reorderLevel > 0 ? params.reorderLevel : params.thresholdQuantity;
    return {
      stockHealth: params.quantity <= effectiveThreshold ? 'low' : 'ok',
      daysOfCover: null,
    };
  }

  //standard EAN-13 checksum: odd positions (1-indexed) weighted 1, even weighted 3
  private calculateEan13CheckDigit(digits: string): number {
    const sum = digits
      .split('')
      .map(Number)
      .reduce(
        (total, digit, index) => total + digit * (index % 2 === 0 ? 1 : 3),
        0,
      );
    return (10 - (sum % 10)) % 10;
  }

  //encodes 13 digits into the full 95-module EAN-13 bit string
  private toEan13Bits(digits: string): string {
    const parity = FIRST_DIGIT_PARITY[digits[0]] ?? 'LLLLLL';
    const left = digits.slice(1, 7);
    const right = digits.slice(7, 13);

    let bits = START_GUARD;
    for (let i = 0; i < 6; i++) {
      const table = parity[i] === 'G' ? G_CODE : L_CODE;
      bits += table[left[i]] ?? L_CODE['0'];
    }
    bits += CENTER_GUARD;
    for (let i = 0; i < 6; i++) {
      bits += R_CODE[right[i]] ?? R_CODE['0'];
    }
    return bits + END_GUARD;
  }
}
