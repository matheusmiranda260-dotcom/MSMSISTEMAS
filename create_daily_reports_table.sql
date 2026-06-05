-- ============================================================
-- SQL Migration: Tabela Unificada de Relatórios Diários
-- Execute este script no SQL Editor do Supabase.
-- Usada pelos relatórios: Trefila Diário, Treliça Final de OP
-- ============================================================

CREATE TABLE IF NOT EXISTS public.daily_reports (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    report_type  TEXT        NOT NULL,  -- 'trefila_diario' | 'trelica_final'
    machine_key  TEXT        NOT NULL,  -- 'Trefila' | 'FinalTrelica'
    date         DATE        NOT NULL,
    data         JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Garante 1 relatório por tipo + máquina + data
    CONSTRAINT unique_report_machine_date UNIQUE (report_type, machine_key, date)
);

-- Índices para consulta rápida
CREATE INDEX IF NOT EXISTS idx_daily_reports_type_key_date
    ON public.daily_reports (report_type, machine_key, date DESC);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_daily_reports_updated_at ON public.daily_reports;
CREATE TRIGGER set_daily_reports_updated_at
    BEFORE UPDATE ON public.daily_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

-- Política de acesso irrestrito (ajuste conforme sua política de autenticação)
DROP POLICY IF EXISTS "Enable all access" ON public.daily_reports;
CREATE POLICY "Enable all access" ON public.daily_reports
    FOR ALL USING (true) WITH CHECK (true);

-- Comentários
COMMENT ON TABLE  public.daily_reports IS 'Relatórios diários de produção: Trefila e Treliça Final.';
COMMENT ON COLUMN public.daily_reports.report_type IS 'Tipo do relatório: trefila_diario | trelica_final';
COMMENT ON COLUMN public.daily_reports.machine_key  IS 'Chave da máquina/setor: Trefila | FinalTrelica';
COMMENT ON COLUMN public.daily_reports.date         IS 'Data de produção do relatório (YYYY-MM-DD)';
COMMENT ON COLUMN public.daily_reports.data         IS 'Payload JSON completo do formulário';
