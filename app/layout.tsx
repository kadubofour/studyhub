import type { Metadata } from 'next'
import { ThemeProvider } from 'next-themes'
import { Inter, Nunito, Lora, Atkinson_Hyperlegible, JetBrains_Mono, Bricolage_Grotesque } from 'next/font/google'
import 'katex/dist/katex.min.css'
import './globals.css'
import { siteUrl } from '@/lib/site'

// The five fonts students can pick in Settings (lib/appearance.ts). Only Inter, the default, is preloaded.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito', display: 'swap', preload: false })
const lora = Lora({ subsets: ['latin'], variable: '--font-lora', display: 'swap', preload: false })
const atkinson = Atkinson_Hyperlegible({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-atkinson', display: 'swap', preload: false })
// Headings, titles and big numbers (with the default Sans; another font the student picks is used for headings too)
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage', display: 'swap' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap', preload: false })

const description = 'A calm study hub for students: planner, notes, flashcards, lectures and an AI tutor that works from your own material.'
export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: 'Studyhub', template: '%s · Studyhub' },
  description,
  openGraph: { title: 'Studyhub', description, type: 'website', siteName: 'Studyhub' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning
      className={`${inter.variable} ${bricolage.variable} ${nunito.variable} ${lora.variable} ${atkinson.variable} ${jetbrains.variable}`}>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>{children}</ThemeProvider>
      </body>
    </html>
  )
}
