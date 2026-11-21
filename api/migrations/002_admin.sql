BEGIN;
ALTER TABLE public.nt_users DROP CONSTRAINT nt_users_role_check;
ALTER TABLE public.nt_users ADD CONSTRAINT nt_users_role_check
  CHECK (role IN ('student', 'trainer', 'nutritionist', 'admin'));
INSERT INTO public.nt_schema_migrations(version) VALUES (2);
COMMIT;
