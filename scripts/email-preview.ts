// Renderiza todas las plantillas con datos de ejemplo a .email-preview/*.html (ignorado por git).
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderEmail, sampleData, templateNames } from '../src/lib/email/render';

const outDir = resolve(process.cwd(), '.email-preview');
mkdirSync(outDir, { recursive: true });

const appUrl = process.env.APP_URL ?? 'http://localhost:3000';

for (const template of templateNames) {
  const { subject, html, text } = renderEmail({ template, data: sampleData[template] }, { appUrl });
  writeFileSync(resolve(outDir, `${template}.html`), html);
  writeFileSync(resolve(outDir, `${template}.txt`), `${subject}\n\n${text}\n`);
  console.log(`✓ .email-preview/${template}.html  (asunto: ${subject})`);
}
