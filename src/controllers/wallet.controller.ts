import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthPermissions } from 'src/middlewares/auth.permissions';
import { WalletService } from 'src/services/wallet.service';

// A wallet's balance is derived entirely from its ledger entries - viewing
// it is gated by the same permission as viewing the ledger itself.
@Controller('api/wallets')
@ApiTags('Wallets')
@ApiBearerAuth('Authorization')
@AuthPermissions('ledger.view')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  //a shop's wallet is opened lazily the first time it's asked for
  @Get('shop/:shopId')
  @ApiParam({ name: 'shopId', type: String })
  async getForShop(@Param('shopId') shopId: string, @Res() response: Response) {
    const res = await this.walletService.getForShop(shopId);
    response.status(res.code).send(res);
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: String })
  async getById(@Param('id') id: string, @Res() response: Response) {
    const res = await this.walletService.getById(id);
    response.status(res.code).send(res);
  }
}
