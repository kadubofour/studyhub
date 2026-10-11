'use client'
import { useEffect } from 'react'

// The last resort: it replaces the whole page, so it brings its own document and plain styles
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 16 }}>
        <main>
          <h1 style={{ fontSize: 24, margin: '0 0 8px' }}>Something went wrong</h1>
          <p style={{ margin: '0 0 16px', color: '#555' }}>Most of your work saves as you go. Try again in a moment.</p>
          <button type="button" onClick={() => retry()} style={{ padding: '8px 16px', fontSize: 16, cursor: 'pointer' }}>Try again</button>
        </main>
      </body>
    </html>
  )
}
