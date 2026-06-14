-- Adicionar suporte para tipos de consumo (quantidade, metro, peso) na ficha técnica
ALTER TABLE public.gauge_components 
ADD COLUMN IF NOT EXISTS consumption_type TEXT DEFAULT 'peso';

ALTER TABLE public.gauge_components 
ADD COLUMN IF NOT EXISTS consumption_value NUMERIC;

-- Atualizar registros existentes para que o valor inicial seja o próprio consumo
UPDATE public.gauge_components 
SET consumption_value = consumption 
WHERE consumption_value IS NULL;
