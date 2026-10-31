import type JSZip from 'jszip'
import { arrowHead, wrapText } from '@/lib/lesson/script'
import { chartToSvg } from './chartSvg'
import { mediaType } from './pictures'
import { readRels, readXml, type Rel } from './ooxml'

// A slide's or a Word drawing's shapes, drawn as an SVG picture: the diagrams, flowcharts, labelled figures, tables, charts and
// SmartArt that are not picture files, so no reader finds them as pictures. Shapes, arrows and connectors, groups, text, tables,
// pictures, charts and SmartArt are drawn; the look is close to the original, not exact (fonts and effects are simplified).

const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const EMU_PT = 12700
const FURNITURE = new Set(['sldNum', 'sldImg', 'hdr', 'ftr', 'dt'])
const DARK = '#1f2937'

export interface Env {
  zip: JSZip
  theme: Record<string, string>
  /** the size of a point of text (a slide's default is 18, a Word drawing's 11) */
  defaultPt: number
  /** pictures used on many slides (a logo, a background) are left out */
  skipMedia?: Set<string>
  /** the size of a Word drawing, for a chart or SmartArt that has no frame of its own */
  box?: { w: number; h: number }
}
type Tf = { x: number; y: number; sx: number; sy: number } // a shape's own coordinates onto the board

const kids = (el: Element | null | undefined, name?: string) => (el ? Array.from(el.children).filter(c => !name || c.localName === name) : [])
const kid = (el: Element | null | undefined, name: string) => kids(el, name)[0] ?? null
const deep = (el: Element | null | undefined, name: string) => (el ? Array.from(el.getElementsByTagNameNS('*', name)) : [])
const num = (v: string | null | undefined, d = 0) => { const n = Number(v); return v != null && v !== '' && Number.isFinite(n) ? n : d }
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const f = (n: number) => String(Math.round(n * 100) / 100)

// ---- colour -------------------------------------------------------------------------------------------------------------
const PRESET: Record<string, string> = { black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff', yellow: '#ffff00', gray: '#808080', grey: '#808080', orange: '#ffa500', purple: '#800080' }
const SCHEME: Record<string, string> = { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2' }
const FALLBACK_THEME: Record<string, string> = { dk1: '#000000', lt1: '#ffffff', dk2: '#44546a', lt2: '#e7e6e6', accent1: '#4472c4', accent2: '#ed7d31', accent3: '#a5a5a5', accent4: '#ffc000', accent5: '#5b9bd5', accent6: '#70ad47' }

const toRgb = (h: string): [number, number, number] => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
const toHex = (c: number[]) => `#${c.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`
function lightness(hex: string) { const [r, g, b] = toRgb(hex); return (Math.max(r, g, b) + Math.min(r, g, b)) / 510 }
function withLightness(hex: string, fn: (l: number) => number) {
  const [r0, g0, b0] = toRgb(hex).map(v => v / 255), mx = Math.max(r0, g0, b0), mn = Math.min(r0, g0, b0), l = (mx + mn) / 2, d = mx - mn
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  const h = d === 0 ? 0 : mx === r0 ? ((g0 - b0) / d + 6) % 6 : mx === g0 ? (b0 - r0) / d + 2 : (r0 - g0) / d + 4
  const l2 = Math.min(1, Math.max(0, fn(l))), c = (1 - Math.abs(2 * l2 - 1)) * s, x = c * (1 - Math.abs((h % 2) - 1)), m = l2 - c / 2
  const [r, g, b] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x]
  return toHex([(r + m) * 255, (g + m) * 255, (b + m) * 255])
}

/** A colour element (srgbClr, schemeClr ...) as hex, with its lumMod, lumOff, tint and shade applied; null when it has none */
function colorOf(c: Element | null | undefined, env: Env): string | null {
  if (!c) return null
  const val = c.getAttribute('val') ?? ''
  let hex: string | null =
    c.localName === 'srgbClr' ? `#${val}` : c.localName === 'prstClr' ? PRESET[val] ?? null
    : c.localName === 'sysClr' ? `#${c.getAttribute('lastClr') ?? (val === 'window' ? 'ffffff' : '000000')}`
    : c.localName === 'schemeClr' ? env.theme[SCHEME[val] ?? val] ?? FALLBACK_THEME[SCHEME[val] ?? val] ?? null : null
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return null
  hex = hex.toLowerCase()
  for (const m of kids(c)) {
    const v = num(m.getAttribute('val'), 100000) / 100000
    if (m.localName === 'lumMod') hex = withLightness(hex, l => l * v)
    else if (m.localName === 'lumOff') hex = withLightness(hex, l => l + v)
    else if (m.localName === 'tint') hex = toHex(toRgb(hex).map(x => x * v + 255 * (1 - v)))
    else if (m.localName === 'shade') hex = toHex(toRgb(hex).map(x => x * v))
  }
  return hex
}
const solid = (fill: Element | null | undefined, env: Env) => colorOf(fill?.firstElementChild, env)

/** A fill: a colour, 'none', or null when the shape says nothing (the style decides) */
function fillOf(spPr: Element | null, env: Env): string | 'none' | null {
  for (const c of kids(spPr)) {
    if (c.localName === 'noFill') return 'none'
    if (c.localName === 'solidFill') return solid(c, env) ?? 'none'
    if (c.localName === 'gradFill') return colorOf(deep(c, 'gs')[0]?.firstElementChild, env) ?? 'none'
    if (c.localName === 'blipFill' || c.localName === 'pattFill') return 'none'
  }
  return null
}
type Line = { color: string; width: number; dash?: string; head?: boolean; tail?: boolean } | 'none'
function lineOf(spPr: Element | null, style: Element | null, env: Env): Line {
  const ln = kid(spPr, 'ln')
  const lnRef = kid(style, 'lnRef')
  const own = ln && kids(ln).find(c => /^(noFill|solidFill|gradFill)$/.test(c.localName))
  if (own?.localName === 'noFill') return 'none'
  let color = own ? (own.localName === 'solidFill' ? solid(own, env) : colorOf(deep(own, 'gs')[0]?.firstElementChild, env)) : null
  if (!color && lnRef && num(lnRef.getAttribute('idx')) > 0) color = colorOf(lnRef.firstElementChild, env)
  if (!color) return ln ? { color: DARK, width: num(ln.getAttribute('w'), 9525), head: false, tail: false } : 'none'
  const dash = kid(ln, 'prstDash')?.getAttribute('val')
  const end = (n: string) => { const t = kid(ln, n)?.getAttribute('type'); return !!t && t !== 'none' }
  return { color, width: Math.max(num(ln?.getAttribute('w'), 12700), 6000), dash: dash && dash !== 'solid' ? (dash.includes('sys') ? '3 3' : '8 5') : undefined, head: end('headEnd'), tail: end('tailEnd') }
}

// ---- geometry -----------------------------------------------------------------------------------------------------------
const poly = (pts: [number, number][]) => pts.map(([x, y]) => `${f(x)},${f(y)}`).join(' ')

/** A preset shape's outline, at the origin, w by h; adj are its adjust values (0 to 1 of the size) */
function preset(prst: string, w: number, h: number, adj: Record<string, number>, attrs: string): string {
  const m = Math.min(w, h)
  const a = (n: string, d: number) => adj[n] ?? adj.adj ?? d
  switch (prst) {
    case 'ellipse': case 'flowChartConnector': case 'flowChartOr': return `<ellipse cx="${f(w / 2)}" cy="${f(h / 2)}" rx="${f(w / 2)}" ry="${f(h / 2)}" ${attrs}/>`
    case 'roundRect': case 'round1Rect': case 'round2SameRect': case 'snip1Rect': case 'flowChartAlternateProcess': return `<rect width="${f(w)}" height="${f(h)}" rx="${f(m * a('adj1', 0.16667))}" ${attrs}/>`
    case 'flowChartTerminator': return `<rect width="${f(w)}" height="${f(h)}" rx="${f(h / 2)}" ${attrs}/>`
    case 'triangle': case 'flowChartExtract': return `<polygon points="${poly([[w * a('adj', 0.5), 0], [w, h], [0, h]])}" ${attrs}/>`
    case 'rtTriangle': return `<polygon points="${poly([[0, 0], [0, h], [w, h]])}" ${attrs}/>`
    case 'diamond': case 'flowChartDecision': return `<polygon points="${poly([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]])}" ${attrs}/>`
    case 'parallelogram': case 'flowChartData': { const o = w * Math.min(0.45, a('adj', 0.25) * (m / w)); return `<polygon points="${poly([[o, 0], [w, 0], [w - o, h], [0, h]])}" ${attrs}/>` }
    case 'trapezoid': case 'flowChartManualOperation': { const o = w * 0.2; return `<polygon points="${poly([[o, 0], [w - o, 0], [w, h], [0, h]])}" ${attrs}/>` }
    case 'hexagon': case 'flowChartPreparation': { const o = w * Math.min(0.4, a('adj', 0.25) * (m / w)); return `<polygon points="${poly([[o, 0], [w - o, 0], [w, h / 2], [w - o, h], [o, h], [0, h / 2]])}" ${attrs}/>` }
    case 'homePlate': case 'pentagon': { const o = Math.min(w * 0.5, h * 0.5); return `<polygon points="${poly([[0, 0], [w - o, 0], [w, h / 2], [w - o, h], [0, h]])}" ${attrs}/>` }
    case 'chevron': { const o = Math.min(w * 0.5, h * 0.5); return `<polygon points="${poly([[0, 0], [w - o, 0], [w, h / 2], [w - o, h], [0, h], [o, h / 2]])}" ${attrs}/>` }
    case 'rightArrow': case 'leftArrow': case 'upArrow': case 'downArrow': case 'leftRightArrow': {
      const vert = prst === 'upArrow' || prst === 'downArrow', L = vert ? h : w, T = vert ? w : h, hl = Math.min(T * 0.6, L * 0.5), s0 = T * 0.25, s1 = T * 0.75
      const pts: [number, number][] = prst === 'leftRightArrow'
        ? [[0, T / 2], [hl, 0], [hl, s0], [L - hl, s0], [L - hl, 0], [L, T / 2], [L - hl, T], [L - hl, s1], [hl, s1], [hl, T]]
        : [[0, s0], [L - hl, s0], [L - hl, 0], [L, T / 2], [L - hl, T], [L - hl, s1], [0, s1]]
      const at = (p: [number, number]): [number, number] => prst === 'rightArrow' || prst === 'leftRightArrow' ? p : prst === 'leftArrow' ? [L - p[0], p[1]] : prst === 'downArrow' ? [p[1], p[0]] : [p[1], L - p[0]]
      return `<polygon points="${poly(pts.map(at))}" ${attrs}/>`
    }
    case 'can': case 'cube': default: return `<rect width="${f(w)}" height="${f(h)}" ${attrs}/>`
  }
}
const isLine = (prst: string) => /^(line|straightConnector1|bentConnector\d|curvedConnector\d)$/.test(prst)
function linePath(prst: string, w: number, h: number): string {
  if (/^bentConnector2$/.test(prst)) return `M0,0 L${f(w)},0 L${f(w)},${f(h)}`
  if (/^bentConnector\d$/.test(prst)) return `M0,0 L${f(w / 2)},0 L${f(w / 2)},${f(h)} L${f(w)},${f(h)}`
  if (/^curvedConnector\d$/.test(prst)) return `M0,0 C${f(w / 2)},0 ${f(w / 2)},${f(h)} ${f(w)},${f(h)}`
  return `M0,0 L${f(w)},${f(h)}`
}
// the last stretch of a connector, to point its arrowhead along
const tailDir = (prst: string, w: number, h: number): [number, number, number, number] =>
  /^bentConnector\d$/.test(prst) ? (prst === 'bentConnector2' ? [w, 0, w, h] : [w / 2, h, w, h]) : /^curvedConnector\d$/.test(prst) ? [w / 2, h, w, h] : [0, 0, w, h]

// the first stretch of a connector, from where it bends back to where it starts, to point an arrowhead at its start along
const headDir = (prst: string, w: number, h: number): [number, number, number, number] =>
  prst === 'bentConnector2' ? [w, 0, 0, 0] : /^(bent|curved)Connector\d$/.test(prst) ? [w / 2, 0, 0, 0] : [w, h, 0, 0]

function custom(geom: Element, w: number, h: number, attrs: string, lw: number): string {
  const out: string[] = []
  for (const p of deep(geom, 'path')) {
    const pw = num(p.getAttribute('w'), w) || w, ph = num(p.getAttribute('h'), h) || h
    let d = ''
    const pt = (e: Element) => { const q = e.getElementsByTagNameNS('*', 'pt'); return Array.from(q).map(x => `${num(x.getAttribute('x'))},${num(x.getAttribute('y'))}`) }
    for (const c of kids(p)) {
      if (c.localName === 'moveTo') d += `M${pt(c)[0]} `
      else if (c.localName === 'lnTo') d += `L${pt(c)[0]} `
      else if (c.localName === 'cubicBezTo') d += `C${pt(c).join(' ')} `
      else if (c.localName === 'quadBezTo') d += `Q${pt(c).join(' ')} `
      else if (c.localName === 'close') d += 'Z '
    }
    if (d) out.push(`<g transform="scale(${f(w / pw)} ${f(h / ph)})"><path d="${d}" ${attrs.replace(/stroke-width="[\d.]+"/, `stroke-width="${f(lw / ((w / pw + h / ph) / 2))}"`)}${p.getAttribute('fill') === 'none' ? ' fill="none"' : ''}/></g>`)
  }
  return out.join('')
}

// ---- text ---------------------------------------------------------------------------------------------------------------
type Para = { text: string; size: number; bold: boolean; color: string | null; align: 'l' | 'ctr' | 'r' }

function paragraphs(shape: Element, env: Env): Para[] {
  const out: Para[] = []
  const tx = kid(shape, 'txBody')
  if (tx) {
    for (const p of kids(tx, 'p')) {
      const runs = kids(p).filter(c => /^(r|fld|br)$/.test(c.localName))
      const text = runs.map(r => (r.localName === 'br' ? ' ' : deep(r, 't').map(t => t.textContent ?? '').join(''))).join('').replace(/\s+/g, ' ').trim()
      if (!text) continue
      const rPr = runs.map(r => kid(r, 'rPr')).find(Boolean) ?? kid(p, 'endParaRPr')
      const algn = kid(p, 'pPr')?.getAttribute('algn')
      out.push({ text, size: num(rPr?.getAttribute('sz'), env.defaultPt * 100) / 100 * EMU_PT, bold: rPr?.getAttribute('b') === '1', color: solid(kid(rPr, 'solidFill'), env), align: algn === 'ctr' ? 'ctr' : algn === 'r' ? 'r' : 'l' })
    }
    return out
  }
  const word = deep(shape, 'txbxContent')[0] // a Word drawing's text box
  for (const p of deep(word, 'p')) {
    const text = deep(p, 't').map(t => t.textContent ?? '').join('').replace(/\s+/g, ' ').trim()
    if (!text) continue
    const rPr = deep(p, 'rPr')[0], sz = num(kid(rPr, 'sz')?.getAttribute('val'), env.defaultPt * 2) / 2
    const jc = deep(p, 'jc')[0]?.getAttribute('val')
    out.push({ text, size: sz * EMU_PT, bold: !!kid(rPr, 'b'), color: null, align: jc === 'center' ? 'ctr' : jc === 'right' ? 'r' : 'l' })
  }
  return out
}

/** The paragraphs written inside a w by h area at the origin, wrapped to fit, shrunk when they are too long for it */
function textSvg(paras: Para[], w: number, h: number, body: Element | null, boxy: boolean, fill: string | null): string {
  if (!paras.length || w <= 0 || h <= 0) return ''
  const l = num(body?.getAttribute('lIns'), 91440), r = num(body?.getAttribute('rIns'), 91440), t = num(body?.getAttribute('tIns'), 45720), b = num(body?.getAttribute('bIns'), 45720)
  const anchor = body?.getAttribute('anchor') ?? (boxy ? 't' : 'ctr')
  const scale0 = num(kid(body, 'normAutofit')?.getAttribute('fontScale'), 100000) / 100000
  const dark = fill && lightness(fill) < 0.42
  const inner = Math.max(w - l - r, 1)
  let scale = scale0, lines: { text: string; size: number; para: Para }[] = [], total = 0
  for (let i = 0; i < 8; i++) {
    lines = []; total = 0
    for (const p of paras) {
      const size = p.size * scale
      for (const text of wrapText(p.text, Math.max(3, Math.floor(inner / (size * 0.5))))) { lines.push({ text, size, para: p }); total += size * 1.2 }
    }
    if (total <= h - t - b + h * 0.05 || scale < 0.3) break
    scale *= 0.88
  }
  let y = anchor === 'b' ? h - b - total : anchor === 'ctr' ? (h - total) / 2 : t
  // The board is measured in EMU, where a font size is hundreds of thousands: browsers draw no text at that size. So the text is
  // written in thousandths and scaled back up, which draws the same.
  const K = 1000, out: string[] = []
  for (const ln of lines) {
    const p = ln.para, x = p.align === 'ctr' ? w / 2 : p.align === 'r' ? w - r : l
    out.push(`<text x="${f(x / K)}" y="${f((y + ln.size * 0.95) / K)}" text-anchor="${p.align === 'ctr' ? 'middle' : p.align === 'r' ? 'end' : 'start'}" font-size="${f(ln.size / K)}"${p.bold ? ' font-weight="700"' : ''} fill="${p.color ?? (dark ? '#ffffff' : DARK)}">${esc(ln.text)}</text>`)
    y += ln.size * 1.2
  }
  return out.length ? `<g transform="scale(${K})">${out.join('')}</g>` : ''
}

// ---- the tree -----------------------------------------------------------------------------------------------------------
const rotate = (rot: number, w: number, h: number) => (rot ? `translate(${f(w / 2)} ${f(h / 2)}) rotate(${f(rot)}) translate(${f(-w / 2)} ${f(-h / 2)})` : '')

/** A shape's place on the board, from its xfrm: x, y, w, h, rotation in degrees, flips */
function place(xfrm: Element | null, tf: Tf) {
  const off = kid(xfrm, 'off'), ext = kid(xfrm, 'ext')
  if (!off || !ext) return null
  return { x: tf.x + num(off.getAttribute('x')) * tf.sx, y: tf.y + num(off.getAttribute('y')) * tf.sy, w: num(ext.getAttribute('cx')) * tf.sx, h: num(ext.getAttribute('cy')) * tf.sy,
    rot: num(xfrm!.getAttribute('rot')) / 60000, flipH: xfrm!.getAttribute('flipH') === '1', flipV: xfrm!.getAttribute('flipV') === '1' }
}

async function renderShape(el: Element, env: Env, tf: Tf): Promise<string> {
  const ph = deep(el, 'ph')[0]
  if (ph && FURNITURE.has(ph.getAttribute('type') ?? '')) return ''
  if (deep(el, 'cNvPr')[0]?.getAttribute('hidden') === '1') return ''
  const spPr = kid(el, 'spPr'), style = kid(el, 'style')
  const at = place(kid(spPr, 'xfrm'), tf)
  if (!at) return '' // a placeholder with no place of its own takes it from its layout, which is not read
  const { x, y, w, h } = at
  const prst = kid(spPr, 'prstGeom')?.getAttribute('prst') ?? (kid(spPr, 'custGeom') ? 'cust' : el.localName === 'cxnSp' ? 'line' : 'rect')
  const adj: Record<string, number> = {}
  for (const g of deep(kid(spPr, 'prstGeom'), 'gd')) adj[g.getAttribute('name') ?? ''] = num(/val (-?\d+)/.exec(g.getAttribute('fmla') ?? '')?.[1]) / 100000
  const line = lineOf(spPr, style, env)
  const paras = paragraphs(el, env)
  let fill = fillOf(spPr, env)
  if (fill === null) { const fr = kid(style, 'fillRef'); fill = fr && num(fr.getAttribute('idx')) > 0 ? colorOf(fr.firstElementChild, env) ?? 'none' : 'none' }
  if (fill === 'none' && line === 'none' && !paras.length) return ''
  const lw = line === 'none' ? 0 : line.width * tf.sx
  const stroke = line === 'none' ? 'stroke="none"' : `stroke="${line.color}" stroke-width="${f(lw)}"${line.dash ? ` stroke-dasharray="${line.dash}"` : ''} stroke-linejoin="round"`
  const attrs = `fill="${fill === 'none' ? 'none' : fill}" ${stroke}`
  const flip = `${at.flipH ? `translate(${f(w)} 0) scale(-1 1)` : ''} ${at.flipV ? `translate(0 ${f(h)}) scale(1 -1)` : ''}`.trim()
  let shape = ''
  if (isLine(prst)) {
    if (line !== 'none') {
      const size = Math.max(lw * 3.4, 70000 * tf.sx), [x1, y1, x2, y2] = tailDir(prst, w, h)
      shape = `<path d="${linePath(prst, w, h)}" fill="none" ${stroke} stroke-linecap="round"/>`
      if (line.tail) shape += `<polygon points="${arrowHead(x1, y1, x2, y2, size)}" fill="${line.color}"/>`
      if (line.head) { const [a, b, c, d] = headDir(prst, w, h); shape += `<polygon points="${arrowHead(a, b, c, d, size)}" fill="${line.color}"/>` }
    }
  } else if (prst === 'cust') shape = custom(kid(spPr, 'custGeom')!, w, h, attrs, lw)
  else shape = preset(prst, w, h, adj, attrs)
  const body = kid(el, 'bodyPr') ?? kid(kid(el, 'txBody'), 'bodyPr')
  const boxy = el.getElementsByTagNameNS('*', 'cNvSpPr')[0]?.getAttribute('txBox') === '1' || !!ph
  const text = textSvg(paras, w, h, body, boxy, fill === 'none' ? null : fill)
  return `<g transform="translate(${f(x)} ${f(y)})"><g transform="${rotate(at.rot, w, h)}">${flip ? `<g transform="${flip}">${shape}</g>` : shape}${text}</g></g>`
}

async function imageUrl(env: Env, path: string): Promise<string | null> {
  const t = mediaType(path)
  if (!/^image\/(png|jpeg|gif|webp|bmp|svg\+xml)$/.test(t)) return null // Windows metafiles and TIFFs cannot be drawn by a browser
  const file = env.zip.file(path)
  return file ? `data:${t};base64,${await file.async('base64')}` : null
}
const relOf = (rels: Rel[], id: string | null | undefined) => rels.find(r => r.id === id)

async function renderPicture(el: Element, part: string, env: Env, tf: Tf): Promise<string> {
  const at = place(kid(kid(el, 'spPr'), 'xfrm'), tf)
  const blip = deep(el, 'blip')[0]
  if (!at || !blip) return ''
  const rel = relOf(await readRels(env.zip, part), blip.getAttributeNS(R_NS, 'embed') ?? blip.getAttribute('r:embed'))
  if (!rel || env.skipMedia?.has(rel.target)) return ''
  const href = await imageUrl(env, rel.target)
  if (!href) return ''
  const src = deep(el, 'srcRect')[0]
  const [cl, ct, cr, cb] = ['l', 't', 'r', 'b'].map(k => num(src?.getAttribute(k)) / 100000)
  const fw = at.w / Math.max(0.05, 1 - cl - cr), fh = at.h / Math.max(0.05, 1 - ct - cb)
  return `<g transform="translate(${f(at.x)} ${f(at.y)}) ${rotate(at.rot, at.w, at.h)}"><svg width="${f(at.w)}" height="${f(at.h)}" overflow="hidden"><image href="${href}" x="${f(-cl * fw)}" y="${f(-ct * fh)}" width="${f(fw)}" height="${f(fh)}" preserveAspectRatio="none"/></svg></g>`
}

async function renderTable(tbl: Element, env: Env, x: number, y: number, tf: Tf): Promise<string> {
  const cols = kids(kid(tbl, 'tblGrid'), 'gridCol').map(c => num(c.getAttribute('w')) * tf.sx)
  const out: string[] = []
  let yy = y
  for (const tr of kids(tbl, 'tr')) {
    const rh = num(tr.getAttribute('h')) * tf.sy
    let xx = x, ci = 0
    for (const tc of kids(tr, 'tc')) {
      const span = Math.max(1, num(tc.getAttribute('gridSpan'), 1)), cw = cols.slice(ci, ci + span).reduce((a, b) => a + b, 0)
      const fill = solid(kid(kid(tc, 'tcPr'), 'solidFill'), env)
      out.push(`<g transform="translate(${f(xx)} ${f(yy)})"><rect width="${f(cw)}" height="${f(rh)}" fill="${fill ?? '#ffffff'}" stroke="#cbd5e1" stroke-width="${f(9525 * tf.sx)}"/>${textSvg(paragraphs(tc, env), cw, rh, kid(tc, 'tcPr'), false, fill)}</g>`)
      xx += cw; ci += span
    }
    yy += rh
  }
  return out.join('')
}

async function renderFrame(el: Element, part: string, env: Env, tf: Tf): Promise<string> {
  const at = place(kid(el, 'xfrm'), tf)
  const data = deep(el, 'graphicData')[0]
  return at && data ? renderData(data, part, env, at, tf) : ''
}

/** What a graphic holds (a table, a chart, SmartArt), drawn in the box `at` */
async function renderData(data: Element, part: string, env: Env, at: { x: number; y: number; w: number; h: number }, tf: Tf): Promise<string> {
  const rels = await readRels(env.zip, part)
  const tbl = deep(data, 'tbl')[0]
  if (tbl) return renderTable(tbl, env, at.x, at.y, tf)
  const chartRef = deep(data, 'chart')[0]
  if (chartRef) {
    const rel = relOf(rels, chartRef.getAttributeNS(R_NS, 'id') ?? chartRef.getAttribute('r:id'))
    const doc = rel ? await readXml(env.zip, rel.target) : null
    const chart = doc && chartToSvg(doc)
    return chart ? `<svg x="${f(at.x)}" y="${f(at.y)}" width="${f(at.w)}" height="${f(at.h)}" viewBox="0 0 ${chart.w} ${chart.h}" preserveAspectRatio="xMidYMid meet">${chart.svg}</svg>` : ''
  }
  const dm = deep(data, 'relIds')[0]
  if (dm) { // SmartArt: its drawn shapes are kept in a part of their own
    const data0 = relOf(rels, dm.getAttributeNS(R_NS, 'dm') ?? dm.getAttribute('r:dm'))
    const dataDoc = data0 ? await readXml(env.zip, data0.target) : null
    const wanted = deep(dataDoc?.documentElement, 'dataModelExt')[0]?.getAttribute('relId')
    const rel = (wanted && relOf(rels, wanted)) || rels.find(r => /diagramDrawing$/.test(r.type))
    const doc = rel ? await readXml(env.zip, rel.target) : null
    const tree = doc && deep(doc.documentElement, 'spTree')[0]
    return tree ? renderTree(tree, rel!.target, env, { x: at.x, y: at.y, sx: tf.sx, sy: tf.sy }) : ''
  }
  return ''
}

export async function renderTree(tree: Element, part: string, env: Env, tf: Tf): Promise<string> {
  let out = ''
  for (const node of kids(tree)) {
    const n = node.localName
    if (n === 'grpSp' || n === 'wgp') {
      const xfrm = kid(kid(node, 'grpSpPr'), 'xfrm'), off = kid(xfrm, 'off'), ext = kid(xfrm, 'ext'), cho = kid(xfrm, 'chOff'), che = kid(xfrm, 'chExt')
      let g = tf
      if (off && ext && che) {
        const rx = num(che.getAttribute('cx')) ? num(ext.getAttribute('cx')) / num(che.getAttribute('cx')) : 1, ry = num(che.getAttribute('cy')) ? num(ext.getAttribute('cy')) / num(che.getAttribute('cy')) : 1
        g = { x: tf.x + tf.sx * (num(off.getAttribute('x')) - num(cho?.getAttribute('x')) * rx), y: tf.y + tf.sy * (num(off.getAttribute('y')) - num(cho?.getAttribute('y')) * ry), sx: tf.sx * rx, sy: tf.sy * ry }
      }
      out += await renderTree(node, part, env, g)
    } else if (n === 'sp' || n === 'wsp' || n === 'cxnSp') out += await renderShape(node, env, tf)
    else if (n === 'pic') out += await renderPicture(node, part, env, tf)
    else if (n === 'graphicFrame') out += await renderFrame(node, part, env, tf)
    else if (n === 'drawing' || n === 'inline' || n === 'anchor' || n === 'graphic') out += await renderTree(node, part, env, tf)
    else if (n === 'graphicData') {
      // in Word a chart or SmartArt is the whole drawing, with no frame of its own: it fills the drawing's size
      if (env.box && (deep(node, 'chart').length || deep(node, 'relIds').length)) out += await renderData(node, part, env, { x: tf.x, y: tf.y, ...env.box }, tf)
      else out += await renderTree(node, part, env, tf)
    }
    else if (n === 'AlternateContent') { const c = kid(node, 'Choice'); if (c) out += await renderTree(c, part, env, tf) }
  }
  return out
}

/** A board of the given size (in EMU) drawn from a shape tree, as a whole SVG picture */
export async function treeToSvg(tree: Element, part: string, env: Env, width: number, height: number, origin?: Tf): Promise<string> {
  const body = await renderTree(tree, part, env, origin ?? { x: 0, y: 0, sx: 1, sy: 1 })
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(width)} ${f(height)}" width="${f(width / 9525)}" height="${f(height / 9525)}" font-family="Arial, Helvetica, sans-serif"><rect width="${f(width)}" height="${f(height)}" fill="#ffffff"/>${body}</svg>`
}

/**
 * Whether a slide's shape tree holds something to look at that its text does not say: a picture that is not on every slide, a chart,
 * a table of more than text, SmartArt, an arrow or connector, a freehand shape, or several drawn shapes.
 */
export function hasVisualAid(tree: Element, skip?: Set<string>, rels: Rel[] = []): boolean {
  let drawn = 0
  const walk = (t: Element): boolean => {
    for (const node of kids(t)) {
      const n = node.localName
      if (n === 'grpSp') { if (walk(node)) return true }
      else if (n === 'cxnSp') return true
      else if (n === 'pic') {
        const id = deep(node, 'blip')[0]?.getAttributeNS(R_NS, 'embed') ?? deep(node, 'blip')[0]?.getAttribute('r:embed')
        const target = relOf(rels, id)?.target
        if (!skip || !target || !skip.has(target)) return true
      } else if (n === 'graphicFrame') { const d = deep(node, 'graphicData')[0]; if (deep(d, 'chart').length || deep(d, 'relIds').length) return true }
      else if (n === 'sp') {
        const ph = deep(node, 'ph')[0], spPr = kid(node, 'spPr')
        if (ph || node.getElementsByTagNameNS('*', 'cNvSpPr')[0]?.getAttribute('txBox') === '1') continue
        if (kid(spPr, 'custGeom')) return true
        const prst = kid(spPr, 'prstGeom')?.getAttribute('prst') ?? 'rect'
        if (fillOf(spPr, { theme: {}, zip: null as never, defaultPt: 18 }) !== 'none' || kid(spPr, 'ln')) { if (prst !== 'rect' || !deep(node, 't').length) drawn++ }
      }
    }
    return false
  }
  return walk(tree) || drawn >= 2
}
