-- Adiciona a coluna cod_merco se ela estiver faltando
ALTER TABLE public.config_bitolas ADD COLUMN IF NOT EXISTS cod_merco TEXT;
