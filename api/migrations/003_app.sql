BEGIN;
CREATE TABLE public.nt_connections (
  student_id UUID NOT NULL REFERENCES public.nt_users(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES public.nt_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (student_id, professional_id),
  CHECK (student_id <> professional_id)
);
CREATE INDEX nt_connections_professional ON public.nt_connections(professional_id);
CREATE TABLE public.nt_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.nt_users(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.nt_users(id),
  kind TEXT NOT NULL CHECK (kind IN ('workout', 'nutrition')),
  title VARCHAR(100) NOT NULL CHECK (char_length(btrim(title)) >= 2),
  notes VARCHAR(2000) NOT NULL DEFAULT '',
  items JSONB NOT NULL CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) BETWEEN 1 AND 30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);
CREATE INDEX nt_plans_user_kind ON public.nt_plans(user_id, kind, created_at DESC);
CREATE TABLE public.nt_plan_logs (
  plan_id UUID NOT NULL REFERENCES public.nt_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.nt_users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  item_index INTEGER NOT NULL CHECK (item_index BETWEEN -1 AND 29),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (plan_id, user_id, day, item_index)
);
CREATE INDEX nt_plan_logs_user_day ON public.nt_plan_logs(user_id, day);
CREATE TABLE public.nt_checkins (
  user_id UUID NOT NULL REFERENCES public.nt_users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  weight_kg NUMERIC(5,2) NOT NULL CHECK (weight_kg BETWEEN 20 AND 400),
  waist_cm NUMERIC(5,2) CHECK (waist_cm BETWEEN 30 AND 300),
  notes VARCHAR(2000) NOT NULL DEFAULT '',
  PRIMARY KEY (user_id, day)
);
CREATE TABLE public.nt_hydration (
  user_id UUID NOT NULL REFERENCES public.nt_users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  water_ml INTEGER NOT NULL CHECK (water_ml BETWEEN 0 AND 10000),
  PRIMARY KEY (user_id, day)
);
INSERT INTO public.nt_schema_migrations(version) VALUES (3);
COMMIT;
