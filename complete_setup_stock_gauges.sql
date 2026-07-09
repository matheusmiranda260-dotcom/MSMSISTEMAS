-- 1. CRIAR A TABELA CASO NÃO EXISTA
CREATE TABLE IF NOT EXISTS public.stock_gauges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_type TEXT NOT NULL,
    gauge TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(material_type, gauge)
);

-- 2. ADICIONAR COLUNAS (CASO NÃO EXISTAM)
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS product_code TEXT;
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS technical_description TEXT;
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS purchase_price NUMERIC;
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS commercial_name TEXT;
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS bitola_nominal TEXT;
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS comercial_estimada TEXT;
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS lot_validity DATE;
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Ativo';
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS weight_per_meter NUMERIC;
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS piece_size NUMERIC;
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS weight_type TEXT DEFAULT 'metro';
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS weight_unit TEXT DEFAULT 'kg';
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS raw_weight_value NUMERIC;
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS subgroup_code TEXT;

-- Habilitar RLS (Row Level Security) caso a tabela seja nova
ALTER TABLE public.stock_gauges ENABLE ROW LEVEL SECURITY;

-- Criar política de acesso para permitir todas as operações (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'stock_gauges' AND policyname = 'Enable all access for all users'
    ) THEN
        CREATE POLICY "Enable all access for all users" ON public.stock_gauges FOR ALL USING (true) WITH CHECK (true);
    END IF;
END
$$;

-- 3. ATUALIZAR REGISTROS ANTIGOS PARA CONFIGURAÇÃO DE PESO
UPDATE public.stock_gauges
SET raw_weight_value = weight_per_meter
WHERE raw_weight_value IS NULL AND weight_per_meter IS NOT NULL;

-- 4. PADRONIZAR CÓDIGOS DE PRODUTOS PARA NUMÉRICOS SEQUENCIAIS
WITH ordered_gauges AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as row_num
  FROM public.stock_gauges
)
UPDATE public.stock_gauges sg
SET product_code = lpad(og.row_num::text, 4, '0')
FROM ordered_gauges og
WHERE sg.id = og.id;

-- 5. CRIAR SEQUÊNCIA PARA GERENCIAMENTO DE CÓDIGOS
CREATE SEQUENCE IF NOT EXISTS public.product_code_seq;

-- Sincronizar sequência de forma segura (tratando caso a tabela esteja vazia)
SELECT setval(
  'public.product_code_seq', 
  COALESCE(
    (SELECT MAX(NULLIF(regexp_replace(product_code, '\D', '', 'g'), '')::integer) FROM public.stock_gauges), 
    1
  ), 
  (SELECT MAX(product_code) FROM public.stock_gauges) IS NOT NULL
);

-- 6. CRIAR OU ATUALIZAR A FUNÇÃO DE AUTO-GERAÇÃO
CREATE OR REPLACE FUNCTION public.set_next_product_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.product_code IS NULL OR NEW.product_code = '' OR NEW.product_code = '0000' THEN
        NEW.product_code := lpad(nextval('public.product_code_seq')::text, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. VINCULAR TRIGGER
DROP TRIGGER IF EXISTS trg_set_next_product_code ON public.stock_gauges;
CREATE TRIGGER trg_set_next_product_code
BEFORE INSERT ON public.stock_gauges
FOR EACH ROW
EXECUTE FUNCTION public.set_next_product_code();
