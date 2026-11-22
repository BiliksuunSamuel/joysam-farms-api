import { SaleKind, SalePaymentMethod, SaleStatus } from 'src/enums';
import { Sale } from 'src/schemas/sale.schema';
import { Settings } from 'src/schemas/settings.schema';
import { BRAND_LOGO_DATA_URI } from 'src/templates/brand-logo';

// The sale receipt as one self-contained HTML document - the single place to
// restyle what customers get. InvoiceService renders it to PDF with headless
// Chromium, so ordinary HTML/CSS (including print rules) is all that's needed.

const METHOD_LABEL: Record<SalePaymentMethod, string> = {
  [SalePaymentMethod.Cash]: 'Cash',
  [SalePaymentMethod.MobileMoney]: 'Mobile money',
  [SalePaymentMethod.Digital]: 'Mobile money / card',
  [SalePaymentMethod.Credit]: 'Vendor credit',
  [SalePaymentMethod.Split]: 'Cash + mobile money',
};

const esc = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function renderReceiptHtml(
  sale: Sale,
  settings: Settings | null,
): string {
  const currency = settings?.currency ?? 'GHS';
  const money = (n: number) =>
    `${currency} ${(n ?? 0).toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  const when = new Date(sale.createdAt).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const debt = sale.kind === SaleKind.DebtPayment;
  const instPayment = sale.kind === SaleKind.InstalmentPayment;
  const inst = sale.instalment;
  const voided = sale.status === SaleStatus.Voided;
  const owed = (n: number) => money(Math.abs(Math.min(n ?? 0, 0)));

  const row = (label: string, value: string, cls = '') =>
    `<div class="row ${cls}"><span>${esc(label)}</span><span>${esc(value)}</span></div>`;

  const lines = [
    ...(sale.items ?? []).map((i) => ({
      name: i.inventoryInfoSnapshot?.name ?? 'Item',
      qty: `${i.quantity}${i.inventoryInfoSnapshot?.unit ? ` ${i.inventoryInfoSnapshot.unit}` : ''}`,
      unit: i.unitPrice,
      total: i.lineTotal,
    })),
    ...(sale.serviceItems ?? []).map((i) => ({
      name: `${i.serviceInfoSnapshot?.name ?? 'Service'}${i.feeLabel ? ` (${i.feeLabel})` : ''}`,
      qty: String(i.quantity),
      unit: i.unitPrice,
      total: i.lineTotal,
    })),
  ];
  const itemCount = lines.reduce((n, l) => n + (parseFloat(l.qty) || 0), 0);

  const paid =
    sale.paymentMethod === SalePaymentMethod.Split && sale.payments?.length
      ? sale.payments
          .map((p) => row('Paid by', `${METHOD_LABEL[p.method]} ${money(p.amount)}`))
          .join('')
      : row('Paid by', METHOD_LABEL[sale.paymentMethod]) +
        (sale.paymentMethod === SalePaymentMethod.Cash && sale.amountTendered != null
          ? row('Tendered', money(sale.amountTendered)) +
            row('Change', money(sale.changeGiven ?? 0))
          : '') +
        (sale.paymentMethod === SalePaymentMethod.Credit && sale.vendorInfoSnapshot
          ? row('Billed to', sale.vendorInfoSnapshot.name)
          : '');

  const day = (d: Date | string) =>
    new Date(d).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  const planBlock = inst
    ? `
      <hr />
      <p class="section">Payment plan - ${esc(inst.planName)}</p>
      ${row('Total due', money(inst.totalDue))}
      ${inst.feeAmount > 0 ? row('Includes plan fee', money(inst.feeAmount)) : ''}
      ${row('Paid so far', money(inst.paidTotal))}
      ${row('Still owed', money(Math.max(inst.totalDue - inst.paidTotal, 0)), 'strong')}
      <ul class="lines" style="margin-top:6px">
        ${inst.schedule
          .map((e) => {
            const done = e.paidAmount >= e.amount - 0.005;
            const late = !done && new Date(e.dueDate).getTime() < Date.now();
            return `<li><div class="row"><span>${e.number === 0 ? 'Deposit' : `Payment ${e.number}`} · ${esc(day(e.dueDate))}</span><span>${esc(money(e.amount))}</span></div><div class="sub">${done ? 'Paid' : late ? 'Overdue' : 'Due'}</div></li>`;
          })
          .join('')}
      </ul>
      <div class="sub" style="margin-top:4px">${
        inst.status === 'Released'
          ? 'Goods handed over.'
          : inst.status === 'Cancelled'
            ? 'This plan was cancelled.'
            : inst.status === 'Paid'
              ? 'Fully paid - ready to collect.'
              : 'Goods are held until the plan is fully paid.'
      }</div>`
    : '';

  const body = instPayment
    ? `
      <p class="section">Instalment payment</p>
      ${row('Amount paid', money(sale.total), 'total')}`
    : debt
    ? `
      <p class="section">Payment received</p>
      ${row(
        `Settles ${sale.debtSettlement?.allocations?.length ?? 0} credit sale${sale.debtSettlement?.allocations?.length === 1 ? '' : 's'}`,
        money(sale.total),
      )}
      ${sale.debtSettlement ? row('Owed before', owed(sale.debtSettlement.balanceBefore)) : ''}
      ${sale.debtSettlement ? row('Still owed', owed(sale.debtSettlement.balanceAfter), 'strong') : ''}
      <hr />
      ${row('Amount paid', money(sale.total), 'total')}`
    : `
      <ul class="lines">
        ${lines
          .map(
            (l) => `<li>
              <div class="row"><span class="name">${esc(l.name)}</span><span>${esc(money(l.total))}</span></div>
              <div class="sub">${esc(l.qty)} × ${esc(money(l.unit))}</div>
            </li>`,
          )
          .join('')}
      </ul>
      <hr />
      ${row(`Subtotal (${itemCount} item${itemCount === 1 ? '' : 's'})`, money(sale.subtotal))}
      ${row('Discount', sale.discount > 0 ? `-${money(sale.discount)}` : money(0))}
      ${row('Total', money(sale.total), 'total')}${planBlock}`;

  const shopLine = [sale.shopInfoSnapshot?.location, sale.shopInfoSnapshot?.phone]
    .filter(Boolean)
    .join(' · ');
  const contact = [settings?.address, settings?.digitalAddress]
    .filter(Boolean)
    .join(' · ');
  const reach = [settings?.contactPhone, settings?.contactEmail]
    .filter(Boolean)
    .join(' · ');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>Receipt ${esc(sale.receiptNo)}</title>
<style>
  @page { margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { width: 80mm; padding: 6mm 5mm 7mm; color: #0b1a12; -webkit-text-stroke: 0.2px; font: 11px/1.45 "Courier New", Courier, "Liberation Mono", "Nimbus Mono PS", monospace; position: relative; }
  .center { text-align: center; }
  .logo { width: 46mm; height: auto; display: block; margin: 0 auto 6px; }
  .biz { font-size: 14px; font-weight: 700; }
  .muted { color: #2f3a34; }
  .small { font-size: 10px; }
  hr { border: 0; border-top: 1px dashed #6f7a73; margin: 10px 0; }
  .row { display: flex; justify-content: space-between; gap: 12px; padding: 1.5px 0; }
  .row span:last-child { text-align: right; font-variant-numeric: tabular-nums; }
  .meta .row span:first-child { color: #2f3a34; }
  .meta .row span:last-child { font-weight: 600; }
  .lines { list-style: none; margin: 0; padding: 0; }
  .lines li { padding: 3px 0; }
  .name { font-weight: 600; }
  .sub { color: #2f3a34; font-size: 10px; font-variant-numeric: tabular-nums; }
  .section { margin: 0 0 4px; font-weight: 700; font-size: 12px; }
  .total { font-size: 13px; font-weight: 700; padding-top: 4px; }
  .strong span:last-child { font-weight: 700; }
  .stamp { position: absolute; top: 8mm; right: 4mm; transform: rotate(-12deg); border: 2px solid #8a948d; color: #8a948d; padding: 1px 6px; font-weight: 700; letter-spacing: 0.18em; font-size: 12px; text-transform: uppercase; }
  .foot { text-align: center; color: #2f3a34; font-size: 10px; }
</style></head>
<body>
  ${voided ? '<span class="stamp">Voided</span>' : ''}
  <div class="center">
    <img class="logo" src="${BRAND_LOGO_DATA_URI}" alt="${esc(settings?.businessName ?? 'JoySam Farms')}" />
    ${settings?.registeredName ? `<div class="muted small">${esc(settings.registeredName)}</div>` : ''}
    <div class="muted">${esc(sale.shopInfoSnapshot ? `${sale.shopInfoSnapshot.name} shop` : '')}</div>
    ${shopLine ? `<div class="muted small">${esc(shopLine)}</div>` : ''}
    ${contact ? `<div class="muted small">${esc(contact)}</div>` : ''}
    ${reach ? `<div class="muted small">${esc(reach)}</div>` : ''}
  </div>
  <hr />
  <div class="meta">
    ${row('Receipt', sale.receiptNo)}
    ${row('Date', when)}
    ${row('Cashier', sale.cashierInfoSnapshot?.name ?? '-')}
    ${debt && sale.vendorInfoSnapshot ? row('Received from', sale.vendorInfoSnapshot.name) : ''}
    ${!debt && sale.customerInfoSnapshot ? row('Customer', `${sale.customerInfoSnapshot.name} · ${sale.customerInfoSnapshot.phone}`) : ''}
  </div>
  <hr />
  ${body}
  <hr />
  <div class="small">${paid}</div>
  ${sale.note ? `<hr /><div class="small muted"><b>Note:</b> ${esc(sale.note)}</div>` : ''}
  <hr />
  <div class="foot">${
    settings?.receiptFooter
      ? esc(settings.receiptFooter)
      : debt
        ? 'Thank you for your payment.'
        : instPayment
          ? 'Thank you for your payment.'
          : 'Thank you for buying fresh from JoySam Farms.<br />Goods sold are not returnable after 24 hours.'
  }</div>
</body></html>`;
}
