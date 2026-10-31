import type JSZip from 'jszip'

// The parts shared by the Word, PowerPoint and drawing readers: reading a part of the package as XML, and following its links.

export type Rel = { id: string; type: string; /** the part it points at, as a path in the package */ target: string }

export function parseXml(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('This file is damaged.')
  return doc
}

/** "ppt/slides" + "../media/image1.png" -> "ppt/media/image1.png"; a target starting with / is from the package's root */
export function resolvePath(fromDir: string, target: string): string {
  const parts = (target.startsWith('/') ? target.slice(1) : `${fromDir}/${target}`).split('/')
  const out: string[] = []
  for (const p of parts) { if (p === '..') out.pop(); else if (p !== '.' && p !== '') out.push(p) }
  return out.join('/')
}

/** A part's links to other parts (its .rels file), each target resolved. Empty when it has none. */
export async function readRels(zip: JSZip, partPath: string): Promise<Rel[]> {
  const dir = partPath.slice(0, partPath.lastIndexOf('/'))
  const name = partPath.slice(partPath.lastIndexOf('/') + 1)
  const f = zip.file(`${dir ? `${dir}/` : ''}_rels/${name}.rels`)
  if (!f) return []
  return Array.from(parseXml(await f.async('string')).getElementsByTagName('Relationship'))
    .filter(r => r.getAttribute('TargetMode') !== 'External')
    .map(r => ({ id: r.getAttribute('Id') ?? '', type: r.getAttribute('Type') ?? '', target: resolvePath(dir, r.getAttribute('Target') ?? '') }))
}

/** A part parsed as XML, or null when the package has none there (or it cannot be read) */
export async function readXml(zip: JSZip, path: string): Promise<Document | null> {
  const f = zip.file(path)
  if (!f) return null
  try { return parseXml(await f.async('string')) } catch { return null }
}

/** The theme's colours by name (dk1, lt1, accent1 ...), as hex */
export async function readTheme(zip: JSZip, path: string): Promise<Record<string, string>> {
  const doc = await readXml(zip, path)
  const out: Record<string, string> = {}
  const scheme = doc && Array.from(doc.getElementsByTagNameNS('*', 'clrScheme'))[0]
  if (!scheme) return out
  for (const c of Array.from(scheme.children)) {
    const v = c.firstElementChild
    const hex = v?.getAttribute('val') ?? v?.getAttribute('lastClr')
    if (v && hex && /^[0-9a-f]{6}$/i.test(v.getAttribute('lastClr') ?? hex)) out[c.localName] = `#${v.getAttribute('lastClr') ?? hex}`
  }
  return out
}
