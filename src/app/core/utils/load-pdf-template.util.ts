const COMPANY_NAME = 'RAXSUP Logistics';
const COMPANY_ADDRESS = '123 Fleet Avenue, Houston, TX 77001';
const COMPANY_EMAIL = 'billing@raxsup.com';
const COMPANY_PHONE = '+1 (713) 555-0188';
const FOOTER_TAGLINE = 'RaxsUp load summary — for operational use.';

function escapeHtml(input: string): string {
  if (input == null) return '';
  return String(input)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export interface LoadPdfStopRow {
  sequenceNo: string;
  stopType: string;
  location: string;
  planned: string;
  actual: string;
  notes: string;
}

export interface LoadPdfAssignmentRow {
  status: string;
  driverName: string;
  equipment: string;
  etd: string;
  eta: string;
  assignedAt: string;
  notes: string;
}

export interface LoadPdfAccessorialRow {
  typeName: string;
  amount: string;
  notes: string;
}

export interface LoadPdfTrackingRow {
  time: string;
  event: string;
  locationType: string;
  coordinates: string;
  notes: string;
}

export interface LoadPdfData {
  loadNumber: string;
  statusDisplay: string;
  /** Raw load.status for optional styling */
  statusRaw: string;
  exportedAt: string;
  exportedBy: string;
  loadInformation: {
    customerName: string;
    loadType: string;
    loadWeight: string;
    materialName: string;
    generalNotes: string;
    createdAt: string;
    pickup: string;
    delivery: string;
  };
  route: {
    origin: string;
    destination: string;
    distanceText: string;
    transitText: string;
    deadheadOrigin: string;
    deadheadDestination: string;
    showDeadhead: boolean;
  };
  financial: {
    baseRate: string;
    showDeadhead: boolean;
    deadhead: string;
    accessorials: string;
    totalRevenue: string;
    commission: string;
    driverAmount: string;
    formulaLine: string;
  };
  stops: LoadPdfStopRow[];
  assignments: LoadPdfAssignmentRow[];
  accessorials: LoadPdfAccessorialRow[];
  /** Only included when the API returns GPS history rows. */
  tracking: LoadPdfTrackingRow[] | null;
  companyLogoUrl: string;
}

function loadStatusBadgeStyle(statusRaw: string): { bg: string; color: string; border: string } {
  const s = (statusRaw || '').toLowerCase();
  if (s.includes('delivered') || s.includes('completed') || s.includes('settled')) {
    return { bg: '#ecfdf3', color: '#067647', border: '#abefc6' };
  }
  if (s.includes('transit') || s.includes('dispatch') || s.includes('pick')) {
    return { bg: '#eff8ff', color: '#175cd3', border: '#b2ddff' };
  }
  if (s.includes('cancel')) {
    return { bg: '#fef3f2', color: '#b42318', border: '#fecdca' };
  }
  return { bg: '#f2f4f7', color: '#344054', border: '#d0d5dd' };
}

export function buildLoadPdfHtml(data: LoadPdfData): string {
  const tone = loadStatusBadgeStyle(data.statusRaw);
  const num = escapeHtml(data.loadNumber);
  const title = `Load ${num}`;

  const stopsRows = data.stops
    .map(
      (r) => `
        <tr>
          <td>${escapeHtml(r.sequenceNo)}</td>
          <td>${escapeHtml(r.stopType)}</td>
          <td>${escapeHtml(r.location)}</td>
          <td class="td-wrap">${escapeHtml(r.planned)}</td>
          <td class="td-wrap">${escapeHtml(r.actual)}</td>
          <td class="note-cell">${escapeHtml(r.notes)}</td>
        </tr>
      `
    )
    .join('');

  const assignRows = data.assignments
    .map(
      (r) => `
        <tr>
          <td>${escapeHtml(r.status)}</td>
          <td>${escapeHtml(r.driverName)}</td>
          <td>${escapeHtml(r.equipment)}</td>
          <td class="td-wrap">${escapeHtml(r.etd)}</td>
          <td class="td-wrap">${escapeHtml(r.eta)}</td>
          <td class="td-wrap">${escapeHtml(r.assignedAt)}</td>
          <td class="note-cell">${escapeHtml(r.notes)}</td>
        </tr>
      `
    )
    .join('');

  const accRows =
    data.accessorials.length > 0
      ? data.accessorials
          .map(
            (r) => `
        <tr>
          <td>${escapeHtml(r.typeName)}</td>
          <td class="num">${escapeHtml(r.amount)}</td>
          <td class="note-cell">${escapeHtml(r.notes)}</td>
        </tr>
      `
          )
          .join('')
      : '<tr><td colspan="3" class="empty-row">No accessorials.</td></tr>';

  const stopsSection =
    data.stops.length > 0
      ? `
          <section class="section section-stops-next-page">
            <h2 class="section-title">Stops</h2>
            <div class="table-wrap">
              <table class="items-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Type</th>
                    <th>Location</th>
                    <th>Planned</th>
                    <th>Actual</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>${stopsRows}</tbody>
              </table>
            </div>
          </section>
        `
      : '';

  const assignmentsSection =
    data.assignments.length > 0
      ? `
          <section class="section">
            <h2 class="section-title">Assignments</h2>
            <div class="table-wrap">
              <table class="items-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Driver</th>
                    <th>Equipment</th>
                    <th>ETD</th>
                    <th>ETA</th>
                    <th>Assigned</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>${assignRows}</tbody>
              </table>
            </div>
          </section>
        `
      : '';

  const accessorialsSection = `
          <section class="section">
            <h2 class="section-title">Accessorials</h2>
            <div class="table-wrap">
              <table class="items-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th class="num">Amount</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>${accRows}</tbody>
              </table>
            </div>
          </section>
        `;

  let trackingBlock = '';
  if (data.tracking && data.tracking.length > 0) {
    const trRows = data.tracking
      .map(
        (r) => `
          <tr>
            <td class="td-wrap">${escapeHtml(r.time)}</td>
            <td>${escapeHtml(r.event)}</td>
            <td>${escapeHtml(r.locationType)}</td>
            <td class="font-mono small td-wrap">${escapeHtml(r.coordinates)}</td>
            <td class="note-cell">${escapeHtml(r.notes)}</td>
          </tr>
        `
      )
      .join('');
    trackingBlock = `
      <section class="section">
        <h2 class="section-title">Tracking history</h2>
        <div class="table-wrap">
          <table class="items-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Location type</th>
                <th>Coordinates</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>${trRows}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  const L = data.loadInformation;
  const R = data.route;
  const F = data.financial;
  const logoUrl = escapeHtml(data.companyLogoUrl);

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
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

          .load-sheet {
            position: relative;
            max-width: 210mm;
            margin: 0 auto;
            border: 1px solid var(--line);
            border-radius: 16px;
            padding: 28px;
            box-shadow: 0 14px 34px rgba(16, 24, 40, 0.08);
          }

          .header {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 24px;
            flex-wrap: wrap;
          }

          .company {
            display: flex;
            gap: 14px;
            align-items: flex-start;
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
            flex-shrink: 0;
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

          .load-meta {
            min-width: 200px;
            text-align: right;
          }

          .load-meta h1 {
            margin: 0;
            color: var(--brand);
            font-size: 28px;
            font-weight: 800;
            letter-spacing: 0.04em;
          }

          .load-number {
            margin: 6px 0 8px;
            font-size: 15px;
            color: var(--text);
            font-weight: 600;
          }

          .status-badge {
            display: inline-block;
            border-radius: 999px;
            padding: 6px 12px;
            font-size: 12px;
            font-weight: 700;
            border: 1px solid ${tone.border};
            color: ${tone.color};
            background: ${tone.bg};
          }

          .export-line {
            margin-top: 8px;
            font-size: 11px;
            color: var(--muted);
            line-height: 1.4;
          }

          .section {
            margin-bottom: 22px;
          }

          .section-title {
            margin: 0 0 10px;
            font-size: 12px;
            font-weight: 700;
            color: #667085;
            text-transform: uppercase;
            letter-spacing: 0.06em;
          }

          .section-note {
            margin: 0;
            font-size: 12px;
            color: var(--muted);
            font-style: italic;
          }

          .detail-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 8px;
          }

          @media (max-width: 640px) {
            .detail-grid {
              grid-template-columns: 1fr;
            }
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

          .panel p {
            margin: 4px 0 0;
            color: var(--muted);
            font-size: 13px;
          }

          .panel .strong {
            color: #101828;
            font-weight: 600;
            font-size: 14px;
            margin: 0 0 4px;
            display: block;
          }

          .kv {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            font-size: 13px;
            margin: 5px 0;
          }

          .kv span:first-child {
            color: #667085;
          }

          .kv span:last-child {
            text-align: right;
            font-weight: 500;
            color: #1d2939;
          }

          .table-wrap {
            overflow-x: auto;
          }

          .items-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            border: 1px solid var(--line);
            border-radius: 12px;
            overflow: hidden;
            font-size: 12px;
            table-layout: auto;
          }

          .items-table th,
          .items-table td {
            padding: 10px 12px;
            border-bottom: 1px solid var(--line);
            vertical-align: top;
            word-wrap: break-word;
            overflow-wrap: break-word;
          }

          .items-table thead th {
            background: var(--bg-soft);
            color: #344054;
            font-weight: 700;
            text-align: left;
            white-space: nowrap;
          }

          .items-table tbody tr:last-child td {
            border-bottom: none;
          }

          .td-wrap {
            white-space: normal;
            word-wrap: break-word;
            overflow-wrap: break-word;
            min-width: 0;
            vertical-align: top;
          }

          .note-cell {
            word-break: break-word;
            overflow-wrap: break-word;
            white-space: normal;
            min-width: 0;
            max-width: 100%;
          }

          .num {
            text-align: right;
            white-space: nowrap;
          }

          .font-mono {
            font-family: ui-monospace, monospace;
            font-size: 11px;
          }

          .empty-row {
            text-align: center;
            color: var(--muted);
            font-style: italic;
            padding: 16px;
          }

          .summary {
            max-width: 400px;
            border: 1px solid var(--line);
            border-radius: 12px;
            padding: 12px 16px;
            margin-top: 8px;
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
            font-size: 16px;
            font-weight: 800;
            color: #101828;
          }

          .summary-formula {
            font-size: 11px;
            color: var(--muted);
            margin-top: 10px;
            line-height: 1.5;
          }

          .footer {
            margin-top: 20px;
            border-top: 1px solid var(--line);
            padding-top: 12px;
          }

          .footer p {
            margin: 0;
            color: var(--muted);
            font-size: 11px;
            line-height: 1.5;
          }

          .section-stops-next-page {
            break-before: page;
            page-break-before: always;
          }

          @media print {
            .load-sheet {
              border: none;
              border-radius: 0;
              padding: 0;
              box-shadow: none;
            }
            .section-stops-next-page {
              break-before: page;
              page-break-before: always;
            }
          }
        </style>
      </head>
      <body>
        <main class="load-sheet">
          <section class="header">
            <div class="company">
              <div class="logo">
                <img src="${logoUrl}" alt="Raxsup Logo" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
                <div class="logo-fallback" style="display:none;">RX</div>
              </div>
              <div>
                <h2>${COMPANY_NAME}</h2>
                <p>${COMPANY_ADDRESS}</p>
                <p>${COMPANY_EMAIL}</p>
                <p>${COMPANY_PHONE}</p>
              </div>
            </div>
            <div class="load-meta">
              <h1>LOAD</h1>
              <p class="load-number">#${num}</p>
              <span class="status-badge">${escapeHtml(data.statusDisplay)}</span>
              <div class="export-line">Exported ${escapeHtml(data.exportedAt)}<br/>${escapeHtml(data.exportedBy)}</div>
            </div>
          </section>

          <section class="section">
            <h2 class="section-title">Load information</h2>
            <div class="detail-grid">
              <div class="panel">
                <p class="panel-label">Account</p>
                <span class="strong">${escapeHtml(L.customerName)}</span>
                <div class="kv"><span>Load type</span><span>${escapeHtml(L.loadType)}</span></div>
                <div class="kv"><span>Weight</span><span>${escapeHtml(L.loadWeight)}</span></div>
                <div class="kv"><span>Material</span><span>${escapeHtml(L.materialName)}</span></div>
                <div class="kv"><span>Created</span><span>${escapeHtml(L.createdAt)}</span></div>
                <div class="kv"><span>Pickup</span><span>${escapeHtml(L.pickup)}</span></div>
                <div class="kv"><span>Delivery</span><span>${escapeHtml(L.delivery)}</span></div>
              </div>
              <div class="panel">
                <p class="panel-label">General notes</p>
                <p>${L.generalNotes ? escapeHtml(L.generalNotes).replaceAll('\n', '<br/>') : '<em>None</em>'}</p>
              </div>
            </div>
          </section>

          <section class="section">
            <h2 class="section-title">Route</h2>
            <div class="panel">
              <p class="panel-label">Main lane</p>
              <p><span class="strong">${escapeHtml(R.origin)}</span> → <span class="strong">${escapeHtml(R.destination)}</span></p>
              <div class="kv"><span>Distance</span><span>${escapeHtml(R.distanceText)}</span></div>
              <div class="kv"><span>Est. transit</span><span>${escapeHtml(R.transitText)}</span></div>
              ${
                R.showDeadhead
                  ? `<p class="panel-label" style="margin-top:12px">Deadhead (empty miles)</p>
                <p>${escapeHtml(R.deadheadOrigin || '—')}</p>
                <p>${escapeHtml(R.deadheadDestination || '—')}</p>`
                  : ''
              }
            </div>
          </section>

          <section class="section">
            <h2 class="section-title">Financial summary</h2>
            <div class="summary">
              <div class="summary-row"><span>Base rate</span><strong>${escapeHtml(F.baseRate)}</strong></div>
              ${
                F.showDeadhead
                  ? `<div class="summary-row"><span>Deadhead</span><strong>${escapeHtml(F.deadhead)}</strong></div>`
                  : ''
              }
              <div class="summary-row"><span>Accessorials</span><strong>${escapeHtml(F.accessorials)}</strong></div>
              <div class="summary-row summary-total"><span>Total revenue</span><span>${escapeHtml(F.totalRevenue)}</span></div>
              <div class="summary-row"><span>Raxsup commission 15%</span><span>${escapeHtml(F.commission)}</span></div>
              <div class="summary-row"><span>Driver calculated amount</span><strong>${escapeHtml(F.driverAmount)}</strong></div>
              <p class="summary-formula">${escapeHtml(F.formulaLine)}</p>
            </div>
          </section>

          ${stopsSection}
          ${assignmentsSection}
          ${accessorialsSection}
          ${trackingBlock}

          <footer class="footer">
            <p>${FOOTER_TAGLINE}</p>
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
