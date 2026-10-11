import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="max-w-sm text-muted">That page doesn&apos;t exist, or it moved. Check the address, or head back.</p>
      <Link href="/" className="btn-primary">Go to Studyhub</Link>
    </main>
  )
}
