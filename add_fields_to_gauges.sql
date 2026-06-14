-- Adicionar novos campos para a tabela stock_gauges no Supabase
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS technical_description TEXT;
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS purchase_price NUMERIC;
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS commercial_name TEXT;
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS bitola_nominal TEXT;
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS comercial_estimada TEXT;
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS lot_validity DATE;
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Ativo';

-- Campos para Configuração de KG
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS weight_per_meter NUMERIC;
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS piece_size NUMERIC;
