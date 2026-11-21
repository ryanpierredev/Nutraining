BEGIN;
ALTER TABLE public.nt_users ADD COLUMN avatar_jpeg BYTEA CHECK (octet_length(avatar_jpeg) <= 40000);
ALTER TABLE public.nt_users ADD COLUMN bio VARCHAR(300) NOT NULL DEFAULT '';
ALTER TABLE public.nt_users ADD COLUMN last_login_at TIMESTAMPTZ;
ALTER TABLE public.nt_sessions ADD COLUMN id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.nt_sessions ADD CONSTRAINT nt_sessions_id_unique UNIQUE(id);
ALTER TABLE public.nt_sessions ADD COLUMN device_label VARCHAR(160) NOT NULL DEFAULT 'Dispositivo não identificado';
ALTER TABLE public.nt_sessions ADD COLUMN last_seen_at TIMESTAMPTZ;
UPDATE public.nt_sessions SET last_seen_at=created_at;
ALTER TABLE public.nt_sessions ALTER COLUMN last_seen_at SET DEFAULT NOW();
ALTER TABLE public.nt_sessions ALTER COLUMN last_seen_at SET NOT NULL;
CREATE INDEX nt_sessions_last_seen ON public.nt_sessions(last_seen_at DESC);
CREATE TABLE public.nt_account_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.nt_users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.nt_users(id) ON DELETE SET NULL,
  event TEXT NOT NULL CHECK (event IN ('signup','account_created','login','password_changed','session_revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX nt_account_events_created ON public.nt_account_events(created_at DESC, id DESC);
INSERT INTO public.nt_schema_migrations(version) VALUES (4);
COMMIT;
