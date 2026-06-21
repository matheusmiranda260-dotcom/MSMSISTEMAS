-- SQL Migration: Adicionar a coluna machines à tabela partners
ALTER TABLE public.partners 
ADD COLUMN IF NOT EXISTS machines JSONB;

COMMENT ON COLUMN public.partners.machines IS 'Configurações das máquinas da empresa (JSON array contendo os dados das máquinas)';
