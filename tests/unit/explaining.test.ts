import { describe, expect, it } from 'vitest'
import { isExplaining } from '@/lib/tutor/explaining'

const pad = 'Here are some more words so that this reply is plainly long enough for the length check to pass without any doubt at all in this test. '.replace('so that ', '')

describe('whether a reply explains something', () => {
  it('says yes to a reply that gives reasons', () => {
    expect(isExplaining(`NADH is made in the matrix because the cycle strips electrons from carbon. That means each turn stores energy for later. ${pad}`)).toBe(true)
  })
  it('says yes to worked maths with a reason', () => {
    expect(isExplaining(`Start from $a^2 + b^2 = c^2$. The formula links the three sides of the triangle together. ${pad}`)).toBe(true)
  })
  it('says yes when the tutor has told the student to press it', () => {
    expect(isExplaining('This is easier to see: press "Explain visually".')).toBe(true)
  })
  it('says no to short replies, however they are worded', () => {
    expect(isExplaining('Yes, because it means so.')).toBe(false)
    expect(isExplaining('Sure, here you go.')).toBe(false)
  })
  it('says no to a long reply with no reasoning in it', () => {
    expect(isExplaining(`Hello! Happy to help with your studies today. What would you like to look at? ${pad}`)).toBe(false)
    expect(isExplaining(`Monday: read chapter one. Tuesday: read chapter two. Wednesday: make flashcards. Thursday: take a practice quiz. Friday: rest. ${pad}`)).toBe(false)
  })
  it('says no to a list of questions, even with reasoning words', () => {
    expect(isExplaining(`Try these, because practice means progress:\n1. What is NADH?\n2. Where does the cycle run?\n3. **What leads to ATP?**\n${pad}`)).toBe(false)
  })
  it('says no when it is mostly handing something over, and yes when it also explains at length', () => {
    const short = `I made a quiz because you asked, which means you can start now. ${pad}`
    expect(isExplaining(short, 1)).toBe(false)
    expect(isExplaining(short + pad + pad, 1)).toBe(true)
  })
})
