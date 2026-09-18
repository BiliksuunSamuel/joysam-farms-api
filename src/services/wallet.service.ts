import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseDto } from 'src/dtos/common/api.response.dto';
import { WalletResponse } from 'src/dtos/wallet/wallet.response.dto';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { LedgerEntryRepository } from 'src/repositories/ledger-entry.repository';
import { ShopRepository } from 'src/repositories/shop.repository';
import { WalletRepository } from 'src/repositories/wallet.repository';
import { Wallet } from 'src/schemas/wallet.schema';
import { toShopInfo } from 'src/utils';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly ledgerEntryRepository: LedgerEntryRepository,
    private readonly shopRepository: ShopRepository,
  ) {}

  //get (or lazily open) a shop's wallet, with its computed balance
  async getForShop(shopId: string): Promise<ApiResponseDto<WalletResponse>> {
    try {
      const shop = await this.shopRepository.getById(shopId);
      if (!shop) {
        return CommonResponses.NotFoundResponse<WalletResponse>(
          'Shop not found',
        );
      }
      const wallet = await this.getOrCreateWallet(shopId);
      return CommonResponses.OkResponse<WalletResponse>(
        await this.withBalance(wallet),
      );
    } catch (error) {
      this.logger.error(
        'an error occurred while getting wallet for shop',
        shopId,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<WalletResponse>(
        'An error occurred while getting wallet for shop',
      );
    }
  }

  async getById(id: string): Promise<ApiResponseDto<WalletResponse>> {
    try {
      const wallet = await this.walletRepository.getById(id);
      if (!wallet) {
        return CommonResponses.NotFoundResponse<WalletResponse>(
          'Wallet not found',
        );
      }
      return CommonResponses.OkResponse<WalletResponse>(
        await this.withBalance(wallet),
      );
    } catch (error) {
      this.logger.error(
        'an error occurred while getting wallet by id',
        id,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<WalletResponse>(
        'An error occurred while getting wallet by id',
      );
    }
  }

  //used internally by features that need to post to a shop's ledger
  //(there's no public "create a wallet" endpoint - one is opened lazily,
  //the first time a shop needs one)
  async getOrCreateWallet(shopId: string): Promise<Wallet> {
    const existing = await this.walletRepository.getByShopId(shopId);
    if (existing) return existing;
    const shop = await this.shopRepository.getById(shopId);
    return await this.walletRepository.create(shopId, toShopInfo(shop));
  }

  private async withBalance(wallet: Wallet): Promise<WalletResponse> {
    return {
      ...wallet,
      balance: await this.ledgerEntryRepository.getBalance(wallet.id),
    };
  }
}
