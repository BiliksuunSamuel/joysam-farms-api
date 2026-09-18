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
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { BaseFilter } from 'src/dtos/common/base.filter.dto';
import { RoleDropdownFilter } from 'src/dtos/role/role.dropdown.filter.dto';
import { RoleRequest } from 'src/dtos/role/role.request.dto';
import { AuditLog } from 'src/decorators/audit-log.decorator';
import { AuthPermissions } from 'src/middlewares/auth.permissions';
import { AuditLogInterceptor } from 'src/providers/audit-log.interceptor';
import { RoleService } from 'src/services/role.service';

@Controller('api/roles')
@ApiTags('Roles')
@ApiBearerAuth('Authorization')
@UseInterceptors(AuditLogInterceptor)
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @AuthPermissions('role.view')
  async list(@Query() filter: BaseFilter, @Res() response: Response) {
    const res = await this.roleService.list(filter);
    response.status(res.code).send(res);
  }

  // Registered before ':id' - otherwise "dropdown" would be captured as an id.
  // Ungated: other already-permitted features (e.g. picking a role while
  // editing an employee) need this without needing role.view.
  @Get('dropdown')
  async listForDropdown(
    @Query() filter: RoleDropdownFilter,
    @Res() response: Response,
  ) {
    const res = await this.roleService.listForDropdown(filter);
    response.status(res.code).send(res);
  }

  @Get(':id')
  @AuthPermissions('role.view')
  @ApiParam({ name: 'id', type: String })
  async getById(@Param('id') id: string, @Res() response: Response) {
    const res = await this.roleService.getById(id);
    response.status(res.code).send(res);
  }

  @Post()
  @AuthPermissions('role.create')
  @AuditLog('Role', 'Created')
  async create(@Body() request: RoleRequest, @Res() response: Response) {
    const res = await this.roleService.create(request);
    response.status(res.code).send(res);
  }

  @Patch(':id')
  @AuthPermissions('role.update')
  @AuditLog('Role', 'Updated')
  @ApiParam({ name: 'id', type: String })
  async update(
    @Param('id') id: string,
    @Body() request: RoleRequest,
    @Res() response: Response,
  ) {
    const res = await this.roleService.update(id, request);
    response.status(res.code).send(res);
  }

  @Delete(':id')
  @AuthPermissions('role.delete')
  @AuditLog('Role', 'Deleted')
  @ApiParam({ name: 'id', type: String })
  async delete(@Param('id') id: string, @Res() response: Response) {
    const res = await this.roleService.delete(id);
    response.status(res.code).send(res);
  }
}
