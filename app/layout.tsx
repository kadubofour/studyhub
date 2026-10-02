import type { Metadata } from 'next'
import { ThemeProvider } from 'next-themes'
import 'katex/dist/katex.min.css'
import './globals.css'

export const metadata: Metadata = { title: 'Studyhub', description: 'A calm study hub for students' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>{children}</ThemeProvider>
      </body>
    </html>
  )
}
