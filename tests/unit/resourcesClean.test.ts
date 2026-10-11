import { describe, it, expect } from 'vitest'
import { cleanResources, identityOf, kindOf, MAX_FOUND } from '@/lib/resources/clean'

const c = (url: string, title = 'A title') => ({ url, title })

describe('kindOf', () => {
  it('calls YouTube and Vimeo links videos and the rest articles', () => {
    expect(kindOf('https://www.youtube.com/watch?v=1')).toBe('video')
    expect(kindOf('https://m.youtube.com/watch?v=1')).toBe('video')
    expect(kindOf('https://youtu.be/abc')).toBe('video')
    expect(kindOf('https://vimeo.com/123')).toBe('video')
    expect(kindOf('https://www.khanacademy.org/science')).toBe('article')
    expect(kindOf('https://notyoutube.com/x')).toBe('article')
    expect(kindOf('https://youtube.com.evil.test/x')).toBe('article')
  })
})

describe('cleanResources', () => {
  it('keeps only web addresses', () => {
    const out = cleanResources([c('javascript:alert(1)'), c('ftp://x.test/a'), c('not a url'), c('data:text/html,hi'), c('https://ok.test/a'), c('http://ok.test/b')])
    expect(out.map(r => r.url)).toEqual(['https://ok.test/a', 'http://ok.test/b'])
  })
  it('treats the same page written differently as one', () => {
    const out = cleanResources([
      c('https://www.example.org/a/'), c('https://example.org/a?utm_source=x&utm_medium=y'), c('https://EXAMPLE.org/a#section'), c('https://example.org/b'),
    ])
    expect(out.map(r => r.url)).toEqual(['https://www.example.org/a/', 'https://example.org/b'])
  })
  it('keeps a query that decides the page, such as a video id', () => {
    const out = cleanResources([c('https://www.youtube.com/watch?v=aaa'), c('https://www.youtube.com/watch?v=bbb')])
    expect(out).toHaveLength(2)
  })
  it('puts videos first, otherwise keeps the order', () => {
    const out = cleanResources([c('https://a.test/1'), c('https://youtu.be/x'), c('https://b.test/2'), c('https://vimeo.com/9')])
    expect(out.map(r => r.kind)).toEqual(['video', 'video', 'article', 'article'])
    expect(out.map(r => r.url)).toEqual(['https://youtu.be/x', 'https://vimeo.com/9', 'https://a.test/1', 'https://b.test/2'])
  })
  it('keeps at most six', () => {
    const many = Array.from({ length: 12 }, (_, i) => c(`https://x.test/${i}`))
    expect(cleanResources(many)).toHaveLength(MAX_FOUND)
    expect(MAX_FOUND).toBe(6)
  })
  it('tidies titles, falling back to the site name, and caps their length', () => {
    const out = cleanResources([c('https://www.site.test/a', '  '), c('https://other.test/b', '  Krebs \n cycle  '), c('https://long.test/c', 'x'.repeat(500))])
    expect(out[0].title).toBe('site.test')
    expect(out[1].title).toBe('Krebs cycle')
    expect(out[2].title).toHaveLength(200)
  })
  it('stores a tidy address: trimmed, without tracking parameters or a fragment', () => {
    const out = cleanResources([c('  https://example.org/a?utm_source=openai&si=abc&id=7#top ' + String.fromCharCode(10))])
    expect(out[0].url).toBe('https://example.org/a?id=7')
  })
  it('gives the same identity to the same page written differently', () => {
    expect(identityOf('https://www.x.org/a/')).toBe(identityOf('https://x.org/a?utm_source=y'))
    expect(identityOf('https://x.org/a?id=1')).not.toBe(identityOf('https://x.org/a?id=2'))
    expect(identityOf('nonsense')).toBeNull()
  })
  it('does not merge pages that differ by a parameter that merely starts like a tracking one', () => {
    expect(cleanResources([c('https://x.test/p?ref_id=1'), c('https://x.test/p?ref_id=2')])).toHaveLength(2)
  })
  it('drops addresses that are too long for the database', () => {
    expect(cleanResources([c('https://x.test/' + 'a'.repeat(500))])).toEqual([])
  })
})
