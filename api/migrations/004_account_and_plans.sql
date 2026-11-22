BEGIN;

ALTER TABLE public.nt_users
  ADD COLUMN theme TEXT NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
  ADD COLUMN photo_jpeg BYTEA CHECK (octet_length(photo_jpeg) <= 65536),
  ADD COLUMN registration_source TEXT NOT NULL DEFAULT 'unknown'
    CHECK (registration_source IN ('unknown', 'self', 'admin')),
  ADD COLUMN registered_by UUID REFERENCES public.nt_users(id) ON DELETE SET NULL;

ALTER TABLE public.nt_sessions
  ADD COLUMN id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  ADD COLUMN device_label VARCHAR(80),
  ADD COLUMN last_seen_at TIMESTAMPTZ;

ALTER TABLE public.nt_plans ADD COLUMN is_fixed BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX nt_plans_one_fixed ON public.nt_plans(user_id, kind)
  WHERE is_fixed AND archived_at IS NULL;

INSERT INTO public.nt_schema_migrations(version) VALUES (4);
COMMIT;
