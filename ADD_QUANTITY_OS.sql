ALTER TABLE public.production_orders
ADD COLUMN IF NOT EXISTS quantity_os INTEGER DEFAULT 0;

NOTIFY pgrst, 'reload schema';
