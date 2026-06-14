-- Add custom fields support to stock_gauges table
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS custom_field_label TEXT;
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS custom_field_options TEXT;
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS custom_field_value TEXT;
