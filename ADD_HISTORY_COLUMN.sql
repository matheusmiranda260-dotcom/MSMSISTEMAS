ALTER TABLE public.commercial_orders
ADD COLUMN IF NOT EXISTS history JSONB DEFAULT '[]'::jsonb;
