BEGIN;

CREATE TABLE public.nt_exercise_loads (
  plan_id UUID NOT NULL REFERENCES public.nt_plans(id) ON DELETE CASCADE,
  item_index SMALLINT NOT NULL CHECK (item_index BETWEEN 0 AND 29),
  day DATE NOT NULL,
  weight_kg NUMERIC(6,2) NOT NULL CHECK (weight_kg BETWEEN 0 AND 1000),
  PRIMARY KEY (plan_id, item_index, day)
);

INSERT INTO public.nt_schema_migrations(version) VALUES (6);
COMMIT;
