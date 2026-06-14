-- Add auto_generate_lot column to stock_gauges table
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS auto_generate_lot BOOLEAN DEFAULT FALSE;
