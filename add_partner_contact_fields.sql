-- SQL Migration: Adicionar campos de contato e identificação à tabela partners
-- Execute este script no SQL Editor do Supabase para adicionar as colunas.

ALTER TABLE public.partners
    ADD COLUMN IF NOT EXISTS cnpj TEXT,
    ADD COLUMN IF NOT EXISTS nome_fantasia TEXT,
    ADD COLUMN IF NOT EXISTS razao_social TEXT,
    ADD COLUMN IF NOT EXISTS endereco TEXT,
    ADD COLUMN IF NOT EXISTS telefone TEXT,
    ADD COLUMN IF NOT EXISTS email TEXT;

COMMENT ON COLUMN public.partners.cnpj IS 'CNPJ do parceiro';
COMMENT ON COLUMN public.partners.nome_fantasia IS 'Nome fantasia do parceiro';
COMMENT ON COLUMN public.partners.razao_social IS 'Razão social do parceiro';
COMMENT ON COLUMN public.partners.endereco IS 'Endereço completo do parceiro';
COMMENT ON COLUMN public.partners.telefone IS 'Telefone de contato do parceiro';
COMMENT ON COLUMN public.partners.email IS 'Email de contato do parceiro';
