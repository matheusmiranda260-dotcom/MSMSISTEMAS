ALTER TABLE public.commercial_orders 
ADD COLUMN IF NOT EXISTS total_os_quantity NUMERIC DEFAULT 0;
