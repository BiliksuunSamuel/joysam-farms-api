import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { PERMISSION_FEATURES } from 'src/permissions';
import { JwtAuthGuard } from 'src/providers/jwt-auth..guard';

//read-only: the catalog of permission keys the platform actually enforces -
//see src/permissions/index.ts. Any authenticated user can view it (e.g. to
//render a role editor); nothing here is ever written to.
@Controller('api/permissions')
@ApiTags('Permissions')
@ApiBearerAuth('Authorization')
@UseGuards(JwtAuthGuard)
export class PermissionController {
  @Get()
  list(@Res() response: Response) {
    response.status(200).send({ code: 200, data: PERMISSION_FEATURES });
  }
}
