-- Remove the rigid machine name constraint so dynamic machines can be used
ALTER TABLE public.production_orders DROP CONSTRAINT IF EXISTS production_orders_machine_check;
