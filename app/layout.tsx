import type { Metadata } from 'next'
import { ThemeProvider } from 'next-themes'
import { Inter, Nunito, Lora, Atkinson_Hyperlegible, JetBrains_Mono } from 'next/font/google'
import 'katex/dist/katex.min.css'
import './globals.css'

// The five fonts students can pick in Settings (lib/appearance.ts). Only Inter, the default, is preloaded.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito', display: 'swap', preload: false })
const lora = Lora({ subsets: ['latin'], variable: '--font-lora', display: 'swap', preload: false })
const atkinson = Atkinson_Hyperlegible({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-atkinson', display: 'swap', preload: false })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap', preload: false })

export const metadata: Metadata = { title: 'Studyhub', description: 'A calm study hub for students' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning
      className={`${inter.variable} ${nunito.variable} ${lora.variable} ${atkinson.variable} ${jetbrains.variable}`}>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>{children}</ThemeProvider>
      </body>
    </html>
  )
}
