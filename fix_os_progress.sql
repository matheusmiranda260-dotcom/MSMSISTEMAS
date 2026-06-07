-- Script para adicionar as colunas necessárias para a Desbobinadeira

ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS "os_items" JSONB;
ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS "os_progress" JSONB;
ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS "is_ghost_order" BOOLEAN DEFAULT false;
ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS "input_bitola" TEXT;
