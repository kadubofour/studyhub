import { describe, it, expect } from 'vitest'
import { forSpeech, isEcho, isSpeech, takeSentences } from '@/lib/voice/speech'

describe('forSpeech', () => {
  it('takes out the marks that are only for the eye', () => {
    expect(forSpeech('## Cells\n\n- **Mitochondria** make *energy*.\n- See [this page](http://x.y).\n\n```js\ncode\n```')).toBe('Cells Mitochondria make energy. See this page.')
  })
  it('says a little maths in words and leaves a long equation to the screen', () => {
    expect(forSpeech('Then $x^2 + 1 = 5$ holds.')).toBe('Then x squared plus 1 equals 5 holds.')
    expect(forSpeech(String.raw`Use $\frac{a}{b}$ here`)).toContain('a over b')
    expect(forSpeech(String.raw`Start $$\int_0^1 x\,dx$$ end`)).toBe('Start that equation end')
  })
})

describe('takeSentences', () => {
  it('gives the sentences that are complete and keeps the rest', () => {
    expect(takeSentences('Plants make food from light. The leaf is where this happ')).toEqual({ ready: ['Plants make food from light.'], rest: 'The leaf is where this happ' })
  })
  it('waits for a space after the full stop, so a decimal point does not end a sentence', () => {
    expect(takeSentences('The value is 3.')).toEqual({ ready: [], rest: 'The value is 3.' })
    expect(takeSentences('The value is 3.5 metres. Next')).toEqual({ ready: ['The value is 3.5 metres.'], rest: 'Next' })
  })
  it('does not end a sentence at an abbreviation', () => {
    expect(takeSentences('Take a metal, e.g. iron, and heat it gently. Then wait')).toEqual({ ready: ['Take a metal, e.g. iron, and heat it gently.'], rest: 'Then wait' })
  })
  it('joins a very short sentence to the one after it', () => {
    expect(takeSentences('Yes. That is right because the cell divides. And')).toEqual({ ready: ['Yes. That is right because the cell divides.'], rest: 'And' })
  })
  it('gives everything at the end, with the last piece even if it is short or has no full stop', () => {
    expect(takeSentences('Good question. Here is why', true)).toEqual({ ready: ['Good question. Here is why'], rest: '' })
    expect(takeSentences('A long enough first sentence here. Ok', true).ready).toEqual(['A long enough first sentence here.', 'Ok'])
  })
  it('breaks at a line end', () => {
    expect(takeSentences('First idea written out in full\nSecond idea').ready).toEqual(['First idea written out in full'])
  })
})

describe('isEcho', () => {
  const saying = 'Mitochondria are the part of the cell that makes energy'
  it('knows the tutor\'s own voice coming back through the microphone', () => {
    expect(isEcho('mitochondria are the part of the', saying)).toBe(true)
    expect(isEcho('makes energy', saying)).toBe(true)
  })
  it('knows a student talking over the tutor', () => {
    expect(isEcho('wait what is energy in this case', saying)).toBe(false)
    expect(isEcho('sorry can you slow down', saying)).toBe(false)
  })
  it('treats nothing heard as nothing', () => { expect(isEcho('', saying)).toBe(true) })
  it('hears anyone when the tutor is not speaking', () => { expect(isEcho('hello there', '')).toBe(false) })
})

describe('isSpeech', () => {
  it('needs more than a click or a cough', () => {
    expect(isSpeech('uh')).toBe(false)
    expect(isSpeech('wait')).toBe(false)
    expect(isSpeech('hold on')).toBe(true)
    expect(isSpeech('explain')).toBe(true)
  })
})
