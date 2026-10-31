// A chart from a Word or PowerPoint file, drawn as a picture: its bars, lines or pie from the numbers saved in the file. Column, bar,
// line, area, pie and doughnut charts are drawn; anything else (scatter, radar, stock) returns null and is left out.

const W = 800, H = 450
const PALETTE = ['#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47', '#9e480e', '#636363']
const INK = '#374151', GRID = '#e5e7eb'

const kids = (el: Element | null | undefined, name?: string) => (el ? Array.from(el.children).filter(c => !name || c.localName === name) : [])
const kid = (el: Element | null | undefined, name: string) => kids(el, name)[0] ?? null
const deep = (el: Element | null | undefined, name: string) => (el ? Array.from(el.getElementsByTagNameNS('*', name)) : [])
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

// The cached values of a series' categories, names or numbers, in order
function points(el: Element | null): string[] {
  const out: string[] = []
  for (const pt of deep(el, 'pt')) out[Number(pt.getAttribute('idx') ?? out.length)] = pt.getElementsByTagNameNS('*', 'v')[0]?.textContent ?? ''
  return Array.from(out, v => v ?? '')
}
const textOf = (el: Element | null) => deep(el, 't').map(t => t.textContent ?? '').join('').trim()

function niceMax(v: number): number {
  if (v <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(v)), n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p
}
const fmt = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v * 100) / 100))

type Series = { name: string; values: number[]; color: string }

export function chartToSvg(doc: Document): { svg: string; w: number; h: number } | null {
  const chart = kid(doc.documentElement, 'chart')
  const plot = kid(chart, 'plotArea')
  const el = kids(plot).find(c => /^(bar|bar3D|line|line3D|area|area3D|pie|pie3D|doughnut)Chart$/.test(c.localName))
  if (!chart || !el) return null
  const type = el.localName.replace(/3D$/, '').replace('Chart', '')
  const sers = kids(el, 'ser')
  if (!sers.length) return null
  const cats = points(kid(sers[0], 'cat'))
  const series: Series[] = sers.map((s, i) => {
    const own = deep(kid(s, 'spPr'), 'srgbClr')[0]?.getAttribute('val')
    // the name is written in the series (<c:tx><c:v>) or kept with its cell (<c:tx><c:strRef><c:strCache><c:pt><c:v>)
    return { name: deep(kid(s, 'tx'), 'v')[0]?.textContent?.trim() || `Series ${i + 1}`, values: points(kid(s, 'val')).map(v => Number(v) || 0), color: own ? `#${own}` : PALETTE[i % PALETTE.length] }
  })
  const n = Math.max(cats.length, ...series.map(s => s.values.length))
  if (!n) return null
  const title = textOf(kid(chart, 'title'))
  const legend = !!kid(chart, 'legend')
  const out: string[] = [`<rect width="${W}" height="${H}" fill="#fff"/>`]
  if (title) out.push(`<text x="${W / 2}" y="26" text-anchor="middle" font-size="20" font-weight="600" fill="${INK}">${esc(clip(title, 70))}</text>`)
  const top = title ? 46 : 18

  if (type === 'pie' || type === 'doughnut') {
    const vals = series[0].values.map(v => Math.max(0, v)), sum = vals.reduce((a, b) => a + b, 0)
    if (!sum) return null
    const cx = 250, cy = top + (H - top - 20) / 2, r = Math.min(190, (H - top - 30) / 2)
    let a0 = -Math.PI / 2
    vals.forEach((v, i) => {
      const a1 = a0 + (v / sum) * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0, color = PALETTE[i % PALETTE.length]
      const p = (a: number, rr = r) => `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`
      out.push(vals.filter(x => x > 0).length === 1
        ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`
        : `<path d="M${cx},${cy} L${p(a0)} A${r},${r} 0 ${big} 1 ${p(a1)} Z" fill="${color}" stroke="#fff" stroke-width="2"/>`)
      if (v / sum >= 0.05) { const m = (a0 + a1) / 2; out.push(`<text x="${(cx + r * 0.62 * Math.cos(m)).toFixed(1)}" y="${(cy + r * 0.62 * Math.sin(m)).toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="15" font-weight="600" fill="#fff">${Math.round((v / sum) * 100)}%</text>`) }
      a0 = a1
    })
    if (type === 'doughnut') out.push(`<circle cx="${cx}" cy="${cy}" r="${r * 0.5}" fill="#fff"/>`)
    vals.forEach((_, i) => {
      const y = top + 16 + i * 26
      if (y < H - 14) out.push(`<rect x="500" y="${y - 10}" width="16" height="16" rx="3" fill="${PALETTE[i % PALETTE.length]}"/><text x="524" y="${y + 3}" font-size="15" fill="${INK}">${esc(clip(cats[i] || `Item ${i + 1}`, 28))}</text>`)
    })
    return { svg: out.join(''), w: W, h: H }
  }

  const left = 64, right = 24, bottom = legend ? 84 : 58, plotW = W - left - right, plotH = H - top - bottom
  const horizontal = type === 'bar' && kid(el, 'barDir')?.getAttribute('val') === 'bar'
  const stacked = type === 'bar' && /stacked|percentStacked/i.test(kid(el, 'grouping')?.getAttribute('val') ?? '')
  const totals = Array.from({ length: n }, (_, i) => series.reduce((a, s) => a + Math.max(0, s.values[i] ?? 0), 0))
  const max = niceMax(stacked || type === 'area' && /stacked/i.test(kid(el, 'grouping')?.getAttribute('val') ?? '') ? Math.max(...totals) : Math.max(...series.flatMap(s => s.values), 0))
  const min = Math.min(0, ...series.flatMap(s => s.values))
  const lo = min < 0 ? -niceMax(-min) : 0, span = max - lo
  const yOf = (v: number) => top + plotH - ((v - lo) / span) * plotH // a value up a column chart
  const xOf = (v: number) => left + ((v - lo) / span) * plotW // a value along a bar chart
  for (let i = 0; i <= 5; i++) {
    const v = lo + (span * i) / 5
    if (horizontal) out.push(`<line x1="${xOf(v)}" y1="${top}" x2="${xOf(v)}" y2="${top + plotH}" stroke="${GRID}"/><text x="${xOf(v)}" y="${top + plotH + 18}" text-anchor="middle" font-size="13" fill="${INK}">${fmt(v)}</text>`)
    else out.push(`<line x1="${left}" y1="${yOf(v)}" x2="${left + plotW}" y2="${yOf(v)}" stroke="${GRID}"/><text x="${left - 8}" y="${yOf(v)}" text-anchor="end" dominant-baseline="central" font-size="13" fill="${INK}">${fmt(v)}</text>`)
  }
  const band = (horizontal ? plotH : plotW) / n
  const showValues = !!deep(el, 'showVal').find(v => v.getAttribute('val') === '1')
  const valueLabel = (x: number, y: number, v: number, anchor = 'middle') => showValues ? `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="12" fill="${INK}">${fmt(v)}</text>` : ''
  for (let i = 0; i < n; i++) {
    const label = clip(cats[i] ?? String(i + 1), 14)
    if (horizontal) out.push(`<text x="${left - 8}" y="${top + band * (i + 0.5)}" text-anchor="end" dominant-baseline="central" font-size="13" fill="${INK}">${esc(label)}</text>`)
    else out.push(`<text x="${left + band * (i + 0.5)}" y="${top + plotH + 20}" text-anchor="middle" font-size="13" fill="${INK}">${esc(label)}</text>`)
  }
  if (type === 'bar') {
    const per = stacked ? 1 : series.length, bw = (band * 0.72) / per
    series.forEach((s, si) => s.values.forEach((v, i) => {
      const base = stacked ? series.slice(0, si).reduce((a, q) => a + Math.max(0, q.values[i] ?? 0), 0) : 0
      const off = band * 0.14 + (stacked ? 0 : si * bw)
      if (horizontal) out.push(`<rect x="${xOf(Math.min(base, base + v))}" y="${top + band * i + off}" width="${Math.abs(xOf(base + v) - xOf(base))}" height="${bw}" fill="${s.color}"/>${valueLabel(xOf(base + v) + 4, top + band * i + off + bw / 2 + 4, v, 'start')}`)
      else out.push(`<rect x="${left + band * i + off}" y="${Math.min(yOf(base), yOf(base + v))}" width="${bw}" height="${Math.abs(yOf(base) - yOf(base + v))}" fill="${s.color}"/>${valueLabel(left + band * i + off + bw / 2, yOf(base + v) - 5, v)}`)
    }))
  } else {
    series.forEach(s => {
      const pts = s.values.map((v, i) => `${(left + band * (i + 0.5)).toFixed(1)},${yOf(v).toFixed(1)}`)
      if (type === 'area') out.push(`<polygon points="${left + band * 0.5},${yOf(Math.max(lo, 0))} ${pts.join(' ')} ${left + band * (s.values.length - 0.5)},${yOf(Math.max(lo, 0))}" fill="${s.color}" fill-opacity="0.45"/>`)
      out.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${s.color}" stroke-width="3" stroke-linejoin="round"/>`)
      s.values.forEach((v, i) => out.push(`<circle cx="${left + band * (i + 0.5)}" cy="${yOf(v)}" r="4" fill="${s.color}"/>${valueLabel(left + band * (i + 0.5), yOf(v) - 9, v)}`))
    })
  }
  out.push(`<line x1="${left}" y1="${top + plotH}" x2="${left + plotW}" y2="${top + plotH}" stroke="#9ca3af"/><line x1="${left}" y1="${top}" x2="${left}" y2="${top + plotH}" stroke="#9ca3af"/>`)
  if (legend || series.length > 1) {
    let x = left
    series.forEach(s => {
      out.push(`<rect x="${x}" y="${H - 22}" width="14" height="14" rx="3" fill="${s.color}"/><text x="${x + 20}" y="${H - 10}" font-size="14" fill="${INK}">${esc(clip(s.name, 22))}</text>`)
      x += 34 + Math.min(s.name.length, 22) * 7.5
    })
  }
  return { svg: out.join(''), w: W, h: H }
}
