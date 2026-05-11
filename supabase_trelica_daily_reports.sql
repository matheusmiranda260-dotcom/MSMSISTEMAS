-- SQL Migration: Criar tabela para Relatórios Diários da Treliça
-- Execute este script no SQL Editor do Supabase para criar a tabela.

CREATE TABLE IF NOT EXISTS public.trelica_daily_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    machine_type TEXT NOT NULL, -- 'Treliça 1' ou 'Treliça 2'
    production_order TEXT,
    operator_shift_a TEXT,
    operator_shift_b TEXT,
    product_description TEXT DEFAULT 'TRELIÇA H-12 LEVE 6 MTS',
    pieces_to_produce NUMERIC DEFAULT 4500,
    stops_shift_a JSONB DEFAULT '[]'::jsonb,
    stops_shift_b JSONB DEFAULT '[]'::jsonb,
    stats_shift_a JSONB DEFAULT '{}'::jsonb,
    stats_shift_b JSONB DEFAULT '{}'::jsonb,
    production_updates JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    
    -- Garante que só exista um relatório por máquina e data
    CONSTRAINT unique_machine_date UNIQUE (date, machine_type)
);

-- Habilitar Segurança de Nível de Linha (RLS)
ALTER TABLE public.trelica_daily_reports ENABLE ROW LEVEL SECURITY;

-- Remover política anterior se existir
DROP POLICY IF EXISTS "Enable all access for all users" ON public.trelica_daily_reports;

-- Criar política de acesso irrestrito para facilitar operações
CREATE POLICY "Enable all access for all users" ON public.trelica_daily_reports 
    FOR ALL USING (true) WITH CHECK (true);

-- Comentários para documentação das colunas
COMMENT ON TABLE public.trelica_daily_reports IS 'Tabela que armazena os relatórios de produção diária das máquinas Treliça 1 e 2.';
COMMENT ON COLUMN public.trelica_daily_reports.stops_shift_a IS 'Lista de paradas do turno A (JSON: [{inicio, fim, motivo, duracao}])';
COMMENT ON COLUMN public.trelica_daily_reports.stops_shift_b IS 'Lista de paradas do turno B (JSON: [{inicio, fim, motivo, duracao}])';
COMMENT ON COLUMN public.trelica_daily_reports.stats_shift_a IS 'Dados estatísticos do turno A (JSON: {horasTrabalhadas, pecasProduzidas, tamanhoPeca})';
COMMENT ON COLUMN public.trelica_daily_reports.stats_shift_b IS 'Dados estatísticos do turno B (JSON: {horasTrabalhadas, pecasProduzidas, tamanhoPeca})';
COMMENT ON COLUMN public.trelica_daily_reports.production_updates IS 'Tabela de atualizações de lotes/pesos (JSON: [{qnt, peso, media, data}])';
