'use client'
import { createContext } from 'react'

// What a picture in the editor needs from the page around it: how to work out its address
export const NoteImagesContext = createContext<{ resolve: (src: string) => Promise<string | null> } | null>(null)
