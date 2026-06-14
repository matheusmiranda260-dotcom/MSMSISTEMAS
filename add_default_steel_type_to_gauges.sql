-- Add default_steel_type column to stock_gauges table
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS default_steel_type TEXT;
