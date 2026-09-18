import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { BaseFilter } from 'src/dtos/common/base.filter.dto';
import { InventoryRequest } from 'src/dtos/inventory/inventory.request.dto';
import { StockBreakdownFilter } from 'src/dtos/inventory/stock.breakdown.filter.dto';
import { AuditLog } from 'src/decorators/audit-log.decorator';
import { AuthPermissions } from 'src/middlewares/auth.permissions';
import { AuditLogInterceptor } from 'src/providers/audit-log.interceptor';
import { InventoryService } from 'src/services/inventory.service';

const BULK_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

@Controller('api/inventory')
@ApiTags('Inventory')
@UseInterceptors(AuditLogInterceptor)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @AuthPermissions('inventory.view')
  async list(@Query() filter: BaseFilter, @Res() response: Response) {
    const res = await this.inventoryService.list(filter);
    response.status(res.code).send(res);
  }

  // Ungated: a barcode scan lookup other already-permitted features rely on
  // (e.g. checkout), not the warehouse catalog browsing view itself.
  @Get('barcode/:barcode')
  @ApiParam({ name: 'barcode', type: String })
  async getByBarcode(
    @Param('barcode') barcode: string,
    @Res() response: Response,
  ) {
    const res = await this.inventoryService.getByBarcode(barcode);
    response.status(res.code).send(res);
  }

  // Registered before ':id' - otherwise "breakdown" would be captured as an id.
  @Get('breakdown')
  @AuthPermissions('inventory.view')
  async getStockBreakdown(
    @Query() filter: StockBreakdownFilter,
    @Res() response: Response,
  ) {
    const res = await this.inventoryService.getStockBreakdown(filter);
    response.status(res.code).send(res);
  }

  // Registered before ':id' - otherwise "bulk-template" would be captured as an id.
  @Get('bulk-template')
  @AuthPermissions('inventory.create')
  async downloadBulkTemplate(@Res() response: Response) {
    const buffer = await this.inventoryService.generateBulkTemplate();
    response.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        'attachment; filename="inventory-bulk-upload-template.xlsx"',
    });
    response.send(buffer);
  }

  @Post('bulk')
  @AuthPermissions('inventory.create')
  @AuditLog('Inventory', 'BulkCreated')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: BULK_UPLOAD_MAX_BYTES } }),
  )
  async bulkCreate(
    @UploadedFile() file: Express.Multer.File,
    @Res() response: Response,
  ) {
    const res = await this.inventoryService.bulkCreate(file?.buffer);
    response.status(res.code).send(res);
  }

  @Get(':id')
  @AuthPermissions('inventory.view')
  @ApiParam({ name: 'id', type: String })
  async getById(@Param('id') id: string, @Res() response: Response) {
    const res = await this.inventoryService.getById(id);
    response.status(res.code).send(res);
  }

  @Post()
  @AuthPermissions('inventory.create')
  @AuditLog('Inventory', 'Created')
  async create(@Body() request: InventoryRequest, @Res() response: Response) {
    const res = await this.inventoryService.create(request);
    response.status(res.code).send(res);
  }

  @Patch(':id')
  @AuthPermissions('inventory.update')
  @AuditLog('Inventory', 'Updated')
  @ApiParam({ name: 'id', type: String })
  async update(
    @Param('id') id: string,
    @Body() request: InventoryRequest,
    @Res() response: Response,
  ) {
    const res = await this.inventoryService.update(id, request);
    response.status(res.code).send(res);
  }

  @Delete(':id')
  @AuthPermissions('inventory.delete')
  @AuditLog('Inventory', 'Deleted')
  @ApiParam({ name: 'id', type: String })
  async delete(@Param('id') id: string, @Res() response: Response) {
    const res = await this.inventoryService.delete(id);
    response.status(res.code).send(res);
  }
}
