-- Adicionar colunas para configuração avançada de peso na tabela stock_gauges
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS weight_type TEXT DEFAULT 'metro';
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS weight_unit TEXT DEFAULT 'kg';
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS raw_weight_value NUMERIC;

-- Atualizar registros existentes para terem valores padrão consistentes com o peso_por_metro atual
UPDATE public.stock_gauges
SET raw_weight_value = weight_per_meter
WHERE raw_weight_value IS NULL AND weight_per_meter IS NOT NULL;
