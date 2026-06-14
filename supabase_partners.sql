-- SQL Migration: Criar tabela para Configuração de Parceiros e White-Label
-- Execute este script no SQL Editor do Supabase para criar a tabela.

CREATE TABLE IF NOT EXISTS public.partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    logo_url TEXT,
    material_qty TEXT,
    services_provided TEXT,
    start_date DATE,
    is_active_branding BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar Segurança de Nível de Linha (RLS)
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- Remover política anterior se existir
DROP POLICY IF EXISTS "Enable all access for all users" ON public.partners;

-- Criar política de acesso irrestrito para facilitar operações
CREATE POLICY "Enable all access for all users" ON public.partners 
    FOR ALL USING (true) WITH CHECK (true);

-- Adicionar à publicação de real-time do Supabase
ALTER PUBLICATION supabase_realtime ADD TABLE partners;

-- Comentários para documentação das colunas
COMMENT ON TABLE public.partners IS 'Tabela que armazena as configurações de parceiros e logotipo de white-label.';
COMMENT ON COLUMN public.partners.company_name IS 'Nome da empresa parceira';
COMMENT ON COLUMN public.partners.logo_url IS 'URL do logotipo do cliente ou arquivo carregado';
COMMENT ON COLUMN public.partners.material_qty IS 'Descrição ou quantidade de materiais contratados/fornecidos';
COMMENT ON COLUMN public.partners.services_provided IS 'Resumo dos serviços prestados';
COMMENT ON COLUMN public.partners.start_date IS 'Data de início da parceria';
COMMENT ON COLUMN public.partners.is_active_branding IS 'Define se esta marca/logo deve ser aplicada no menu lateral esquerdo do sistema';
