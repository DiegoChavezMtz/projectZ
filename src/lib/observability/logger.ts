import { redact } from './redact';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogFields = Record<string, unknown>;

// Una línea JSON por evento (stdout): consultable con cualquier visor de logs. Sin datos personales ni códigos.
export function log(level: LogLevel, event: string, fields: LogFields = {}): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...(redact(fields) as LogFields),
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (event: string, fields?: LogFields) => log('debug', event, fields),
  info: (event: string, fields?: LogFields) => log('info', event, fields),
  warn: (event: string, fields?: LogFields) => log('warn', event, fields),
  error: (event: string, fields?: LogFields) => log('error', event, fields),
};
