'use client'
import { createContext } from 'react'

export type NoteImageInfo = { pos: number; src: string; alt: string }
// What a picture in the editor needs from the page around it: how to work out its address, and what Markup does
/** The picture being marked up right now, in the note itself: where it is and the link to draw on */
export type NoteImageEditing = { pos: number; src: string; url: string }
export type NoteImagesCtx = {
  resolve: (src: string) => Promise<string | null>
  onMarkup?: (img: NoteImageInfo) => void
  editing?: NoteImageEditing | null
  finishMarkup?: (picture: Blob) => Promise<void>
  cancelMarkup?: () => void
}
export const NoteImagesContext = createContext<NoteImagesCtx | null>(null)
