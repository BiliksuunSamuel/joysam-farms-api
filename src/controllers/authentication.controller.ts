import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ChangePasswordRequest } from 'src/dtos/auth/change-password.request.dto';
import { LoginRequest } from 'src/dtos/auth/login.request.dto';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { AuditLog } from 'src/decorators/audit-log.decorator';
import { AuthUser } from 'src/extensions/auth.extensions';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { AuditLogInterceptor } from 'src/providers/audit-log.interceptor';
import { JwtAuthGuard } from 'src/providers/jwt-auth..guard';
import { AuthService } from 'src/services/auth.service';
import { ShopResponse } from 'src/dtos/shop/shop.response.dto';
import { ShopService } from 'src/services/shop.service';

@Controller('api/authentication')
@ApiTags('Authentication')
@ApiBearerAuth('Authorization')
@UseInterceptors(AuditLogInterceptor)
export class AuthenticationController {
  constructor(
    private readonly authService: AuthService,
    private readonly shopService: ShopService,
  ) {}

  @Post('login')
  @AuditLog('User', 'LoggedIn')
  async login(
    @Body() req: LoginRequest,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const res = await this.authService.login(req, {
      ipAddress: request.ip,
      agent: request.headers['user-agent'],
    });
    response.status(res.code).send(res);
  }

  //profile
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async profile(@AuthUser() user: UserJwtDetails, @Res() response: Response) {
    const res = await this.authService.getUserByEmail(user.email);
    response.status(res.code).send(res);
  }

  // Self-service password change - self-scoped, so never gated by a
  // permission (same reasoning as `profile`/`my-shop`). The only way a
  // user with mustChangePassword set can clear it themselves.
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @AuditLog('User', 'ChangedPassword')
  async changePassword(
    @Body() request: ChangePasswordRequest,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.authService.changePassword(user.id, request);
    response.status(res.code).send(res);
  }

  // Live details (including current operating status) for the caller's own
  // assigned shop - never gated by shop.view, since it can only ever return
  // the shop the caller is already tied to, not any other shop.
  @Get('my-shop')
  @UseGuards(JwtAuthGuard)
  async myShop(@AuthUser() user: UserJwtDetails, @Res() response: Response) {
    const userRes = await this.authService.getUserByEmail(user.email);
    if (!userRes.data?.shopId) {
      response
        .status(200)
        .send(CommonResponses.OkResponse<ShopResponse | null>(null));
      return;
    }
    const res = await this.shopService.getById(userRes.data.shopId);
    response.status(res.code).send(res);
  }
}
