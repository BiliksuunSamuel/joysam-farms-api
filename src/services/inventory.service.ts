import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { ApiResponseDto } from 'src/dtos/common/api.response.dto';
import { BaseFilter } from 'src/dtos/common/base.filter.dto';
import { PagedResults } from 'src/dtos/common/paged.results.dto';
import { BulkInventoryResult } from 'src/dtos/inventory/bulk.inventory.result.dto';
import { InventoryRequest } from 'src/dtos/inventory/inventory.request.dto';
import { InventoryResponse } from 'src/dtos/inventory/inventory.response.dto';
import { StockBreakdown } from 'src/dtos/inventory/stock.breakdown.dto';
import { StockBreakdownFilter } from 'src/dtos/inventory/stock.breakdown.filter.dto';
import { StockBreakdownGroupBy, Unit } from 'src/enums';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { CategoryRepository } from 'src/repositories/category.repository';
import { InventoryRepository } from 'src/repositories/inventory.repository';
import { SaleRepository } from 'src/repositories/sale.repository';
import { SettingsRepository } from 'src/repositories/settings.repository';
import { SupplierRepository } from 'src/repositories/supplier.repository';
import { Inventory } from 'src/schemas/inventory.schema';
import { Settings } from 'src/schemas/settings.schema';
import { LowStockThresholdMode } from 'src/enums';
import {
  InventoryUtilsService,
  VELOCITY_WINDOW_DAYS,
} from 'src/services/inventory-utils.service';
import { SupplierService } from 'src/services/supplier.service';
import { toInventoryInfo, toPaginationInfo } from 'src/utils';

const TEMPLATE_COLUMNS = [
  { header: 'Name*', key: 'name', width: 28 },
  { header: 'Category*', key: 'category', width: 22 },
  { header: 'Unit', key: 'unit', width: 12 },
  { header: 'Description', key: 'description', width: 32 },
  { header: 'Price', key: 'price', width: 12 },
  { header: 'Cost Price', key: 'costPrice', width: 12 },
  { header: 'Quantity', key: 'quantity', width: 12 },
  { header: 'Reorder Level', key: 'reorderLevel', width: 14 },
];
const TEMPLATE_BLANK_ROWS = 200;
const NUMERIC_COLUMNS = [
  'price',
  'costPrice',
  'quantity',
  'reorderLevel',
] as const;

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly inventoryUtilsService: InventoryUtilsService,
    private readonly categoryRepository: CategoryRepository,
    private readonly settingsRepository: SettingsRepository,
    private readonly saleRepository: SaleRepository,
    private readonly supplierRepository: SupplierRepository,
    private readonly supplierService: SupplierService,
  ) {}

  // Settings once, and only the items on this page's daily sales velocity -
  // and only when DaysOfCover mode actually needs it, so FixedQuantity mode
  // (the default) never pays for the extra aggregation.
  private async getStockHealthInputs(inventoryIds: string[]): Promise<{
    settings?: Settings;
    velocityByInventoryId: Map<string, number>;
  }> {
    const settings = await this.settingsRepository.get();
    if (settings?.lowStockThresholdMode !== LowStockThresholdMode.DaysOfCover) {
      return { settings, velocityByInventoryId: new Map() };
    }
    const since = new Date(
      Date.now() - VELOCITY_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );
    const unitsSold = await this.saleRepository.getUnitsSoldByInventoryId(
      since,
      inventoryIds,
    );
    const velocityByInventoryId = new Map(
      [...unitsSold].map(([id, units]) => [id, units / VELOCITY_WINDOW_DAYS]),
    );
    return { settings, velocityByInventoryId };
  }

  //get by id
  async getById(id: string): Promise<ApiResponseDto<InventoryResponse>> {
    try {
      const inventory = await this.inventoryRepository.getById(id);
      if (!inventory) {
        return CommonResponses.NotFoundResponse<InventoryResponse>(
          'Inventory item not found',
        );
      }
      const category = await this.categoryRepository.getById(
        inventory.categoryId,
      );
      const { settings, velocityByInventoryId } =
        await this.getStockHealthInputs([inventory.id]);
      return CommonResponses.OkResponse<InventoryResponse>(
        this.inventoryUtilsService.toInventoryResponse(
          inventory,
          category,
          velocityByInventoryId.get(inventory.id),
          settings,
        ),
      );
    } catch (error) {
      this.logger.error(
        'an error occurred while getting inventory item by id',
        id,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<InventoryResponse>(
        'An error occurred while getting inventory item by id',
      );
    }
  }

  // Quantity (value1) and expected revenue (value2), grouped by category
  // or by product, ranked by quantity and capped at `limit` groups so a
  // long catalog stays chart-friendly.
  async getStockBreakdown(
    filter: StockBreakdownFilter,
  ): Promise<ApiResponseDto<StockBreakdown[]>> {
    try {
      const limit = filter?.limit && filter.limit > 0 ? filter.limit : 12;

      let rows: { label: string; quantity: number; revenue: number }[];
      if (filter?.groupBy === StockBreakdownGroupBy.Product) {
        rows = await this.inventoryRepository.getStockBreakdownByProduct(
          filter?.categoryId,
        );
      } else {
        const byCategory =
          await this.inventoryRepository.getStockBreakdownByCategory(
            filter?.categoryId,
          );
        const categories = await this.categoryRepository.getByIds(
          byCategory.map((row) => row.categoryId),
        );
        const categoryById = new Map(categories.map((c) => [c.id, c]));
        rows = byCategory.map((row) => ({
          label: categoryById.get(row.categoryId)?.name ?? row.categoryId,
          quantity: row.quantity,
          revenue: row.revenue,
        }));
      }

      const breakdown: StockBreakdown[] = rows
        .slice()
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, limit)
        .map((row) => ({
          label: row.label,
          value1: row.quantity,
          value2: row.revenue,
        }));

      return CommonResponses.OkResponse<StockBreakdown[]>(breakdown);
    } catch (error) {
      this.logger.error(
        'an error occurred while getting stock breakdown',
        filter,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<StockBreakdown[]>(
        'An error occurred while getting stock breakdown',
      );
    }
  }

  //get by barcode, for a scan-to-lookup flow
  async getByBarcode(
    barcode: string,
  ): Promise<ApiResponseDto<InventoryResponse>> {
    try {
      const inventory = await this.inventoryRepository.getByBarcode(barcode);
      if (!inventory) {
        return CommonResponses.NotFoundResponse<InventoryResponse>(
          'Inventory item not found',
        );
      }
      const category = await this.categoryRepository.getById(
        inventory.categoryId,
      );
      const { settings, velocityByInventoryId } =
        await this.getStockHealthInputs([inventory.id]);
      return CommonResponses.OkResponse<InventoryResponse>(
        this.inventoryUtilsService.toInventoryResponse(
          inventory,
          category,
          velocityByInventoryId.get(inventory.id),
          settings,
        ),
      );
    } catch (error) {
      this.logger.error(
        'an error occurred while getting inventory item by barcode',
        barcode,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<InventoryResponse>(
        'An error occurred while getting inventory item by barcode',
      );
    }
  }

  //list inventory items
  async list(
    filter: BaseFilter,
  ): Promise<ApiResponseDto<PagedResults<InventoryResponse>>> {
    try {
      const { page, pageSize } = toPaginationInfo(filter);
      const { results, totalCount } =
        await this.inventoryRepository.list(filter);
      const categoryIds = [...new Set(results.map((item) => item.categoryId))];
      const categories = await this.categoryRepository.getByIds(categoryIds);
      const categoryById = new Map(categories.map((c) => [c.id, c]));
      const { settings, velocityByInventoryId } =
        await this.getStockHealthInputs(results.map((item) => item.id));
      return CommonResponses.OkResponse<PagedResults<InventoryResponse>>({
        results: results.map((item) =>
          this.inventoryUtilsService.toInventoryResponse(
            item,
            categoryById.get(item.categoryId),
            velocityByInventoryId.get(item.id),
            settings,
          ),
        ),
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error(
        'an error occurred while listing inventory items',
        filter,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<
        PagedResults<InventoryResponse>
      >('An error occurred while listing inventory items');
    }
  }

  //create inventory item
  async create(
    request: InventoryRequest,
  ): Promise<ApiResponseDto<InventoryResponse>> {
    try {
      const { supplierId, ...fields } = request;
      if (supplierId && !(await this.supplierRepository.getById(supplierId))) {
        return CommonResponses.NotFoundResponse<InventoryResponse>(
          'Supplier not found',
        );
      }

      const inventory = await this.inventoryRepository.create(fields);

      // The initial quantity, if sourced from a supplier, is a delivery -
      // same bookkeeping approving a SupplyRequest does (see
      // SupplyRequestService.approve), just for a brand-new item instead of
      // an existing one.
      if (supplierId && inventory.quantity > 0) {
        const expiryDate = request.expiryDate
          ? new Date(request.expiryDate)
          : null;
        await this.supplierService.postInventoryDelivery(
          supplierId,
          inventory.id,
          toInventoryInfo(inventory),
          inventory.quantity,
          expiryDate,
          inventory.id,
        );
        await this.supplierService.postBill(
          supplierId,
          (inventory.costPrice ?? 0) * inventory.quantity,
          inventory.id,
        );
      }

      const category = await this.categoryRepository.getById(
        inventory.categoryId,
      );
      // A brand-new item can't have sales history yet, so there's no
      // velocity to look up - just resolve the threshold to compare against.
      const settings = await this.settingsRepository.get();
      return CommonResponses.CreatedResponse<InventoryResponse>(
        this.inventoryUtilsService.toInventoryResponse(
          inventory,
          category,
          null,
          settings,
        ),
      );
    } catch (error) {
      this.logger.error(
        'an error occurred while creating inventory item',
        request,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<InventoryResponse>(
        'An error occurred while creating inventory item',
      );
    }
  }

  //builds the .xlsx template for bulk-importing inventory items - a
  //Category column with a dropdown of every real category name, so what
  //the user fills in is guaranteed resolvable on upload
  async generateBulkTemplate(): Promise<Buffer> {
    const categories = await this.categoryRepository.listForDropdown({});

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Inventory');
    sheet.columns = TEMPLATE_COLUMNS;
    sheet.getRow(1).font = { bold: true };

    // Visible reference sheet - so the available categories are actually
    // readable, not just hidden behind a dropdown - and also the range the
    // Category column's dropdown validates against.
    const categorySheet = workbook.addWorksheet('Categories');
    categorySheet.columns = [
      { header: 'Category name', key: 'name', width: 28 },
    ];
    categorySheet.getRow(1).font = { bold: true };
    categories.forEach((category, i) => {
      categorySheet.getCell(i + 2, 1).value = category.name;
    });

    // Hidden helper sheet backing the Unit dropdown only - Excel data
    // validation lists need a cell range to reference, not just literals.
    const options = workbook.addWorksheet('Options');
    options.state = 'veryHidden';
    Object.values(Unit).forEach((unit, i) => {
      options.getCell(i + 1, 1).value = unit;
    });

    const categoryRange = `Categories!$A$2:$A$${Math.max(categories.length + 1, 2)}`;
    const unitRange = `Options!$A$1:$A$${Object.values(Unit).length}`;
    for (let row = 2; row <= TEMPLATE_BLANK_ROWS + 1; row++) {
      sheet.getCell(`B${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [categoryRange],
        showErrorMessage: true,
        errorTitle: 'Invalid category',
        error: 'Pick a category from the dropdown list.',
      };
      sheet.getCell(`C${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [unitRange],
      };
    }

    return (await workbook.xlsx.writeBuffer()) as Buffer;
  }

  //bulk-create inventory items from an uploaded .xlsx (see
  //generateBulkTemplate for the expected shape) - creates every valid row
  //and reports the rest as per-row errors, rather than failing the whole
  //upload over one bad row
  async bulkCreate(
    file: Buffer | undefined,
  ): Promise<ApiResponseDto<BulkInventoryResult>> {
    try {
      if (!file) {
        return CommonResponses.BadRequestResponse<BulkInventoryResult>(
          undefined,
          'No file was uploaded',
        );
      }

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(file as any);
      const sheet = workbook.worksheets[0];
      if (!sheet) {
        return CommonResponses.BadRequestResponse<BulkInventoryResult>(
          undefined,
          'The uploaded file has no worksheet',
        );
      }

      const created: InventoryResponse[] = [];
      const errors: { row: number; message: string }[] = [];
      const rows = sheet.getRows(2, Math.max(sheet.rowCount - 1, 0)) ?? [];

      for (const row of rows) {
        const rowNumber = row.number;
        const name = row.getCell(1).text?.trim();
        const categoryName = row.getCell(2).text?.trim();
        const unitText = row.getCell(3).text?.trim();
        const description = row.getCell(4).text?.trim();

        // a fully blank row (e.g. unused template rows) is just skipped
        if (!name && !categoryName) continue;

        if (!name) {
          errors.push({ row: rowNumber, message: 'Name is required' });
          continue;
        }
        if (!categoryName) {
          errors.push({ row: rowNumber, message: 'Category is required' });
          continue;
        }
        const category = await this.categoryRepository.getByName(categoryName);
        if (!category) {
          errors.push({
            row: rowNumber,
            message: `Category "${categoryName}" was not found`,
          });
          continue;
        }

        let unit: Unit | undefined;
        if (unitText) {
          unit = Object.values(Unit).find(
            (u) => u.toLowerCase() === unitText.toLowerCase(),
          );
          if (!unit) {
            errors.push({
              row: rowNumber,
              message: `Unit "${unitText}" is not valid`,
            });
            continue;
          }
        }

        const numbers: Record<string, number | undefined> = {};
        let numericError = false;
        for (const key of NUMERIC_COLUMNS) {
          const columnIndex = TEMPLATE_COLUMNS.findIndex((c) => c.key === key);
          const raw = row.getCell(columnIndex + 1).value;
          if (raw === null || raw === undefined || raw === '') continue;
          const num = Number(raw);
          if (isNaN(num) || num < 0) {
            errors.push({
              row: rowNumber,
              message: `${key} must be a non-negative number`,
            });
            numericError = true;
            break;
          }
          numbers[key] = num;
        }
        if (numericError) continue;

        const res = await this.create({
          name,
          categoryId: category.id,
          description: description || undefined,
          unit,
          price: numbers.price,
          costPrice: numbers.costPrice,
          quantity: numbers.quantity,
          reorderLevel: numbers.reorderLevel,
        });

        if (res.data) {
          created.push(res.data);
        } else {
          errors.push({
            row: rowNumber,
            message: res.message ?? 'Could not create this item',
          });
        }
      }

      return CommonResponses.OkResponse<BulkInventoryResult>({
        created,
        errors,
      });
    } catch (error) {
      this.logger.error(
        'an error occurred while bulk creating inventory items',
        error,
      );
      return CommonResponses.InternalServerErrorResponse<BulkInventoryResult>(
        'An error occurred while processing the uploaded file',
      );
    }
  }

  //update inventory item
  async update(
    id: string,
    request: InventoryRequest,
  ): Promise<ApiResponseDto<InventoryResponse>> {
    try {
      const inventory = await this.inventoryRepository.update(id, request);
      if (!inventory) {
        return CommonResponses.NotFoundResponse<InventoryResponse>(
          'Inventory item not found',
        );
      }
      const category = await this.categoryRepository.getById(
        inventory.categoryId,
      );
      const { settings, velocityByInventoryId } =
        await this.getStockHealthInputs([inventory.id]);
      return CommonResponses.OkResponse<InventoryResponse>(
        this.inventoryUtilsService.toInventoryResponse(
          inventory,
          category,
          velocityByInventoryId.get(inventory.id),
          settings,
        ),
      );
    } catch (error) {
      this.logger.error(
        'an error occurred while updating inventory item',
        { id, request },
        error,
      );
      return CommonResponses.InternalServerErrorResponse<InventoryResponse>(
        'An error occurred while updating inventory item',
      );
    }
  }

  //delete inventory item
  async delete(id: string): Promise<ApiResponseDto<Inventory>> {
    try {
      const inventory = await this.inventoryRepository.delete(id);
      if (!inventory) {
        return CommonResponses.NotFoundResponse<Inventory>(
          'Inventory item not found',
        );
      }
      return CommonResponses.OkResponse<Inventory>(inventory);
    } catch (error) {
      this.logger.error(
        'an error occurred while deleting inventory item',
        id,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<Inventory>(
        'An error occurred while deleting inventory item',
      );
    }
  }
}
