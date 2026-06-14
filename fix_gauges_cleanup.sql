-- ================================================================
-- FIX GAUGES CLEANUP - Limpeza de duplicatas e materiais fantasma
-- Execute este SQL no Supabase SQL Editor
-- ================================================================

-- 1. VER O QUE EXISTE ATUALMENTE NA TABELA
SELECT material_type, gauge, product_code, id, created_at
FROM public.stock_gauges
ORDER BY material_type, gauge;

-- ================================================================
-- 2. REMOVER DUPLICATAS (mantém o registro mais antigo com product_code)
-- ================================================================
-- Primeiro, veja as duplicatas antes de deletar:
SELECT material_type, gauge, COUNT(*) as total
FROM public.stock_gauges
GROUP BY material_type, gauge
HAVING COUNT(*) > 1
ORDER BY material_type, gauge;

-- Agora remova os duplicados (mantém o que tem product_code ou o mais antigo):
DELETE FROM public.stock_gauges
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY material_type, gauge 
                   ORDER BY 
                       CASE WHEN product_code IS NOT NULL THEN 0 ELSE 1 END,
                       created_at ASC
               ) as rn
        FROM public.stock_gauges
    ) ranked
    WHERE rn > 1
);

-- ================================================================
-- 3. ADICIONAR COLUNAS NECESSÁRIAS (se não existirem)
-- ================================================================
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'materia_prima';
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS auto_generate_lot BOOLEAN DEFAULT false;
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS default_steel_type TEXT;
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS custom_field_label TEXT;
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS custom_field_options TEXT;
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS custom_field_value TEXT;
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS packaging_type TEXT DEFAULT 'granel';
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS qty_per_packaging NUMERIC DEFAULT 1;

-- ================================================================
-- 4. VER O RESULTADO FINAL
-- ================================================================
SELECT material_type, gauge, product_code, item_type, status, packaging_type
FROM public.stock_gauges
ORDER BY material_type, gauge;
