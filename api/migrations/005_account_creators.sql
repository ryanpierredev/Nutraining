BEGIN;

ALTER TABLE public.nt_users DROP CONSTRAINT nt_users_registration_source_check;
ALTER TABLE public.nt_users ADD CONSTRAINT nt_users_registration_source_check
  CHECK (registration_source IN ('unknown', 'self', 'admin', 'professional', 'bootstrap'));

INSERT INTO public.nt_schema_migrations(version) VALUES (5);
COMMIT;
