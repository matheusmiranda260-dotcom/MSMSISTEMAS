ALTER TABLE public.production_orders
ADD COLUMN IF NOT EXISTS related_commercial_order_id TEXT;

-- Reload schema cache in PostgREST
NOTIFY pgrst, 'reload schema';
