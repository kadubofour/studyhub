import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export const APP_PATHS = ['/home', '/planner', '/notes', '/flashcards', '/review', '/focus', '/progress', '/settings', '/onboarding']

export async function updateSession(request: NextRequest) {
  // Lets the (app) layout know the requested page, e.g. to return there after onboarding
  request.headers.set('x-pathname', request.nextUrl.pathname + request.nextUrl.search)
  let response = NextResponse.next({ request })
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })
  const { data: { user } } = await sb.auth.getUser()
  const path = request.nextUrl.pathname
  if (!user && APP_PATHS.some(p => path === p || path.startsWith(p + '/'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`
    return NextResponse.redirect(url)
  }
  if (user && (path === '/login' || path === '/signup' || path === '/')) {
    const url = request.nextUrl.clone()
    url.pathname = '/home'
    url.search = ''
    return NextResponse.redirect(url)
  }
  return response
}
