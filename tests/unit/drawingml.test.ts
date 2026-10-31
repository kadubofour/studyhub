// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { hasVisualAid, treeToSvg, type Env } from '@/lib/import/drawingml'
import { chartToSvg } from '@/lib/import/chartSvg'
import { parseXml, readRels } from '@/lib/import/ooxml'

const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"'
const tree = (inner: string) => parseXml(`<?xml version="1.0"?><p:sld ${NS}><p:cSld><p:spTree>${inner}</p:spTree></p:cSld></p:sld>`).getElementsByTagNameNS('*', 'spTree')[0]
const xfrm = (x: number, y: number, w: number, h: number, extra = '') => `<a:xfrm${extra}><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>`
const box = (id: string, text: string, x: number, y: number, w = 2000000, h = 800000, extra = '', geom = '<a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom>', fill = '<a:solidFill><a:srgbClr val="4472C4"/></a:solidFill>') =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>${xfrm(x, y, w, h, extra)}${geom}${fill}<a:ln w="12700"><a:solidFill><a:srgbClr val="1F3864"/></a:solidFill></a:ln></p:spPr><p:txBody><a:bodyPr/><a:p><a:pPr algn="ctr"/><a:r><a:rPr sz="1600"/><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`
const arrow = (x: number, y: number, w: number, h: number) =>
  `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="9" name="c"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr>${xfrm(x, y, w, h)}<a:prstGeom prst="straightConnector1"/><a:ln w="19050"><a:solidFill><a:srgbClr val="333333"/></a:solidFill><a:tailEnd type="triangle"/></a:ln></p:spPr></p:cxnSp>`
const textBox = (text: string) => `<p:sp><p:nvSpPr><p:cNvPr id="3" name="t"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr>${xfrm(0, 0, 3000000, 400000)}<a:prstGeom prst="rect"/></p:spPr><p:txBody><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`
async function env(parts: Record<string, string> = {}): Promise<Env> {
  const zip = new JSZip()
  for (const [k, v] of Object.entries(parts)) zip.file(k, v)
  return { zip, theme: { accent1: '#4472c4', dk1: '#000000', lt1: '#ffffff' }, defaultPt: 18, skipMedia: new Set() }
}
const draw = async (inner: string, e?: Env) => treeToSvg(tree(inner), 'ppt/slides/slide1.xml', e ?? await env(), 9144000, 5143500)

describe('drawing a slide\'s shapes', () => {
  it('draws a rounded box with its fill, its outline and its text, and an arrow with its head', async () => {
    const svg = await draw(box('1', 'Acetyl-CoA', 500000, 500000) + arrow(2600000, 900000, 1500000, 0))
    expect(svg).toMatch(/^<svg [^>]*viewBox="0 0 9144000 5143500"/)
    expect(svg).toContain('fill="#4472c4"')
    expect(svg).toContain('stroke="#1f3864"')
    expect(svg).toMatch(/<rect [^>]*rx="[\d.]+"/) // rounded
    expect(svg).toContain('Acetyl-CoA')
    expect(svg).toMatch(/<path d="M0,0 L1500000,0"[^>]*stroke="#333333"/)
    expect(svg).toMatch(/<polygon points="[^"]+" fill="#333333"/) // the head
  })
  it('puts text in white on a dark shape, and wraps it to the shape\'s width', async () => {
    const dark = await draw(box('1', 'Light reactions in the thylakoid membrane', 0, 0, 1000000, 1200000))
    expect(dark).toContain('fill="#ffffff"')
    expect([...dark.matchAll(/<text /g)].length).toBeGreaterThan(1)
  })
  it('colours from the theme, with lighter and darker shades', async () => {
    const scheme = (mods: string) => `<a:solidFill><a:schemeClr val="accent1">${mods}</a:schemeClr></a:solidFill>`
    const plain = await draw(box('1', 'x', 0, 0, 1000000, 800000, '', undefined, scheme('')))
    const light = await draw(box('1', 'x', 0, 0, 1000000, 800000, '', undefined, scheme('<a:lumMod val="40000"/><a:lumOff val="60000"/>')))
    expect(plain).toContain('fill="#4472c4"')
    const lightFill = /<rect [^>]*fill="(#[0-9a-f]{6})"/.exec(light)![1]
    expect(lightFill).not.toBe('#4472c4')
    expect(parseInt(lightFill.slice(1, 3), 16)).toBeGreaterThan(0xb0) // pale
  })
  it('draws each preset outline: an oval, a diamond, a hexagon and block arrows', async () => {
    const shapes = (g: string) => draw(box('1', 'x', 0, 0, 1000000, 800000, '', `<a:prstGeom prst="${g}"/>`))
    expect(await shapes('ellipse')).toContain('<ellipse')
    expect(await shapes('diamond')).toMatch(/<polygon points="500000,0 1000000,400000 500000,800000 0,400000"/)
    expect(await shapes('hexagon')).toMatch(/<polygon points="(?:[\d.-]+,[\d.-]+ ?){6}"/)
    expect(await shapes('rightArrow')).toMatch(/<polygon points="(?:[\d.-]+,[\d.-]+ ?){7}"/)
  })
  it('keeps a group\'s shapes in the group\'s place and size', async () => {
    const group = `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="5" name="g"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="1000000" y="1000000"/><a:ext cx="2000000" cy="1000000"/><a:chOff x="0" y="0"/><a:chExt cx="4000000" cy="2000000"/></a:xfrm></p:grpSpPr>${box('6', 'In group', 2000000, 0, 2000000, 2000000)}</p:grpSp>`
    // the child is at half scale: x 2000000 -> 1000000 + 1000000, width 2000000 -> 1000000
    expect(await draw(group)).toContain('translate(2000000 1000000)')
  })
  it('turns a rotated or flipped shape, but not its text', async () => {
    const svg = await draw(box('1', 'Hi', 0, 0, 1000000, 800000, ' rot="5400000" flipH="1"', '<a:prstGeom prst="rightArrow"/>'))
    expect(svg).toContain('rotate(90)')
    expect(svg).toContain('scale(-1 1)')
    expect(/<g transform="translate[^"]*"><\/g>/.test(svg)).toBe(false)
  })
  it('leaves out slide furniture, hidden shapes and shapes with no place of their own', async () => {
    const number = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="n"/><p:cNvSpPr/><p:nvPr><p:ph type="sldNum"/></p:nvPr></p:nvSpPr><p:spPr>${xfrm(0, 0, 500000, 300000)}</p:spPr><p:txBody><a:p><a:r><a:t>12</a:t></a:r></a:p></p:txBody></p:sp>`
    const hidden = box('4', 'Hidden', 0, 0).replace('<p:cNvPr id="4" name="4"/>', '<p:cNvPr id="4" name="4" hidden="1"/>')
    const placed = `<p:sp><p:nvSpPr><p:cNvPr id="7" name="p"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:p><a:r><a:t>Title from layout</a:t></a:r></a:p></p:txBody></p:sp>`
    const svg = await draw(number + hidden + placed + box('1', 'Shown', 0, 0))
    expect(svg).toContain('Shown')
    for (const gone of ['>12<', 'Hidden', 'Title from layout']) expect(svg).not.toContain(gone)
  })
  it('draws a table\'s cells with their text', async () => {
    const cell = (t: string) => `<a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:t>${t}</a:t></a:r></a:p></a:txBody></a:tc>`
    const frame = `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="8" name="t"/></p:nvGraphicFramePr><p:xfrm><a:off x="100000" y="100000"/><a:ext cx="4000000" cy="1000000"/></p:xfrm><a:graphic><a:graphicData uri="x"><a:tbl><a:tblGrid><a:gridCol w="2000000"/><a:gridCol w="2000000"/></a:tblGrid><a:tr h="500000">${cell('Term')}${cell('Meaning')}</a:tr><a:tr h="500000">${cell('ATP')}${cell('Energy')}</a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame>`
    const svg = await draw(frame)
    for (const t of ['Term', 'Meaning', 'ATP', 'Energy']) expect(svg).toContain(`>${t}<`)
    expect([...svg.matchAll(/stroke="#cbd5e1"/g)]).toHaveLength(4)
  })
  it('draws a chart from the numbers saved in the file, at the frame\'s place and size', async () => {
    const chart = `<?xml version="1.0"?><c:chartSpace ${NS}><c:chart><c:title><c:tx><c:rich><a:p><a:r><a:t>Yield</a:t></a:r></a:p></c:rich></c:tx></c:title><c:plotArea><c:barChart><c:barDir val="col"/><c:ser><c:tx><c:strRef><c:strCache><c:pt idx="0"><c:v>2025</c:v></c:pt></c:strCache></c:strRef></c:tx><c:cat><c:strRef><c:strCache><c:pt idx="0"><c:v>Wheat</c:v></c:pt><c:pt idx="1"><c:v>Maize</c:v></c:pt></c:strCache></c:strRef></c:cat><c:val><c:numRef><c:numCache><c:pt idx="0"><c:v>40</c:v></c:pt><c:pt idx="1"><c:v>80</c:v></c:pt></c:numCache></c:numRef></c:val></c:ser></c:barChart></c:plotArea></c:chart></c:chartSpace>`
    const frame = `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="8" name="c"/></p:nvGraphicFramePr><p:xfrm><a:off x="1000000" y="500000"/><a:ext cx="6000000" cy="3000000"/></p:xfrm><a:graphic><a:graphicData uri="x"><c:chart r:id="rId5"/></a:graphicData></a:graphic></p:graphicFrame>`
    const e = await env({
      'ppt/charts/chart1.xml': chart,
      'ppt/slides/_rels/slide1.xml.rels': '<?xml version="1.0"?><Relationships><Relationship Id="rId5" Type="x/chart" Target="../charts/chart1.xml"/></Relationships>',
    })
    const svg = await draw(frame, e)
    expect(svg).toMatch(/<svg x="1000000" y="500000" width="6000000" height="3000000" viewBox="0 0 800 450"/)
    for (const t of ['Yield', 'Wheat', 'Maize']) expect(svg).toContain(t)
  })
  it('draws SmartArt from the shapes saved with it', async () => {
    const dsp = `<?xml version="1.0"?><dsp:drawing xmlns:dsp="http://schemas.microsoft.com/office/drawing/2008/diagram" ${NS}><dsp:spTree><dsp:sp><dsp:nvSpPr><dsp:cNvPr id="0" name=""/><dsp:cNvSpPr/></dsp:nvSpPr><dsp:spPr>${xfrm(0, 0, 1500000, 700000)}<a:prstGeom prst="rect"/><a:solidFill><a:srgbClr val="70AD47"/></a:solidFill></dsp:spPr><dsp:txBody><a:bodyPr/><a:p><a:r><a:t>Step one</a:t></a:r></a:p></dsp:txBody></dsp:sp></dsp:spTree></dsp:drawing>`
    const frame = `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="8" name="s"/></p:nvGraphicFramePr><p:xfrm><a:off x="200000" y="300000"/><a:ext cx="5000000" cy="2000000"/></p:xfrm><a:graphic><a:graphicData uri="x"><dgm:relIds xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" r:dm="rId7"/></a:graphicData></a:graphic></p:graphicFrame>`
    const e = await env({
      'ppt/diagrams/data1.xml': '<?xml version="1.0"?><dgm:dataModel xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram"/>',
      'ppt/diagrams/drawing1.xml': dsp,
      'ppt/slides/_rels/slide1.xml.rels': '<?xml version="1.0"?><Relationships><Relationship Id="rId7" Type="x/diagramData" Target="../diagrams/data1.xml"/><Relationship Id="rId8" Type="http://schemas.microsoft.com/office/2007/relationships/diagramDrawing" Target="../diagrams/drawing1.xml"/></Relationships>',
    })
    const svg = await draw(frame, e)
    expect(svg).toContain('Step one')
    expect(svg).toContain('fill="#70ad47"')
    expect(svg).toContain('translate(200000 300000)') // in the frame's place
  })
})

describe('which slides have something to look at', () => {
  const has = (inner: string, skip?: Set<string>) => hasVisualAid(tree(inner), skip, [{ id: 'rId2', type: 'x/image', target: 'ppt/media/logo.png' }])
  const pic = `<p:pic><p:nvPicPr><p:cNvPr id="4" name="P"/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/></p:blipFill><p:spPr>${xfrm(0, 0, 100, 100)}</p:spPr></p:pic>`
  it('is no for a slide of text', () => {
    expect(has(textBox('Just words') + textBox('And more'))).toBe(false)
  })
  it('is yes for a connector or arrow, a picture, a chart, SmartArt or a freehand shape', () => {
    expect(has(box('1', 'A', 0, 0) + arrow(0, 0, 100, 100))).toBe(true)
    expect(has(pic)).toBe(true)
    expect(has(`<p:graphicFrame><a:graphic><a:graphicData><c:chart r:id="x"/></a:graphicData></a:graphic></p:graphicFrame>`)).toBe(true)
    expect(has(`<p:graphicFrame><a:graphic><a:graphicData><dgm:relIds xmlns:dgm="d" r:dm="x"/></a:graphicData></a:graphic></p:graphicFrame>`)).toBe(true)
    expect(has(box('1', 'A', 0, 0, 10, 10, '', '<a:custGeom><a:pathLst/></a:custGeom>'))).toBe(true)
  })
  it('is yes for several drawn shapes, but not for one box with words in it', () => {
    expect(has(box('1', 'A', 0, 0) + box('2', 'B', 3000000, 0))).toBe(true)
    expect(has(box('1', 'Only', 0, 0, 2000000, 800000, '', '<a:prstGeom prst="rect"/>'))).toBe(false)
  })
  it('is no when its only picture is one that is on many slides (a logo)', () => {
    expect(has(pic, new Set(['ppt/media/logo.png']))).toBe(false)
    expect(has(pic + textBox('Words'), new Set(['ppt/media/other.png']))).toBe(true)
  })
})

describe('charts', () => {
  const doc = (plot: string, extra = '') => parseXml(`<?xml version="1.0"?><c:chartSpace ${NS}><c:chart>${extra}<c:plotArea>${plot}</c:plotArea></c:chart></c:chartSpace>`)
  const ser = (name: string, cats: string[], vals: number[]) => `<c:ser><c:tx><c:v>${name}</c:v></c:tx><c:cat><c:strLit>${cats.map((c, i) => `<c:pt idx="${i}"><c:v>${c}</c:v></c:pt>`).join('')}</c:strLit></c:cat><c:val><c:numLit>${vals.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('')}</c:numLit></c:val></c:ser>`
  it('draws columns, one for each value, with the categories under them', () => {
    const out = chartToSvg(doc(`<c:barChart><c:barDir val="col"/>${ser('A', ['x', 'y', 'z'], [1, 2, 3])}</c:barChart>`))!
    expect(out.w).toBe(800)
    expect([...out.svg.matchAll(/<rect x="[\d.]+" y="[\d.]+" width="[\d.]+" height="[\d.]+" fill="#4472c4"\/>/g)]).toHaveLength(3)
    for (const c of ['>x<', '>y<', '>z<']) expect(out.svg).toContain(c)
  })
  it('draws a line for each series with a legend, and a pie as slices with their percentages', () => {
    const line = chartToSvg(doc(`<c:lineChart>${ser('One', ['a', 'b'], [1, 3])}${ser('Two', ['a', 'b'], [2, 1])}</c:lineChart>`))!
    expect([...line.svg.matchAll(/<polyline /g)]).toHaveLength(2)
    expect(line.svg).toContain('>One<')
    const pie = chartToSvg(doc(`<c:pieChart>${ser('S', ['Cats', 'Dogs'], [25, 75])}</c:pieChart>`))!
    expect(pie.svg).toContain('25%')
    expect(pie.svg).toContain('75%')
    expect(pie.svg).toContain('>Dogs<')
  })
  it('leaves out a chart it cannot draw, or one with no numbers', () => {
    expect(chartToSvg(doc(`<c:scatterChart>${ser('A', ['x'], [1])}</c:scatterChart>`))).toBeNull()
    expect(chartToSvg(doc('<c:barChart></c:barChart>'))).toBeNull()
  })
})

describe('reading a package\'s links', () => {
  it('resolves each target from the part it belongs to, and skips links outside the file', async () => {
    const zip = new JSZip()
    zip.file('ppt/slides/_rels/slide1.xml.rels', '<?xml version="1.0"?><Relationships><Relationship Id="a" Type="t/image" Target="../media/x.png"/><Relationship Id="b" Type="t/hyperlink" Target="https://x.y" TargetMode="External"/></Relationships>')
    expect(await readRels(zip, 'ppt/slides/slide1.xml')).toEqual([{ id: 'a', type: 't/image', target: 'ppt/media/x.png' }])
    expect(await readRels(zip, 'ppt/slides/none.xml')).toEqual([])
  })
})
