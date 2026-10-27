-- Agenda process_deadlines cada 5 minutos. Ejecución MANUAL, una sola vez, DESPUÉS de habilitar pg_cron
-- (Database > Extensions > pg_cron) y de aplicar la migración 23. Es idempotente: repetirlo actualiza el trabajo.
select cron.schedule('zlotify-process-deadlines', '*/5 * * * *', 'select public.process_deadlines()');
