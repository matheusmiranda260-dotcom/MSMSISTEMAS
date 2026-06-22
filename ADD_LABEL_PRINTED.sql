ALTER TABLE public.machine_orders ADD COLUMN IF NOT EXISTS label_printed BOOLEAN DEFAULT false;
