-- Adiciona colunas para controle de conferência e OP na tabela finished_goods
ALTER TABLE public.finished_goods ADD COLUMN IF NOT EXISTS is_conferred BOOLEAN DEFAULT true;
ALTER TABLE public.finished_goods ADD COLUMN IF NOT EXISTS conferral_justification TEXT;
ALTER TABLE public.finished_goods ADD COLUMN IF NOT EXISTS op_start_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.finished_goods ADD COLUMN IF NOT EXISTS op_end_time TIMESTAMP WITH TIME ZONE;

-- Adiciona colunas para controle de conferência e OP na tabela pontas_stock
ALTER TABLE public.pontas_stock ADD COLUMN IF NOT EXISTS is_conferred BOOLEAN DEFAULT true;
ALTER TABLE public.pontas_stock ADD COLUMN IF NOT EXISTS conferral_justification TEXT;
ALTER TABLE public.pontas_stock ADD COLUMN IF NOT EXISTS op_start_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.pontas_stock ADD COLUMN IF NOT EXISTS op_end_time TIMESTAMP WITH TIME ZONE;
