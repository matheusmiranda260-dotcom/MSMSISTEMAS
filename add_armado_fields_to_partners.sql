-- SQL Migration: Adicionar campos dos setores de Armado e PCP à tabela de parceiros
-- Execute este script no SQL Editor do Supabase para adicionar as colunas.

ALTER TABLE public.partners
    ADD COLUMN IF NOT EXISTS armado_teams JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS armado_daily_kg NUMERIC,
    ADD COLUMN IF NOT EXISTS armado_daily_meters NUMERIC,
    ADD COLUMN IF NOT EXISTS pcp_employees JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.partners.armado_teams IS 'Equipes do setor de armado (JSON contendo nome da equipe e lista de funcionários com nome e função)';
COMMENT ON COLUMN public.partners.armado_daily_kg IS 'Meta diária de produção em kg do setor de armado';
COMMENT ON COLUMN public.partners.armado_daily_meters IS 'Meta diária de produção em metros do setor de armado';
COMMENT ON COLUMN public.partners.pcp_employees IS 'Funcionários do setor de PCP (JSON com nome e função)';
