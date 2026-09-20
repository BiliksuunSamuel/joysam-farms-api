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
import { AuditLog } from 'src/decorators/audit-log.decorator';
import { CreateUserRequest } from 'src/dtos/user/create.user.request.dto';
import { ResetPasswordRequest } from 'src/dtos/user/reset.password.request.dto';
import { UpdateUserPermissionsRequest } from 'src/dtos/user/update.user.permissions.request.dto';
import { UpdateUserStatusRequest } from 'src/dtos/user/update.user.status.request.dto';
import { UserDropdownFilter } from 'src/dtos/user/user.dropdown.filter.dto';
import { UserFilter } from 'src/dtos/user/user.filter.dto';
import { UserRequest } from 'src/dtos/user/user.request.dto';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { AuthUser } from 'src/extensions/auth.extensions';
import { AuthPermissions } from 'src/middlewares/auth.permissions';
import { AuditLogInterceptor } from 'src/providers/audit-log.interceptor';
import { JwtAuthGuard } from 'src/providers/jwt-auth..guard';
import { UserService } from 'src/services/user.service';

@Controller('api/users')
@ApiTags('Users')
@ApiBearerAuth('Authorization')
@UseGuards(JwtAuthGuard)
@UseInterceptors(AuditLogInterceptor)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @AuthPermissions('user.view')
  async list(
    @Query() filter: UserFilter,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.userService.list(filter, user.id);
    response.status(res.code).send(res);
  }

  // Registered before ':id' - otherwise "dropdown" would be captured as an id.
  @Get('dropdown')
  async listForDropdown(
    @Query() filter: UserDropdownFilter,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.userService.listForDropdown(filter, user.id);
    response.status(res.code).send(res);
  }

  @Get(':id')
  @AuthPermissions('user.view')
  @ApiParam({ name: 'id', type: String })
  async getById(@Param('id') id: string, @Res() response: Response) {
    const res = await this.userService.getById(id);
    response.status(res.code).send(res);
  }

  @Get('email/:email')
  @ApiParam({ name: 'email', type: String })
  async getByEmail(@Param('email') email: string, @Res() response: Response) {
    const res = await this.userService.getByEmail(email);
    response.status(res.code).send(res);
  }

  @Post('register')
  @AuthPermissions('user.create')
  @AuditLog('User', 'Registered')
  async register(
    @Body() request: CreateUserRequest,
    @Res() response: Response,
  ) {
    const res = await this.userService.create(request);
    response.status(res.code).send(res);
  }

  @Patch(':id')
  @AuthPermissions('user.update')
  @AuditLog('User', 'Updated')
  @ApiParam({ name: 'id', type: String })
  async update(
    @Param('id') id: string,
    @Body() request: UserRequest,
    @Res() response: Response,
  ) {
    const res = await this.userService.update(id, request);
    response.status(res.code).send(res);
  }

  @Patch(':id/status')
  @AuthPermissions('user.update-status')
  @AuditLog('User', 'StatusUpdated')
  @ApiParam({ name: 'id', type: String })
  async updateStatus(
    @Param('id') id: string,
    @Body() request: UpdateUserStatusRequest,
    @Res() response: Response,
  ) {
    const res = await this.userService.updateStatus(id, request.status);
    response.status(res.code).send(res);
  }

  @Patch(':id/permissions')
  @AuthPermissions('user.update-permissions')
  @AuditLog('User', 'PermissionsUpdated')
  @ApiParam({ name: 'id', type: String })
  async updatePermissions(
    @Param('id') id: string,
    @Body() request: UpdateUserPermissionsRequest,
    @Res() response: Response,
  ) {
    const res = await this.userService.updatePermissions(id, request);
    response.status(res.code).send(res);
  }

  @Post(':id/reset-password')
  @AuthPermissions('user.reset-password')
  @AuditLog('User', 'PasswordReset')
  @ApiParam({ name: 'id', type: String })
  async resetPassword(
    @Param('id') id: string,
    @Body() request: ResetPasswordRequest,
    @Res() response: Response,
  ) {
    const res = await this.userService.resetPassword(id, request.password);
    response.status(res.code).send(res);
  }

  @Delete(':id')
  @AuthPermissions('user.delete')
  @AuditLog('User', 'Deleted')
  @ApiParam({ name: 'id', type: String })
  async delete(@Param('id') id: string, @Res() response: Response) {
    const res = await this.userService.delete(id);
    response.status(res.code).send(res);
  }
}
