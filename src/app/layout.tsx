import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { common } from '@/content/es-MX';
import '@/styles/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: { default: common.appName, template: `%s | ${common.appName}` },
  description: common.appDescription,
};

export const viewport: Viewport = {
  themeColor: '#0e0e10',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
