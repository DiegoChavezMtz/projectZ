import { common } from '@/content/es-MX';
import { getSiteUrl } from '@/utils/site';
import { landingContent } from '../../content/es-MX';

/** Datos estructurados `WebSite` (schema.org). */
export function JsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: common.appName,
    url: getSiteUrl(),
    description: landingContent.meta.description,
    inLanguage: 'es-MX',
  };
  // `<` escapado para que ningún valor cierre el <script>.
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
