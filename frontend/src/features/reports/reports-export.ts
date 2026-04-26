import type { ProfitabilityReport, TimeReport } from '@/features/reports/api'

function downloadText(filename: string, mime: string, body: string) {
  const blob = new Blob([body], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) {
    return `"${s.replaceAll('"', '""')}"`
  }
  return s
}

function fmtMoney(n: number) {
  return n.toFixed(2)
}

export function exportTimeReportCsv(
  r: TimeReport,
  subTab: string,
  name = 'time-report',
) {
  const lines: string[] = []
  if (subTab === 'team') {
    lines.push('Name,Hours,Utilization %,Billable hours,Billable amount')
    for (const row of r.rows) {
      lines.push(
        [
          row.name,
          String(row.hours),
          row.utilizationPercent == null
            ? ''
            : String(Math.round(row.utilizationPercent * 10) / 10),
          String(row.billableHours),
          fmtMoney(row.billableAmount),
        ]
          .map(escapeCsv)
          .join(','),
      )
    }
    lines.push(
      [
        'Total',
        String(r.totals.hours),
        '',
        String(r.totals.billableHours),
        fmtMoney(r.totals.billableAmount),
      ]
        .map(escapeCsv)
        .join(','),
    )
  } else if (subTab === 'projects' || subTab === 'tasks') {
    lines.push('Name,Client,Hours,Billable hours,Billable amount')
    for (const row of r.rows) {
      lines.push(
        [
          row.name,
          row.clientName ?? '',
          String(row.hours),
          String(row.billableHours),
          fmtMoney(row.billableAmount),
        ]
          .map(escapeCsv)
          .join(','),
      )
    }
    lines.push(
      [
        'Total',
        '',
        String(r.totals.hours),
        String(r.totals.billableHours),
        fmtMoney(r.totals.billableAmount),
      ]
        .map(escapeCsv)
        .join(','),
    )
  } else {
    lines.push('Name,Hours,Billable hours,Billable amount')
    for (const row of r.rows) {
      lines.push(
        [
          row.name,
          String(row.hours),
          String(row.billableHours),
          fmtMoney(row.billableAmount),
        ]
          .map(escapeCsv)
          .join(','),
      )
    }
    lines.push(
      [
        'Total',
        String(r.totals.hours),
        String(r.totals.billableHours),
        fmtMoney(r.totals.billableAmount),
      ]
        .map(escapeCsv)
        .join(','),
    )
  }
  downloadText(`${name}.csv`, 'text/csv', '\uFEFF' + lines.join('\n'))
}

export function exportProfitabilityCsv(
  r: ProfitabilityReport,
  subTab: string,
  name = 'profitability-report',
) {
  if (subTab === 'projects') {
    const lines: string[] = [
      'Name,Client,Revenue,Cost,Profit,Return on cost %',
      ...r.rows.map((x) =>
        [
          x.name,
          x.clientName ?? '',
          fmtMoney(x.revenue),
          fmtMoney(x.cost),
          fmtMoney(x.profit),
          x.returnOnCostPercent == null
            ? ''
            : String(x.returnOnCostPercent),
        ]
          .map(escapeCsv)
          .join(','),
      ),
      [
        'Total',
        '',
        fmtMoney(r.totals.revenue),
        fmtMoney(r.totals.cost),
        fmtMoney(r.totals.profit),
        '',
      ]
        .map(escapeCsv)
        .join(','),
    ]
    downloadText(
      `${name}.csv`,
      'text/csv',
      '\uFEFF' + lines.join('\n'),
    )
  } else {
    const lines: string[] = [
      'Name,Revenue,Cost,Profit,Return on cost %',
      ...r.rows.map((x) =>
        [
          x.name,
          fmtMoney(x.revenue),
          fmtMoney(x.cost),
          fmtMoney(x.profit),
          x.returnOnCostPercent == null
            ? ''
            : String(x.returnOnCostPercent),
        ]
          .map(escapeCsv)
          .join(','),
      ),
      [
        'Total',
        fmtMoney(r.totals.revenue),
        fmtMoney(r.totals.cost),
        fmtMoney(r.totals.profit),
        '',
      ]
        .map(escapeCsv)
        .join(','),
    ]
    downloadText(
      `${name}.csv`,
      'text/csv',
      '\uFEFF' + lines.join('\n'),
    )
  }
}

export async function exportTimeReportPdf(
  r: TimeReport,
  subTab: string,
  name = 'time-report',
) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  doc.setFontSize(12)
  doc.text('Time report', 40, 40)
  doc.setFontSize(9)
  doc.text(
    `Range: ${r.range.fromYmd} to ${r.range.toYmd}  (${r.range.currency})`,
    40,
    60,
  )

  let head: string[][]
  if (subTab === 'team') {
    head = [['Name', 'Hours', 'Util. %', 'Billable h', 'Billable amt']]
  } else if (subTab === 'projects' || subTab === 'tasks') {
    head = [['Name', 'Client', 'Hours', 'Billable h', 'Billable amt']]
  } else {
    head = [['Name', 'Hours', 'Billable h', 'Billable amt']]
  }
  const body: string[][] = r.rows.map((row) => {
    if (subTab === 'team') {
      return [
        row.name,
        String(row.hours),
        row.utilizationPercent == null
          ? ''
          : String(Math.round(row.utilizationPercent * 10) / 10),
        String(row.billableHours),
        fmtMoney(row.billableAmount),
      ]
    }
    if (subTab === 'projects' || subTab === 'tasks') {
      return [
        row.name,
        row.clientName ?? '',
        String(row.hours),
        String(row.billableHours),
        fmtMoney(row.billableAmount),
      ]
    }
    return [
      row.name,
      String(row.hours),
      String(row.billableHours),
      fmtMoney(row.billableAmount),
    ]
  })
  let foot: string[][]
  if (subTab === 'team') {
    foot = [
      [
        'Total',
        String(r.totals.hours),
        '',
        String(r.totals.billableHours),
        fmtMoney(r.totals.billableAmount),
      ],
    ]
  } else if (subTab === 'projects' || subTab === 'tasks') {
    foot = [
      [
        'Total',
        '',
        String(r.totals.hours),
        String(r.totals.billableHours),
        fmtMoney(r.totals.billableAmount),
      ],
    ]
  } else {
    foot = [
      [
        'Total',
        String(r.totals.hours),
        String(r.totals.billableHours),
        fmtMoney(r.totals.billableAmount),
      ],
    ]
  }
  autoTable(doc, {
    startY: 72,
    head,
    body,
    foot,
    showFoot: 'lastPage',
    headStyles: { fillColor: [30, 99, 170] as [number, number, number] },
  })
  doc.save(`${name}.pdf`)
}

export async function exportProfitabilityPdf(
  r: ProfitabilityReport,
  subTab: string,
  name = 'profitability-report',
) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  doc.setFontSize(12)
  doc.text('Profitability report', 40, 40)
  doc.setFontSize(9)
  doc.text(
    `Range: ${r.range.fromYmd} to ${r.range.toYmd}  (${r.range.currency})`,
    40,
    60,
  )

  const withClient = subTab === 'projects'
  const head = withClient
    ? [['Name', 'Client', 'Revenue', 'Cost', 'Profit', 'RoC %']]
    : [['Name', 'Revenue', 'Cost', 'Profit', 'RoC %']]
  const body = withClient
    ? r.rows.map((x) => [
        x.name,
        x.clientName ?? '',
        fmtMoney(x.revenue),
        fmtMoney(x.cost),
        fmtMoney(x.profit),
        x.returnOnCostPercent == null
          ? ''
          : String(x.returnOnCostPercent),
      ])
    : r.rows.map((x) => [
        x.name,
        fmtMoney(x.revenue),
        fmtMoney(x.cost),
        fmtMoney(x.profit),
        x.returnOnCostPercent == null
          ? ''
          : String(x.returnOnCostPercent),
      ])
  const tr = r.totals
  const foot = withClient
    ? [
        [
          'Total',
          '',
          fmtMoney(tr.revenue),
          fmtMoney(tr.cost),
          fmtMoney(tr.profit),
          '',
        ],
      ]
    : [
        [
          'Total',
          fmtMoney(tr.revenue),
          fmtMoney(tr.cost),
          fmtMoney(tr.profit),
          '',
        ],
      ]
  autoTable(doc, {
    startY: 72,
    head,
    body,
    foot,
    showFoot: 'lastPage',
    headStyles: { fillColor: [30, 99, 170] as [number, number, number] },
  })
  doc.save(`${name}.pdf`)
}
