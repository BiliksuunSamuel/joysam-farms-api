import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ShopInfo } from 'src/models/shop/shop-info.model';
import { Wallet } from 'src/schemas/wallet.schema';
import { generateId, generateNumericCode } from 'src/utils';

const ACCOUNT_NUMBER_LENGTH = 10;

@Injectable()
export class WalletRepository {
  constructor(
    @InjectModel(Wallet.name) private readonly walletRepository: Model<Wallet>,
  ) {}

  //get by id
  async getById(id: string): Promise<Wallet> {
    return await this.walletRepository.findOne({ id }).lean();
  }

  //get by shop id
  async getByShopId(shopId: string): Promise<Wallet> {
    return await this.walletRepository.findOne({ shopId }).lean();
  }

  //open a wallet for a shop, with a freshly generated, unique account number
  async create(shopId: string, shopInfoSnapshot: ShopInfo): Promise<Wallet> {
    const accountNumber = await this.generateUniqueAccountNumber();
    const res = await this.walletRepository.create({
      shopId,
      shopInfoSnapshot,
      accountNumber,
      id: generateId(),
    });
    return await this.walletRepository.findById(res._id).lean();
  }

  private async generateUniqueAccountNumber(): Promise<string> {
    let accountNumber = generateNumericCode(ACCOUNT_NUMBER_LENGTH);
    while (await this.walletRepository.exists({ accountNumber })) {
      accountNumber = generateNumericCode(ACCOUNT_NUMBER_LENGTH);
    }
    return accountNumber;
  }
}
