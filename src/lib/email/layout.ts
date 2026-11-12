import { emailContent } from './content/es-MX';

// Los correos no leen CSS variables: se inlinean los mismos valores de marca (Cempasúchil) que globals.css.
// Fuentes seguras con respaldo: Anton no se carga en correo, se usa Impact / Arial Narrow Bold en mayúsculas.
export const emailTheme = {
  accent: '#FF8A1F',
  onAccent: '#14110D',
  pageBg: '#FF8A1F',
  cardBg: '#FFF6E5',
  ink: '#14110D',
  text: '#14110D',
  muted: '#5A4A3C',
  soft: '#3B2A14',
  surface: '#F0E3C8',
  border: '#6B6150',
  display: "Impact,'Arial Narrow Bold','Helvetica Neue',Arial,sans-serif",
  font: "'Figtree',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  mono: "'JetBrains Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace",
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
  `<h1 style="margin:0 0 16px;font-family:${t.display};font-size:30px;font-weight:400;line-height:1.05;text-transform:uppercase;color:${t.text};">${escapeHtml(text)}</h1>`;

export const button = (label: string, href: string) =>
  `<p style="margin:24px 0;"><a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 28px;background:${t.accent};border:2px solid ${t.ink};color:${t.onAccent};font-weight:800;text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a></p>`;

/** Código de 6 dígitos: bloque grande monoespaciado, separado con letter-spacing (el texto queda contiguo, seleccionable y copiable). */
export function codeBlock(code: string): string {
  return `<p style="margin:24px 0;padding:20px;text-align:center;background:${t.surface};border:2px solid ${t.ink};border-radius:24px;font-family:${t.mono};font-size:32px;font-weight:700;letter-spacing:6px;color:${t.text};user-select:all;-webkit-user-select:all;">${escapeHtml(code)}</p>`;
}

/** Envuelve el contenido en el layout base (600 px, fondo naranja, tarjeta marfil). */
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
<tr><td style="padding:0 0 20px;font-family:${t.display};font-size:28px;font-weight:400;letter-spacing:1px;text-transform:uppercase;color:${t.ink};">${escapeHtml(brand)}</td></tr>
<tr><td style="background:${t.cardBg};border-radius:28px;padding:32px;">${content}</td></tr>
<tr><td style="padding:20px 0 0;font-size:12px;line-height:1.6;color:${t.soft};">
${escapeHtml(footer.ignore)}<br>
<a href="${escapeHtml(appUrl)}/privacidad" style="color:${t.ink};text-decoration:underline;">${escapeHtml(footer.privacy)}</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
