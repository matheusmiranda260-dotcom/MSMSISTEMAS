-- 1. Remover letras e padronizar códigos de produtos existentes para números sequenciais de 4 dígitos
WITH ordered_gauges AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as row_num
  FROM public.stock_gauges
)
UPDATE public.stock_gauges sg
SET product_code = lpad(og.row_num::text, 4, '0')
FROM ordered_gauges og
WHERE sg.id = og.id;

-- 2. Criar uma sequência para gerenciar os códigos numéricos dos produtos
CREATE SEQUENCE IF NOT EXISTS public.product_code_seq;

-- 3. Definir o valor inicial da sequência com base no maior código existente
SELECT setval(
  'public.product_code_seq', 
  COALESCE((SELECT MAX(NULLIF(regexp_replace(product_code, '\D', '', 'g'), '')::integer) FROM public.stock_gauges), 0)
);

-- 4. Função para preencher automaticamente o código do produto se for inserido vazio
CREATE OR REPLACE FUNCTION public.set_next_product_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.product_code IS NULL OR NEW.product_code = '' OR NEW.product_code = '0000' THEN
        NEW.product_code := lpad(nextval('public.product_code_seq')::text, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Criar trigger na tabela stock_gauges
DROP TRIGGER IF EXISTS trg_set_next_product_code ON public.stock_gauges;
CREATE TRIGGER trg_set_next_product_code
BEFORE INSERT ON public.stock_gauges
FOR EACH ROW
EXECUTE FUNCTION public.set_next_product_code();
