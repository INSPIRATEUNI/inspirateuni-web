-- Jobs de pg_cron del Open Day. La CLI declarativa trata los jobs como parte del schema:
-- si solo existen en una migración, el siguiente `sync` genera un cron.unschedule para borrarlos.
-- cron.schedule con el mismo nombre actualiza el job, así que es idempotente.
select cron.schedule('openday-expire-holds', '* * * * *', 'select public.job_expire_holds()');
select cron.schedule('openday-check-seats', '*/5 * * * *', 'select public.job_check_seats()');
select cron.schedule('openday-reminders', '*/15 * * * *', 'select public.job_enqueue_reminders()');
