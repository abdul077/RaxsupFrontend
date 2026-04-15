import { Invoice } from '../models/financial.model';

const COMPANY_NAME = 'RAXSUP Logistics';
const COMPANY_ADDRESS = '123 Fleet Avenue, Houston, TX 77001';
const COMPANY_EMAIL = 'billing@raxsup.com';
const COMPANY_PHONE = '+1 (713) 555-0188';
const PAYMENT_TERMS = 'Payment is due within 15 days from invoice date.';

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getStatusTone(status: string): { bg: string; color: string; border: string } {
  switch (status) {
    case 'Paid':
      return { bg: '#ecfdf3', color: '#067647', border: '#abefc6' };
    case 'Sent':
      return { bg: '#eff8ff', color: '#175cd3', border: '#b2ddff' };
    case 'Overdue':
      return { bg: '#fef3f2', color: '#b42318', border: '#fecdca' };
    default:
      return { bg: '#f2f4f7', color: '#344054', border: '#d0d5dd' };
  }
}

export function buildInvoicePdfHtml(
  invoice: Invoice,
  formatCurrency: (amount: number) => string,
  formatDate: (date: string | undefined) => string,
  companyLogoUrl: string
): string {
  const issueDate = formatDate(invoice.issueDate);
  const dueDate = formatDate(invoice.dueDate);
  const statusTone = getStatusTone(invoice.status);
  const isPaid = invoice.status === 'Paid' || invoice.balance <= 0;

  const lineItemsRows = invoice.lineItems
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.description)}</td>
          <td class="num">${item.quantity}</td>
          <td class="num">${formatCurrency(item.unitPrice)}</td>
          <td class="num amount">${formatCurrency(item.amount)}</td>
        </tr>
      `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Invoice ${escapeHtml(invoice.invoiceNumber)}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <style>
          @page {
            size: A4;
            margin: 14mm;
          }

          :root {
            --brand: #1f4bd8;
            --text: #101828;
            --muted: #475467;
            --line: #e4e7ec;
            --bg-soft: #f9fafb;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            font-family: 'Inter', Arial, sans-serif;
            color: var(--text);
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background: #ffffff;
          }

          .invoice-sheet {
            position: relative;
            max-width: 210mm;
            margin: 0 auto;
            border: 1px solid var(--line);
            border-radius: 16px;
            padding: 28px;
            box-shadow: 0 14px 34px rgba(16, 24, 40, 0.08);
          }

          .watermark {
            position: absolute;
            top: 45%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-24deg);
            font-size: 74px;
            font-weight: 800;
            letter-spacing: 0.28em;
            color: rgba(6, 118, 71, 0.08);
            white-space: nowrap;
            pointer-events: none;
            display: ${isPaid ? 'block' : 'none'};
          }

          .header {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 28px;
          }

          .company {
            display: flex;
            gap: 14px;
          }

          .logo {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid var(--line);
            background: #ffffff;
            overflow: hidden;
          }

          .logo img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            display: block;
          }

          .logo-fallback {
            width: 100%;
            height: 100%;
            background: linear-gradient(145deg, #3f67e6 0%, #1f4bd8 100%);
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 15px;
          }

          .company h2 {
            margin: 0;
            font-size: 18px;
            font-weight: 700;
          }

          .company p {
            margin: 3px 0 0;
            color: var(--muted);
            font-size: 12px;
            line-height: 1.45;
          }

          .invoice-meta {
            min-width: 240px;
            text-align: right;
          }

          .invoice-meta h1 {
            margin: 0;
            color: var(--brand);
            font-size: 30px;
            font-weight: 800;
            letter-spacing: 0.06em;
          }

          .invoice-number {
            margin: 6px 0 10px;
            font-size: 13px;
            color: var(--muted);
          }

          .status-badge {
            display: inline-block;
            border-radius: 999px;
            padding: 6px 12px;
            font-size: 12px;
            font-weight: 700;
            border: 1px solid ${statusTone.border};
            color: ${statusTone.color};
            background: ${statusTone.bg};
          }

          .detail-grid {
            display: grid;
            grid-template-columns: 1fr 280px;
            gap: 18px;
            margin-bottom: 24px;
          }

          .panel {
            border: 1px solid var(--line);
            border-radius: 12px;
            padding: 14px 16px;
            background: #fff;
          }

          .panel-label {
            margin: 0 0 8px;
            font-size: 12px;
            font-weight: 700;
            color: #667085;
            text-transform: uppercase;
            letter-spacing: 0.06em;
          }

          .bill-to {
            font-size: 15px;
            font-weight: 600;
            margin: 0;
          }

          .panel p {
            margin: 5px 0 0;
            color: var(--muted);
            font-size: 13px;
          }

          .date-row {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            margin-top: 6px;
            font-size: 13px;
          }

          .date-row .value {
            font-weight: 600;
          }

          .items-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            border: 1px solid var(--line);
            border-radius: 12px;
            overflow: hidden;
            margin-bottom: 20px;
          }

          .items-table th,
          .items-table td {
            padding: 12px 14px;
            font-size: 13px;
          }

          .items-table thead th {
            background: var(--bg-soft);
            color: #344054;
            border-bottom: 1px solid var(--line);
            font-weight: 700;
            text-align: left;
          }

          .items-table tbody td {
            border-bottom: 1px solid var(--line);
            color: #1d2939;
          }

          .items-table tbody tr:last-child td {
            border-bottom: none;
          }

          .num {
            text-align: right;
            white-space: nowrap;
          }

          .amount {
            font-weight: 600;
          }

          .summary-wrap {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 22px;
          }

          .summary {
            width: 320px;
            border: 1px solid var(--line);
            border-radius: 12px;
            padding: 12px 16px;
            background: #ffffff;
          }

          .summary-row {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            margin: 7px 0;
            font-size: 13px;
            color: #344054;
          }

          .summary-row strong {
            color: #101828;
          }

          .summary-total {
            border-top: 1px solid var(--line);
            margin-top: 10px;
            padding-top: 10px;
            font-size: 17px;
            font-weight: 800;
            color: #101828;
          }

          .summary-balance {
            color: ${invoice.balance > 0 ? '#b42318' : '#067647'};
            font-weight: 700;
          }

          .footer {
            margin-top: 10px;
            border-top: 1px solid var(--line);
            padding-top: 14px;
          }

          .footer h4 {
            margin: 0 0 6px;
            font-size: 14px;
          }

          .footer p {
            margin: 0;
            color: var(--muted);
            font-size: 12px;
            line-height: 1.55;
          }

          @media print {
            .invoice-sheet {
              border: none;
              border-radius: 0;
              padding: 0;
              box-shadow: none;
            }
          }
        </style>
      </head>
      <body>
        <main class="invoice-sheet">
          <div class="watermark">PAID</div>

          <section class="header">
            <div class="company">
              <div class="logo">
                <img src="${companyLogoUrl}" alt="Raxsup Logo" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
                <div class="logo-fallback" style="display:none;">RX</div>
              </div>
              <div>
                <h2>${COMPANY_NAME}</h2>
                <p>${COMPANY_ADDRESS}</p>
                <p>${COMPANY_EMAIL}</p>
                <p>${COMPANY_PHONE}</p>
              </div>
            </div>

            <div class="invoice-meta">
              <h1>INVOICE</h1>
              <p class="invoice-number">#${escapeHtml(invoice.invoiceNumber)}</p>
              <span class="status-badge">${escapeHtml(invoice.status)}</span>
            </div>
          </section>

          <section class="detail-grid">
            <div class="panel">
              <p class="panel-label">Bill To</p>
              <p class="bill-to">${escapeHtml(invoice.customerName || 'N/A')}</p>
              <p>Customer billing details on file</p>
            </div>

            <div class="panel">
              <p class="panel-label">Invoice Details</p>
              <div class="date-row">
                <span>Issue Date</span>
                <span class="value">${issueDate}</span>
              </div>
              <div class="date-row">
                <span>Due Date</span>
                <span class="value">${dueDate}</span>
              </div>
            </div>
          </section>

          <table class="items-table">
            <thead>
              <tr>
                <th>Description</th>
                <th class="num">Quantity</th>
                <th class="num">Unit Price</th>
                <th class="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${lineItemsRows}
            </tbody>
          </table>

          <section class="summary-wrap">
            <div class="summary">
              <div class="summary-row"><span>Subtotal</span><strong>${formatCurrency(invoice.subTotal)}</strong></div>
              <div class="summary-row"><span>Tax</span><strong>${formatCurrency(invoice.taxAmount)}</strong></div>
              <div class="summary-row"><span>Paid</span><strong>${formatCurrency(invoice.paidAmount)}</strong></div>
              <div class="summary-row summary-total"><span>Total</span><span>${formatCurrency(invoice.totalAmount)}</span></div>
              <div class="summary-row"><span>Remaining Balance</span><span class="summary-balance">${formatCurrency(invoice.balance)}</span></div>
            </div>
          </section>

          <footer class="footer">
            <h4>Thank you for your business.</h4>
            <p>${PAYMENT_TERMS}</p>
          </footer>
        </main>
        <script>
          window.addEventListener('load', function () {
            setTimeout(function () { window.print(); }, 250);
          });
        </script>
      </body>
    </html>
  `;
}
