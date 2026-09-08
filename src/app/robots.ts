import { MetadataRoute } from 'next'
 
export default function robots(): MetadataRoute.Robots {
  // Check if we are in production
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // If testing or staging, tell search engines to completely ignore the site
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
    }
  }

  // If in production (Live site), use the real SEO rules
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard/',
        '/api/',
        '/auth/',
        '/book/',
        '/dev/',
        '/delete-account/',
      ],
    },
    sitemap: 'https://www.repairseries.in/sitemap.xml',
  }
}