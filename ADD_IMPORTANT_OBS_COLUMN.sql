-- Adicionar coluna important_obs JSONB
ALTER TABLE public.commercial_orders
ADD COLUMN IF NOT EXISTS important_obs JSONB DEFAULT '[]'::jsonb;
