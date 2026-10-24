// URL pública del sitio (para canonical, sitemap y datos estructurados).
export function getSiteUrl(): string {
  const raw = process.env.APP_URL ?? 'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}
