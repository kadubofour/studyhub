import type { MetadataRoute } from 'next'

// Only the front door is for search engines; the app itself and the API are private
const PRIVATE = ['/api/', '/auth/', '/home', '/planner', '/notes', '/flashcards', '/review', '/focus', '/progress', '/settings', '/onboarding', '/print', '/lectures', '/tutor', '/quiz', '/plans']

export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL
  return { rules: [{ userAgent: '*', allow: '/', disallow: PRIVATE }], ...(site ? { sitemap: `${site.replace(/\/$/, '')}/sitemap.xml` } : {}) }
}
