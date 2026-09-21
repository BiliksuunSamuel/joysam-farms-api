import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SaleFilter } from 'src/dtos/sale/sale.filter.dto';
import { SaleStatsResponse } from 'src/dtos/sale/sale.stats.response.dto';
import { SalesTrendFilter } from 'src/dtos/sale/sales.trend.filter.dto';
import { VoidRequestFilter } from 'src/dtos/sale/void-request.filter.dto';
import { CustomerInfo } from 'src/models/customer/customer-info.model';
import { PaymentSplit } from 'src/models/sale/payment-split.model';
import { SaleItem } from 'src/models/sale/sale-item.model';
import { VoidRequest } from 'src/models/sale/void-request.model';
import { ShopInfo } from 'src/models/shop/shop-info.model';
import { UserInfo } from 'src/models/user/user-info.model';
import { VendorInfo } from 'src/models/vendor/vendor-info.model';
import {
  SalePaymentMethod,
  SaleStatus,
  SalesTrendGroupBy,
  VoidRequestStatus,
} from 'src/enums';
import { Sale } from 'src/schemas/sale.schema';
import { generateId, toPaginationInfo } from 'src/utils';

export type CreateSaleRecord = {
  shopId: string;
  shopInfoSnapshot: ShopInfo;
  cashierId: string;
  cashierInfoSnapshot: UserInfo;
  receiptNo: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: SalePaymentMethod;
  isSplitSale: boolean;
  status: SaleStatus;
  amountTendered?: number;
  changeGiven?: number;
  vendorId?: string;
  vendorInfoSnapshot?: VendorInfo;
  customerId?: string;
  customerInfoSnapshot?: CustomerInfo;
  note?: string;
  momoNetwork?: string;
  momoPhone?: string;
  payments?: PaymentSplit[];
};

@Injectable()
export class SaleRepository {
  constructor(
    @InjectModel(Sale.name) private readonly saleRepository: Model<Sale>,
  ) {}

  //get by id
  async getById(id: string): Promise<Sale> {
    return await this.saleRepository.findOne({ id }).lean();
  }

  //Digital and Split sales still Pending after `before` - abandoned
  //checkout sessions that never reached a terminal Paystack state (see
  //PaymentTransactionSweepService). Every Split sale has exactly one
  //Digital (Paystack) leg - see SaleService.create - so it's swept the
  //same way a pure-Digital sale is.
  async findStalePendingDigital(before: Date): Promise<Sale[]> {
    return await this.saleRepository
      .find({
        status: SaleStatus.Pending,
        paymentMethod: {
          $in: [SalePaymentMethod.Digital, SalePaymentMethod.Split],
        },
        createdAt: { $lt: before },
      })
      .lean();
  }

  // Units sold per inventory item since `since`, summed across every shop -
  // the "how fast is this moving overall" rate InventoryUtilsService turns
  // into days-of-cover for the warehouse view. Completed sales only
  // (Voided/Pending stock never really left the shelf).
  async getUnitsSoldByInventoryId(
    since: Date,
    inventoryIds?: string[],
  ): Promise<Map<string, number>> {
    const match: any = {
      status: SaleStatus.Completed,
      createdAt: { $gte: since },
    };
    if (inventoryIds?.length)
      match['items.inventoryId'] = { $in: inventoryIds };

    const rows = await this.saleRepository.aggregate([
      { $match: match },
      { $unwind: '$items' },
      ...(inventoryIds?.length
        ? [{ $match: { 'items.inventoryId': { $in: inventoryIds } } }]
        : []),
      {
        $group: {
          _id: '$items.inventoryId',
          quantity: { $sum: '$items.quantity' },
        },
      },
    ]);
    return new Map(rows.map((r) => [r._id as string, r.quantity as number]));
  }

  // Same as above, but per shop - one shop's own sell-through rate for an
  // item, keyed `${shopId}:${inventoryId}` since a Stocks list can span
  // every shop at once.
  async getUnitsSoldByShopAndInventoryId(
    since: Date,
    opts?: { shopId?: string; inventoryIds?: string[] },
  ): Promise<Map<string, number>> {
    const match: any = {
      status: SaleStatus.Completed,
      createdAt: { $gte: since },
    };
    if (opts?.shopId) match.shopId = opts.shopId;
    if (opts?.inventoryIds?.length) {
      match['items.inventoryId'] = { $in: opts.inventoryIds };
    }

    const rows = await this.saleRepository.aggregate([
      { $match: match },
      { $unwind: '$items' },
      ...(opts?.inventoryIds?.length
        ? [{ $match: { 'items.inventoryId': { $in: opts.inventoryIds } } }]
        : []),
      {
        $group: {
          _id: { shopId: '$shopId', inventoryId: '$items.inventoryId' },
          quantity: { $sum: '$items.quantity' },
        },
      },
    ]);
    return new Map(
      rows.map((r) => [
        `${r._id.shopId}:${r._id.inventoryId}`,
        r.quantity as number,
      ]),
    );
  }

  //list, optionally scoped by shop/cashier/payment method/status
  async list(
    filter: SaleFilter,
  ): Promise<{ results: Sale[]; totalCount: number }> {
    const { page, pageSize } = toPaginationInfo(filter);
    const query: any = {};
    if (filter?.shopId) query.shopId = filter.shopId;
    if (filter?.cashierId) query.cashierId = filter.cashierId;
    if (filter?.customerId) query.customerId = filter.customerId;
    if (filter?.paymentMethod) query.paymentMethod = filter.paymentMethod;
    if (filter?.status) query.status = filter.status;

    const [results, totalCount] = await Promise.all([
      this.saleRepository
        .find(query)
        .sort({ createdAt: -1, _id: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      this.saleRepository.countDocuments(query),
    ]);

    return { results, totalCount };
  }

  // Aggregated metrics for a filtered view of sales - shop/cashier/
  // customer/payment method/date range, same as list()'s own filters, but
  // deliberately not status: Completed and Voided are always broken out
  // together here rather than picking one, matching how the checkout
  // page's today-only KPI cards already treat "revenue" vs "voided".
  async getStats(filter: SaleFilter): Promise<SaleStatsResponse> {
    const match: any = {};
    if (filter?.shopId) match.shopId = filter.shopId;
    if (filter?.cashierId) match.cashierId = filter.cashierId;
    if (filter?.customerId) match.customerId = filter.customerId;
    if (filter?.paymentMethod) match.paymentMethod = filter.paymentMethod;
    if (filter?.startDate || filter?.endDate) {
      match.createdAt = {};
      if (filter.startDate) match.createdAt.$gte = new Date(filter.startDate);
      if (filter.endDate) match.createdAt.$lte = new Date(filter.endDate);
    }

    const [byStatus, itemsResult] = await Promise.all([
      this.saleRepository.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$status',
            total: { $sum: '$total' },
            count: { $sum: 1 },
          },
        },
      ]),
      this.saleRepository.aggregate([
        { $match: { ...match, status: SaleStatus.Completed } },
        { $unwind: '$items' },
        { $group: { _id: null, quantity: { $sum: '$items.quantity' } } },
      ]),
    ]);

    const completed = byStatus.find((s) => s._id === SaleStatus.Completed);
    const voided = byStatus.find((s) => s._id === SaleStatus.Voided);
    const revenue = completed?.total ?? 0;
    const transactionCount = completed?.count ?? 0;

    return {
      revenue,
      transactionCount,
      averageSale: transactionCount ? revenue / transactionCount : 0,
      voidedCount: voided?.count ?? 0,
      itemsSold: itemsResult[0]?.quantity ?? 0,
    };
  }

  //value1/value2, grouped by the requested dimension - Hour/Day/Week/Month/
  //Year bucket by createdAt (UTC); Shop/Cashier group by that id instead,
  //reading a display name straight off the sale's own snapshot (no extra
  //lookup needed). Scoped by the same filters as list() plus the date
  //range - defaults to completed sales, since that's what "revenue" means.
  //
  //Without `inventoryId`: value1 = revenue (sum of sale.total), value2 =
  //transaction count - the whole-sale view.
  //With `inventoryId`: sale.items is unwound and filtered down to just that
  //item first, so value1 = units of it sold, value2 = revenue it generated
  //- a per-product view, scoped inside otherwise-unrelated sales.
  async getTrend(
    filter: SalesTrendFilter,
  ): Promise<{ key: string; label: string; value1: number; value2: number }[]> {
    const match: any = { status: filter?.status ?? SaleStatus.Completed };
    if (filter?.shopId) match.shopId = filter.shopId;
    if (filter?.cashierId) match.cashierId = filter.cashierId;
    if (filter?.paymentMethod) match.paymentMethod = filter.paymentMethod;
    if (filter?.startDate || filter?.endDate) {
      match.createdAt = {};
      if (filter.startDate) match.createdAt.$gte = new Date(filter.startDate);
      if (filter.endDate) match.createdAt.$lte = new Date(filter.endDate);
    }

    const isCategory = filter?.groupBy === SalesTrendGroupBy.Category;
    const pipeline: any[] = [{ $match: match }];
    if (filter?.inventoryId || isCategory) {
      pipeline.push({ $unwind: '$items' });
      if (filter?.inventoryId) {
        pipeline.push({ $match: { 'items.inventoryId': filter.inventoryId } });
      }
    }
    // Sale items don't snapshot a categoryId, so grouping by category needs
    // a live join to Inventory - unlike Shop/Cashier, whose names/ids are
    // already denormalised onto the sale itself.
    if (isCategory) {
      pipeline.push({
        $lookup: {
          from: 'inventories',
          localField: 'items.inventoryId',
          foreignField: 'id',
          as: 'inventoryDoc',
        },
      });
      pipeline.push({
        $unwind: { path: '$inventoryDoc', preserveNullAndEmptyArrays: true },
      });
    }

    const group: any = isCategory
      ? {
          value1: { $sum: '$items.lineTotal' },
          value2: { $sum: '$items.quantity' },
        }
      : filter?.inventoryId
        ? {
            value1: { $sum: '$items.quantity' },
            value2: { $sum: '$items.lineTotal' },
          }
        : {
            value1: { $sum: '$total' },
            value2: { $sum: 1 },
          };
    switch (filter?.groupBy) {
      case SalesTrendGroupBy.Hour:
        group._id = {
          $dateToString: { format: '%Y-%m-%dT%H:00', date: '$createdAt' },
        };
        break;
      case SalesTrendGroupBy.Week:
        group._id = { $dateToString: { format: '%G-W%V', date: '$createdAt' } };
        break;
      case SalesTrendGroupBy.Month:
        group._id = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
        break;
      case SalesTrendGroupBy.Year:
        group._id = { $dateToString: { format: '%Y', date: '$createdAt' } };
        break;
      case SalesTrendGroupBy.Shop:
        group._id = '$shopId';
        group.label = { $first: '$shopInfoSnapshot.name' };
        break;
      case SalesTrendGroupBy.Cashier:
        group._id = '$cashierId';
        group.label = { $first: '$cashierInfoSnapshot.name' };
        break;
      case SalesTrendGroupBy.Category:
        // the service resolves this raw categoryId to a name via
        // CategoryRepository, the same way InventoryService.getStockBreakdown
        // already does for the warehouse breakdown chart
        group._id = '$inventoryDoc.categoryId';
        break;
      case SalesTrendGroupBy.Day:
      default:
        group._id = {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
        };
        break;
    }
    pipeline.push({ $group: group });
    pipeline.push({ $sort: { _id: 1 } });

    const results = await this.saleRepository.aggregate(pipeline);

    return results.map((r) => ({
      key: r._id,
      label: r.label ?? r._id,
      value1: r.value1,
      value2: r.value2,
    }));
  }

  //revenue per payment method for a fixed date range - a Split sale is
  //unwound into its individual legs first, so a GH₵135 Cash+Digital split
  //contributes GH₵100 to Cash and GH₵35 to Digital instead of GH₵135 to a
  //generic "Split" bucket. Used by the Daily Report. shopId undefined =
  //every shop.
  async getPaymentMethodTotals(
    shopId: string | undefined,
    startDate: Date,
    endDate: Date,
  ): Promise<{ method: SalePaymentMethod; revenue: number }[]> {
    const match: any = {
      status: SaleStatus.Completed,
      createdAt: { $gte: startDate, $lt: endDate },
    };
    if (shopId) match.shopId = shopId;

    const results = await this.saleRepository.aggregate([
      { $match: match },
      {
        $project: {
          legs: {
            $cond: [
              { $eq: ['$paymentMethod', SalePaymentMethod.Split] },
              '$payments',
              [{ method: '$paymentMethod', amount: '$total' }],
            ],
          },
        },
      },
      { $unwind: '$legs' },
      {
        $group: {
          _id: '$legs.method',
          revenue: { $sum: '$legs.amount' },
        },
      },
    ]);

    return results.map((r) => ({ method: r._id, revenue: r.revenue }));
  }

  //count + total value of split sales for a fixed date range - used by the
  //Daily Report. shopId undefined = every shop.
  async getSplitSalesTotals(
    shopId: string | undefined,
    startDate: Date,
    endDate: Date,
  ): Promise<{ count: number; value: number }> {
    const match: any = {
      isSplitSale: true,
      status: SaleStatus.Completed,
      createdAt: { $gte: startDate, $lt: endDate },
    };
    if (shopId) match.shopId = shopId;

    const [totals] = await this.saleRepository.aggregate([
      { $match: match },
      { $group: { _id: null, count: { $sum: 1 }, value: { $sum: '$total' } } },
    ]);
    return { count: totals?.count ?? 0, value: totals?.value ?? 0 };
  }

  //record a sale - everything here is already resolved server-side. status
  //is caller-supplied (Pending for Digital, Completed for every other
  //method - see SaleService.create) rather than hardcoded, since Digital
  //sales aren't settled yet at creation time.
  async create(record: CreateSaleRecord): Promise<Sale> {
    const res = await this.saleRepository.create({
      ...record,
      id: generateId(),
    });
    return await this.saleRepository.findById(res._id).lean();
  }

  // The concurrency guard for finalizing a Pending Digital sale - only one
  // concurrent caller (webhook, poll, or the abandonment sweep) can ever
  // match {id, status: from} and flip it, so exactly one of them proceeds
  // to post the ledger credit / restore stock. Returns null if another
  // caller already won (or the sale wasn't in `from` to begin with).
  async finalize(
    id: string,
    from: SaleStatus,
    to: SaleStatus,
  ): Promise<Sale | null> {
    return await this.saleRepository
      .findOneAndUpdate(
        { id, status: from },
        { $set: { status: to } },
        { new: true },
      )
      .lean();
  }

  // Shared guard for starting a new void request (both createVoidRequest and
  // finalizeInstantVoid): only a Completed sale with no already-Pending
  // request can get one - this IS the concurrency lock, the same way
  // finalize()'s {id, status: from} match is.
  private voidableMatch(id: string) {
    return {
      id,
      status: SaleStatus.Completed,
      $or: [
        { voidRequest: null },
        { 'voidRequest.status': { $ne: VoidRequestStatus.Pending } },
      ],
    };
  }

  // Approval-required path - records the request only, status stays
  // Completed until someone approves it.
  async createVoidRequest(
    id: string,
    voidRequest: VoidRequest,
  ): Promise<Sale | null> {
    return await this.saleRepository
      .findOneAndUpdate(
        this.voidableMatch(id),
        { $set: { voidRequest } },
        { new: true },
      )
      .lean();
  }

  // Instant path - the request and the actual void happen in the same
  // atomic update, self-approved (voidRequest.reviewedById === requestedById).
  async finalizeInstantVoid(
    id: string,
    voidRequest: VoidRequest,
  ): Promise<Sale | null> {
    return await this.saleRepository
      .findOneAndUpdate(
        this.voidableMatch(id),
        { $set: { status: SaleStatus.Voided, voidRequest } },
        { new: true },
      )
      .lean();
  }

  // This is the moment a sale voided under RequiresApproval actually
  // becomes Voided - the request itself (createVoidRequest) never touched
  // status.
  async approveVoidRequest(
    id: string,
    reviewedById: string,
    reviewNotes: string | null,
  ): Promise<Sale | null> {
    return await this.saleRepository
      .findOneAndUpdate(
        {
          id,
          status: SaleStatus.Completed,
          'voidRequest.status': VoidRequestStatus.Pending,
        },
        {
          $set: {
            status: SaleStatus.Voided,
            'voidRequest.status': VoidRequestStatus.Approved,
            'voidRequest.reviewedById': reviewedById,
            'voidRequest.reviewedAt': new Date(),
            'voidRequest.reviewNotes': reviewNotes,
          },
        },
        { new: true },
      )
      .lean();
  }

  // The sale stays exactly as it was (Completed, fully valid) - only the
  // request itself is marked Rejected, so a new one can be raised later.
  async rejectVoidRequest(
    id: string,
    reviewedById: string,
    reviewNotes: string | null,
  ): Promise<Sale | null> {
    return await this.saleRepository
      .findOneAndUpdate(
        { id, 'voidRequest.status': VoidRequestStatus.Pending },
        {
          $set: {
            'voidRequest.status': VoidRequestStatus.Rejected,
            'voidRequest.reviewedById': reviewedById,
            'voidRequest.reviewedAt': new Date(),
            'voidRequest.reviewNotes': reviewNotes,
          },
        },
        { new: true },
      )
      .lean();
  }

  // Every sale that has ever had a void request, optionally narrowed to one
  // shop/status - the "Void requests" queue page's data source.
  async listVoidRequests(
    filter: VoidRequestFilter,
  ): Promise<{ results: Sale[]; totalCount: number }> {
    const { page, pageSize } = toPaginationInfo(filter);
    const query: any = { voidRequest: { $ne: null } };
    if (filter?.shopId) query.shopId = filter.shopId;
    if (filter?.status) query['voidRequest.status'] = filter.status;

    const [results, totalCount] = await Promise.all([
      this.saleRepository
        .find(query)
        .sort({ 'voidRequest.requestedAt': -1, _id: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      this.saleRepository.countDocuments(query),
    ]);

    return { results, totalCount };
  }
}
