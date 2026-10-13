import { HIGHLIGHT_ALPHA, HIGHLIGHT_FACTOR, strokeWidth, textSize, type Mark, type Pt } from './marks'

type Ctx = CanvasRenderingContext2D

function arrowHead(ctx: Ctx, from: Pt, to: Pt, width: number) {
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]), len = width * 4.5
  ctx.beginPath()
  ctx.moveTo(to[0], to[1])
  ctx.lineTo(to[0] - len * Math.cos(angle - Math.PI / 7), to[1] - len * Math.sin(angle - Math.PI / 7))
  ctx.moveTo(to[0], to[1])
  ctx.lineTo(to[0] - len * Math.cos(angle + Math.PI / 7), to[1] - len * Math.sin(angle + Math.PI / 7))
  ctx.stroke()
}

/** Draws one mark; `imageWidth` is the picture's own width, which sizes strokes and text */
export function drawMark(ctx: Ctx, m: Mark, imageWidth: number) {
  const w = strokeWidth(m.size, imageWidth)
  ctx.save()
  ctx.strokeStyle = m.color; ctx.fillStyle = m.color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  switch (m.kind) {
    case 'pen': case 'highlighter': {
      if (m.kind === 'highlighter') { ctx.globalAlpha = HIGHLIGHT_ALPHA; ctx.lineWidth = w * HIGHLIGHT_FACTOR; ctx.lineCap = 'butt' }
      if (m.points.length === 1) {
        ctx.beginPath(); ctx.arc(m.points[0][0], m.points[0][1], ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill()
      } else {
        ctx.beginPath(); ctx.moveTo(m.points[0][0], m.points[0][1])
        for (const p of m.points.slice(1)) ctx.lineTo(p[0], p[1])
        ctx.stroke()
      }
      break
    }
    case 'line': case 'arrow':
      ctx.beginPath(); ctx.moveTo(m.from[0], m.from[1]); ctx.lineTo(m.to[0], m.to[1]); ctx.stroke()
      if (m.kind === 'arrow') arrowHead(ctx, m.from, m.to, w)
      break
    case 'rect':
      ctx.strokeRect(Math.min(m.from[0], m.to[0]), Math.min(m.from[1], m.to[1]), Math.abs(m.to[0] - m.from[0]), Math.abs(m.to[1] - m.from[1]))
      break
    case 'ellipse':
      ctx.beginPath()
      ctx.ellipse((m.from[0] + m.to[0]) / 2, (m.from[1] + m.to[1]) / 2, Math.abs(m.to[0] - m.from[0]) / 2, Math.abs(m.to[1] - m.from[1]) / 2, 0, 0, Math.PI * 2)
      ctx.stroke()
      break
    case 'text':
      ctx.font = `600 ${textSize(m.size, imageWidth)}px system-ui, sans-serif`; ctx.textBaseline = 'top'
      ctx.fillText(m.text, m.at[0], m.at[1])
      break
  }
  ctx.restore()
}

export function drawMarks(ctx: Ctx, marks: Mark[], imageWidth: number) {
  for (const m of marks) drawMark(ctx, m, imageWidth)
}

/** The picture (or a white page) with every mark on it, as a WebP file ready to store */
export async function flatten(
  base: CanvasImageSource | null, width: number, height: number, marks: Mark[],
  makeCanvas: (w: number, h: number) => HTMLCanvasElement = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h }),
): Promise<Blob> {
  const canvas = makeCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no canvas')
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height)
  if (base) ctx.drawImage(base, 0, 0, width, height)
  drawMarks(ctx, marks, width)
  const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/webp', 0.85))
  if (!blob) throw new Error('could not save')
  return blob
}
