import { common } from '@/content/es-MX';
import { landingContent } from '../../content/es-MX';

// Satori (next/og) no lee CSS variables ni CSS Modules: los valores van inlineados, igual que en los correos.
const BG = '#0e0e10';
const ACCENT = '#c9a96e';
const TEXT = '#f2f0eb';
const MUTED = '#a9a6a0';

export function OgImage() {
  const { ogTagline, description } = landingContent.meta;
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 80,
        background: BG,
        color: TEXT,
      }}
    >
      <div style={{ fontSize: 40, color: ACCENT, fontWeight: 700 }}>{common.appName}</div>
      <div style={{ fontSize: 84, fontWeight: 700, marginTop: 24, lineHeight: 1.1 }}>
        {ogTagline}
      </div>
      <div style={{ fontSize: 32, color: MUTED, marginTop: 32, maxWidth: 900 }}>{description}</div>
    </div>
  );
}
