-- Adiciona suporte a embalagem genérica no cadastro de materiais
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS packaging_type TEXT DEFAULT 'granel';
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS qty_per_packaging NUMERIC DEFAULT 1;

-- Adiciona suporte a embalagem genérica nos lotes do estoque
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS packaging_type TEXT DEFAULT 'granel';
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS qty_per_packaging NUMERIC DEFAULT 1;
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS piece_size NUMERIC;
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS qty_packages NUMERIC DEFAULT 1;
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS total_pieces NUMERIC DEFAULT 1;
