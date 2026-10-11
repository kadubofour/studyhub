import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
  const site = siteUrl().origin
  return ['', '/terms', '/privacy', '/signup', '/login'].map(path => ({ url: `${site}${path}` }))
}
