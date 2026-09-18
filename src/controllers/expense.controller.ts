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
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { ExpenseFilter } from 'src/dtos/expense/expense.filter.dto';
import { ExpenseRequest } from 'src/dtos/expense/expense.request.dto';
import { ExpenseStatusRequest } from 'src/dtos/expense/expense.status.request.dto';
import { ExpenseTrendFilter } from 'src/dtos/expense/expense.trend.filter.dto';
import { AuditLog } from 'src/decorators/audit-log.decorator';
import { AuthUser } from 'src/extensions/auth.extensions';
import { AuthPermissions } from 'src/middlewares/auth.permissions';
import { AuditLogInterceptor } from 'src/providers/audit-log.interceptor';
import { JwtAuthGuard } from 'src/providers/jwt-auth..guard';
import { ExpenseService } from 'src/services/expense.service';

@Controller('api/expenses')
@ApiTags('Expenses')
@ApiBearerAuth('Authorization')
@UseInterceptors(AuditLogInterceptor)
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) {}

  @Get()
  @AuthPermissions('expense.view')
  async list(
    @Query() filter: ExpenseFilter,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.expenseService.list(filter, user.id);
    response.status(res.code).send(res);
  }

  @Get('trend')
  @AuthPermissions('expense.view')
  async getTrend(
    @Query() filter: ExpenseTrendFilter,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.expenseService.getTrend(filter, user.id);
    response.status(res.code).send(res);
  }

  @Get(':id')
  @AuthPermissions('expense.view')
  @ApiParam({ name: 'id', type: String })
  async getById(
    @Param('id') id: string,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.expenseService.getById(id, user.id);
    response.status(res.code).send(res);
  }

  //record an expense - any authenticated user (e.g. a shop manager or accountant)
  @Post()
  @UseGuards(JwtAuthGuard)
  @AuditLog('Expense', 'Created')
  async create(
    @Body() request: ExpenseRequest,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.expenseService.create(request, user.id);
    response.status(res.code).send(res);
  }

  @Patch(':id')
  @AuthPermissions('expense.update')
  @AuditLog('Expense', 'Updated')
  @ApiParam({ name: 'id', type: String })
  async update(
    @Param('id') id: string,
    @Body() request: ExpenseRequest,
    @Res() response: Response,
  ) {
    const res = await this.expenseService.update(id, request);
    response.status(res.code).send(res);
  }

  @Patch(':id/status')
  @AuthPermissions('expense.update-status')
  @AuditLog('Expense', 'StatusUpdated')
  @ApiParam({ name: 'id', type: String })
  async updateStatus(
    @Param('id') id: string,
    @Body() request: ExpenseStatusRequest,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.expenseService.updateStatus(id, request, user.id);
    response.status(res.code).send(res);
  }

  @Delete(':id')
  @AuthPermissions('expense.delete')
  @AuditLog('Expense', 'Deleted')
  @ApiParam({ name: 'id', type: String })
  async delete(@Param('id') id: string, @Res() response: Response) {
    const res = await this.expenseService.delete(id);
    response.status(res.code).send(res);
  }
}
