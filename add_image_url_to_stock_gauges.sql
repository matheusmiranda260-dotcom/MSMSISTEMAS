-- Execute este script no SQL Editor do Supabase para adicionar a coluna de imagem do produto
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS image_url TEXT;
