-- Add subgroup_code to stock_gauges to link raw materials with finished products
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS subgroup_code TEXT;
