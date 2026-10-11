import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site'

// Only the front door is for search engines; the app itself and the API are private
const PRIVATE = ['/api/', '/auth/', '/home', '/planner', '/notes', '/flashcards', '/review', '/focus', '/progress', '/settings', '/onboarding', '/print', '/lectures', '/tutor', '/quiz', '/plans']

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', allow: '/', disallow: PRIVATE }], sitemap: `${siteUrl().origin}/sitemap.xml` }
}
