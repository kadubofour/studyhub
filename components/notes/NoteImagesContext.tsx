'use client'
import { createContext } from 'react'

export type NoteImageInfo = { pos: number; src: string; alt: string }
// What a picture in the editor needs from the page around it: how to work out its address, and what Markup does
export const NoteImagesContext = createContext<{ resolve: (src: string) => Promise<string | null>; onMarkup?: (img: NoteImageInfo) => void } | null>(null)
