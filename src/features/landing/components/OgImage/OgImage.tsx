import { common } from '@/content/es-MX';
import { landingContent } from '../../content/es-MX';

// Satori (next/og) no lee CSS variables ni CSS Modules: los valores van inlineados, igual que en los correos.
// Identidad Cempasúchil: naranja dominante, titular en mayúsculas condensadas (fuente del sistema: Satori no carga Anton aquí).
const BG = '#ff8a1f';
const INK = '#14110d';
const IVORY = '#fff6e5';
const SOFT = '#3b2a14';
const DISPLAY = 'Impact, "Arial Narrow Bold", Arial, sans-serif';

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
        color: INK,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div
          style={{
            display: 'flex',
            padding: '8px 24px',
            borderRadius: 999,
            background: INK,
            color: IVORY,
            fontFamily: DISPLAY,
            fontWeight: 700,
            fontSize: 40,
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          {common.appName}
        </div>
      </div>
      <div
        style={{
          fontFamily: DISPLAY,
          fontWeight: 700,
          fontSize: 110,
          marginTop: 24,
          lineHeight: 1,
          textTransform: 'uppercase',
        }}
      >
        {ogTagline}
      </div>
      <div style={{ fontSize: 32, fontWeight: 600, color: SOFT, marginTop: 32, maxWidth: 900 }}>
        {description}
      </div>
    </div>
  );
}
