import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { Anton, Figtree, JetBrains_Mono } from 'next/font/google';
import { common } from '@/content/es-MX';
import { motionInitScript } from '@/utils/motion';
import { getSiteUrl } from '@/utils/site';
import '@/styles/globals.css';

const anton = Anton({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-anton',
  display: 'swap',
});
const figtree = Figtree({ subsets: ['latin'], variable: '--font-figtree', display: 'swap' });
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: common.appName, template: `%s | ${common.appName}` },
  description: common.appDescription,
};

export const viewport: Viewport = {
  themeColor: '#ff8a1f',
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es-MX"
      suppressHydrationWarning
      className={`${anton.variable} ${figtree.variable} ${jetbrains.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: motionInitScript }} />
      </head>
      <body>
        <Suspense fallback={null}>{children}</Suspense>
      </body>
    </html>
  );
}
