import { emailContent } from './content/es-MX';

// Los correos no leen CSS variables: se inlinean los mismos valores de marca que globals.css.
export const emailTheme = {
  accent: '#C9A96E',
  onAccent: '#17130A',
  pageBg: '#0E0E10',
  cardBg: '#FFFFFF',
  text: '#1B1B1F',
  muted: '#6B6963',
  border: '#E6E3DC',
  font: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  mono: "ui-monospace,'SF Mono',Menlo,Consolas,monospace",
} as const;

const t = emailTheme;

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export const paragraph = (text: string) =>
  `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${t.text};">${escapeHtml(text)}</p>`;

export const heading = (text: string) =>
  `<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${t.text};">${escapeHtml(text)}</h1>`;

export const button = (label: string, href: string) =>
  `<p style="margin:24px 0;"><a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 28px;background:${t.accent};color:${t.onAccent};font-weight:600;text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a></p>`;

/** Código de 6 dígitos: bloque grande monoespaciado, separado con letter-spacing (el texto queda contiguo, seleccionable y copiable). */
export function codeBlock(code: string): string {
  return `<p style="margin:24px 0;padding:20px;text-align:center;background:#F7F4EC;border:1px solid ${t.accent};border-radius:8px;font-family:${t.mono};font-size:32px;font-weight:700;letter-spacing:6px;color:${t.text};user-select:all;-webkit-user-select:all;">${escapeHtml(code)}</p>`;
}

/** Envuelve el contenido en el layout base (600 px, fondo oscuro, tarjeta clara). */
export function layout({ content, appUrl }: { content: string; appUrl: string }): string {
  const { brand, footer } = emailContent;
  return `<!doctype html>
<html lang="es-MX">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(brand)}</title>
</head>
<body style="margin:0;padding:0;background:${t.pageBg};font-family:${t.font};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${t.pageBg};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td style="padding:0 0 20px;font-size:22px;font-weight:700;letter-spacing:1px;color:${t.accent};">${escapeHtml(brand)}</td></tr>
<tr><td style="background:${t.cardBg};border-radius:12px;padding:32px;">${content}</td></tr>
<tr><td style="padding:20px 0 0;font-size:12px;line-height:1.6;color:#A9A6A0;">
${escapeHtml(footer.ignore)}<br>
<a href="${escapeHtml(appUrl)}/privacidad" style="color:${t.accent};">${escapeHtml(footer.privacy)}</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
