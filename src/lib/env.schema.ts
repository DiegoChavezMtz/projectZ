import { z } from 'zod';

const boolString = z.enum(['true', 'false']).transform((v) => v === 'true');

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1),
});

export const serverEnvSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'production']),
  APP_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_PROJECT_ID: z.string().min(1),
  EMAIL_CODE_SECRET: z.string().min(32, 'debe tener al menos 32 caracteres'),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  SMTP_SECURE: boolString,
  EMAIL_FROM_NAME: z.string().min(1),
  EMAIL_FROM_ADDRESS: z.email(),
  EMAIL_REPLY_TO: z.email().optional(),
  TURNSTILE_SECRET_KEY: z.string().min(1),
  // true cuando Captcha protection de Supabase está ON: el token de Turnstile lo valida Supabase (es de un solo uso).
  SUPABASE_CAPTCHA_ENABLED: boolString.optional(),
  // Protege POST /api/internal/deadlines (plazos y cola de correos de cumplimiento). Sin él, el endpoint responde 503.
  // Captura de errores (S10-02): endpoint HTTP que recibe un POST JSON por error. Sin él, los errores solo quedan en logs.
  ERROR_REPORT_URL: z.url().optional(),
  ERROR_REPORT_TOKEN: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(32, 'debe tener al menos 32 caracteres').optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

type Source = Record<string, string | undefined>;

function parse<T extends z.ZodType>(schema: T, source: Source, scope: string): z.infer<T> {
  // Las variables vacías (`FOO=`) se tratan como ausentes.
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== ''));
  const result = schema.safeParse(cleaned);
  if (result.success) return result.data;

  const lines = result.error.issues.map((issue) => {
    const name = issue.path.join('.');
    const missing = cleaned[name] === undefined;
    return `  - ${name}: ${missing ? 'falta' : `inválida (${issue.message})`}`;
  });
  throw new Error(
    `Variables de entorno ${scope} inválidas. Revisa .env.local contra .env.example:\n${lines.join('\n')}`,
  );
}

export const parsePublicEnv = (source: Source): PublicEnv =>
  parse(publicEnvSchema, source, 'públicas');
export const parseServerEnv = (source: Source): ServerEnv =>
  parse(serverEnvSchema, source, 'de servidor');
