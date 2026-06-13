-- Tabela de Documentos do Funcionário
CREATE TABLE IF NOT EXISTS public.employee_documents (
    id TEXT PRIMARY KEY,
    employee_id TEXT REFERENCES public.employees(id),
    title TEXT NOT NULL, -- Ex: "Carteira de Vacinação"
    type TEXT NOT NULL, -- Ex: "Atestado", "Pessoal", "Outros"
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access employee_documents" ON public.employee_documents FOR ALL USING (true);
-- Atualização da tabela de Funcionários com dados detalhados
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS job_title TEXT; -- Cargo
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS admission_date DATE;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS marital_status TEXT; -- Solteiro(a), Casado(a), etc
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS children_count INTEGER DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS manager_id TEXT REFERENCES public.employees(id); -- Para o Organograma

-- Tabela de Cursos e Treinamentos
CREATE TABLE IF NOT EXISTS public.employee_courses (
    id TEXT PRIMARY KEY,
    employee_id TEXT REFERENCES public.employees(id),
    course_name TEXT NOT NULL,
    institution TEXT,
    completion_date DATE,
    expiry_date DATE, -- Para cursos com validade (NRs)
    status TEXT CHECK (status IN ('Concluído', 'Em Andamento', 'Pendente'))
);

-- Tabela de Faltas e Ausências
CREATE TABLE IF NOT EXISTS public.employee_absences (
    id TEXT PRIMARY KEY,
    employee_id TEXT REFERENCES public.employees(id),
    start_date DATE NOT NULL,
    end_date DATE,
    reason TEXT NOT NULL, -- Doença, Falta Injustificada, Motivos Pessoais
    type TEXT -- Atestado, Falta, Licença
);

-- Tabela de Férias
CREATE TABLE IF NOT EXISTS public.employee_vacations (
    id TEXT PRIMARY KEY,
    employee_id TEXT REFERENCES public.employees(id),
    period TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT CHECK (status IN ('Agendada', 'Programada', 'Gozada', 'Vendida', 'Cancelada'))
);

-- Tabela de Responsabilidades/Atribuições da Função
CREATE TABLE IF NOT EXISTS public.employee_responsibilities (
    id TEXT PRIMARY KEY,
    employee_id TEXT REFERENCES public.employees(id),
    description TEXT NOT NULL,
    is_critical BOOLEAN DEFAULT FALSE -- Se é uma função chave
);

-- RLS Policies para as novas tabelas
ALTER TABLE public.employee_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_vacations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_responsibilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access employee_courses" ON public.employee_courses FOR ALL USING (true);
CREATE POLICY "Access employee_absences" ON public.employee_absences FOR ALL USING (true);
CREATE POLICY "Access employee_vacations" ON public.employee_vacations FOR ALL USING (true);
CREATE POLICY "Access employee_responsibilities" ON public.employee_responsibilities FOR ALL USING (true);
-- Tabela de Unidades Organizacionais (As caixas LARANJA - Ex: Máquina Trefila 01)
CREATE TABLE IF NOT EXISTS public.org_units (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL, -- Ex: "Máquina Trefila 01"
    unit_type TEXT, -- 'machine', 'department', 'sector'
    parent_id TEXT REFERENCES public.org_units(id), -- Para hierarquias de setores (opcional)
    display_order INTEGER DEFAULT 0
);

-- Tabela de Cargos/Funções vinculados a uma Unidade (As caixas AZUIS - Ex: Operador de Máquina na Trefila 01)
CREATE TABLE IF NOT EXISTS public.org_positions (
    id TEXT PRIMARY KEY,
    org_unit_id TEXT REFERENCES public.org_units(id) ON DELETE CASCADE,
    title TEXT NOT NULL, -- Ex: "Operador de Máquina"
    is_leadership BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0
);

-- Vincular Funcionário à Posição (As caixas BRANCAS - Ex: Andrius ocupa a vaga de Operador)
-- Vamos alterar a tabela de employees para ter um link direto ou usar uma tabela de ocupação?
-- Melhor adicionar uma coluna position_id na tabela employees para saber onde ele está "sentado" no organograma.
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS org_position_id TEXT REFERENCES public.org_positions(id);

-- RLS
ALTER TABLE public.org_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access org_units" ON public.org_units FOR ALL USING (true);
CREATE POLICY "Access org_positions" ON public.org_positions FOR ALL USING (true);
-- Tabela de Funcionários (Perfil Completo)
CREATE TABLE IF NOT EXISTS public.employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    photo_url TEXT,
    sector TEXT NOT NULL, -- Setor/Máquina
    shift TEXT NOT NULL, -- Turno
    created_at TIMESTAMPTZ DEFAULT NOW(),
    active BOOLEAN DEFAULT TRUE,
    app_user_id TEXT -- Opcional: Link com o login do sistema se houver
);

-- Tabela de Avaliações (Histórico)
CREATE TABLE IF NOT EXISTS public.evaluations (
    id TEXT PRIMARY KEY,
    employee_id TEXT REFERENCES public.employees(id),
    evaluator TEXT NOT NULL, -- Quem avaliou (nome do gestor)
    date TIMESTAMPTZ DEFAULT NOW(),
    
    -- Critérios (1-5)
    organization_score INTEGER NOT NULL,
    cleanliness_score INTEGER NOT NULL,
    effort_score INTEGER NOT NULL,
    communication_score INTEGER NOT NULL,
    improvement_score INTEGER NOT NULL,
    
    -- Dados extras
    total_score INTEGER GENERATED ALWAYS AS (organization_score + cleanliness_score + effort_score + communication_score + improvement_score) STORED,
    note TEXT,
    photo_url TEXT -- Evidência opcional
);

-- Tabela de Conquistas/Gamificação
CREATE TABLE IF NOT EXISTS public.achievements (
    id TEXT PRIMARY KEY,
    employee_id TEXT REFERENCES public.employees(id),
    type TEXT NOT NULL, -- 'model_area', 'idea_month', 'highlight_week', 'custom'
    title TEXT NOT NULL,
    description TEXT,
    date TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (Segurança) - Permissiva para o App
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access employees" ON public.employees FOR ALL USING (true);
CREATE POLICY "Access evaluations" ON public.evaluations FOR ALL USING (true);
CREATE POLICY "Access achievements" ON public.achievements FOR ALL USING (true);
-- 1. Cria o Bucket 'kb-files' (se não existir)
INSERT INTO storage.buckets (id, name, public)
VALUES ('kb-files', 'kb-files', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Remove políticas antigas (se existirem) para evitar conflito
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Allow Uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow Updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow Deletes" ON storage.objects;

-- 3. Cria as novas políticas (agora sem mexer na estrutura da tabela para evitar erros de permissão)
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'kb-files' );
CREATE POLICY "Allow Uploads" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'kb-files' );
CREATE POLICY "Allow Updates" ON storage.objects FOR UPDATE USING ( bucket_id = 'kb-files' );
CREATE POLICY "Allow Deletes" ON storage.objects FOR DELETE USING ( bucket_id = 'kb-files' );
-- Create a new table for simple user management
CREATE TABLE IF NOT EXISTS public.app_users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT CHECK (role IN ('admin', 'user', 'gestor')),
    permissions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DANGER: Drop existing policies to ensure clean slate (safe for this table)
DROP POLICY IF EXISTS "Enable all access for all users" ON public.app_users;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.app_users;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.app_users;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.app_users;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.app_users;

-- Enable RLS
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- Create explicit policies for 'anon' and 'authenticated' roles
-- This allows anyone (even without login) to read/write to this table
-- Crucial for the custom auth system to work
CREATE POLICY "Enable read access for all users" ON public.app_users
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON public.app_users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON public.app_users
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete access for all users" ON public.app_users
    FOR DELETE USING (true);


-- Insert the default admin/gestor if not exists
INSERT INTO public.app_users (id, username, password, role, permissions)
VALUES 
    ('admin-001', 'gestor', '070223', 'gestor', '{"trelica": true, "trefila": true, "stock": true, "reports": true}'::jsonb),
    ('admin-002', 'matheusmiranda357@gmail.com', '070223', 'gestor', '{"trelica": true, "trefila": true, "stock": true, "reports": true}'::jsonb)
ON CONFLICT (username) DO NOTHING;
-- Criar a tabela de histórico de acessos dos usuários
CREATE TABLE IF NOT EXISTS public.user_access_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES public.app_users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    login_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.user_access_logs ENABLE ROW LEVEL SECURITY;

-- Criar políticas de segurança para acesso livre da aplicação
DROP POLICY IF EXISTS "Enable read access for all users" ON public.user_access_logs;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.user_access_logs;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.user_access_logs;

CREATE POLICY "Enable read access for all users" ON public.user_access_logs
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON public.user_access_logs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable delete access for all users" ON public.user_access_logs
    FOR DELETE USING (true);

-- Habilitar Realtime para a tabela user_access_logs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'user_access_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE user_access_logs;
    END IF;
END $$;
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
-- Create Employee Documents Table
CREATE TABLE IF NOT EXISTS employee_documents (
    id TEXT PRIMARY KEY,
    employee_id TEXT REFERENCES employees(id),
    title TEXT,
    type TEXT,
    url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;

-- Permit Access
DROP POLICY IF EXISTS "Enable all access" ON employee_documents;
CREATE POLICY "Enable all access" ON employee_documents FOR ALL USING (true) WITH CHECK (true);

-- Create the downtime_configs table
CREATE TABLE IF NOT EXISTS public.downtime_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reason TEXT NOT NULL,
    threshold_minutes INTEGER NOT NULL DEFAULT 15,
    machine_type TEXT NOT NULL DEFAULT 'Geral',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.downtime_configs ENABLE ROW LEVEL SECURITY;

-- Create policies for access
CREATE POLICY "Enable read access for all users" ON public.downtime_configs
    FOR SELECT USING (true);

CREATE POLICY "Enable all access for authenticated users" ON public.downtime_configs
    FOR ALL USING (true);

-- Insert some default values (optional but helpful)
INSERT INTO public.downtime_configs (reason, threshold_minutes, machine_type)
VALUES 
    ('Enrosco de fio', 15, 'Geral'),
    ('Quebra de fio', 20, 'Geral'),
    ('Manutenção Mecânica', 60, 'Geral'),
    ('Manutenção Elétrica', 60, 'Geral'),
    ('Troca de Rolo / Preparação', 15, 'Trefila'),
    ('Ajuste de Bitola', 180, 'Trefila'),
    ('Limpeza de Eletrodos', 15, 'Treliça'),
    ('Troca de Modelo', 120, 'Treliça')
ON CONFLICT (id) DO NOTHING;
-- Create General Company Documents Table
CREATE TABLE IF NOT EXISTS public.company_documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT,
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    author TEXT,
    file_type TEXT
);

-- Enable RLS
ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;

-- Policy for everything (keeping consistent with existing patterns in the project)
DROP POLICY IF EXISTS "Access company_documents" ON public.company_documents;
CREATE POLICY "Access company_documents" ON public.company_documents FOR ALL USING (true);
-- Tabela de Avaliações CHA (Conhecimento, Habilidade e Atitude)
DROP TABLE IF EXISTS public.technical_evaluations;

CREATE TABLE IF NOT EXISTS public.technical_evaluations (
    id TEXT PRIMARY KEY,
    employee_id TEXT REFERENCES public.employees(id) ON DELETE CASCADE,
    evaluator TEXT NOT NULL,
    date TIMESTAMPTZ DEFAULT NOW(),
    month_num INTEGER NOT NULL, -- 1º, 2º ou 3º Mês de experiência
    machine_type TEXT NOT NULL, -- 'Trefila' ou 'Treliça'
    
    -- 1. CONHECIMENTO (Questões Específicas)
    q1_answer TEXT,
    q1_score NUMERIC NOT NULL DEFAULT 0,
    q2_answer TEXT,
    q2_score NUMERIC NOT NULL DEFAULT 0,
    q3_answer TEXT,
    q3_score NUMERIC NOT NULL DEFAULT 0,
    q4_answer TEXT,
    q4_score NUMERIC NOT NULL DEFAULT 0,
    q5_answer TEXT, -- Pode ser NULL na Treliça
    q5_score NUMERIC NOT NULL DEFAULT 0, -- Pode ser 0 na Treliça
    
    -- 2. HABILIDADE (Prática e Operação)
    h1_score NUMERIC NOT NULL DEFAULT 0, -- Setup e Ajustes da Máquina
    h2_score NUMERIC NOT NULL DEFAULT 0, -- Ritmo de Trabalho e Produtividade
    h3_score NUMERIC NOT NULL DEFAULT 0, -- Controle de Qualidade e Bitolas
    h4_score NUMERIC NOT NULL DEFAULT 0, -- Segurança e Operação Segura
    
    -- 3. ATITUDE (Comportamento e Postura)
    a1_score NUMERIC NOT NULL DEFAULT 0, -- Organização e Limpeza (5S)
    a2_score NUMERIC NOT NULL DEFAULT 0, -- Assiduidade e Disciplina
    a3_score NUMERIC NOT NULL DEFAULT 0, -- Iniciativa e Melhoria Contínua
    a4_score NUMERIC NOT NULL DEFAULT 0, -- Trabalho em Equipe e Colaboração
    
    -- Geral
    total_score NUMERIC NOT NULL DEFAULT 0, -- Média geral ponderada/aritmética
    note TEXT
);

-- RLS (Segurança) - Permissiva para o App
ALTER TABLE public.technical_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Access technical_evaluations" ON public.technical_evaluations FOR ALL USING (true);
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS location TEXT;

-- Create an index for faster lookups by location if needed
CREATE INDEX IF NOT EXISTS idx_stock_items_location ON public.stock_items (location);
-- Work Instructions Table
CREATE TABLE IF NOT EXISTS public.work_instructions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    machine TEXT, -- The machine or function this applies to
    description TEXT,
    steps JSONB DEFAULT '[]'::jsonb, -- Array of { title, description, photoUrl, order }
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.work_instructions ENABLE ROW LEVEL SECURITY;

-- Clean slate policies
DROP POLICY IF EXISTS "Public Select Instructions" ON public.work_instructions;
DROP POLICY IF EXISTS "Public Insert Instructions" ON public.work_instructions;
DROP POLICY IF EXISTS "Public Update Instructions" ON public.work_instructions;
DROP POLICY IF EXISTS "Public Delete Instructions" ON public.work_instructions;

-- Permissive Policies
CREATE POLICY "Public Select Instructions" ON public.work_instructions FOR SELECT USING (true);
CREATE POLICY "Public Insert Instructions" ON public.work_instructions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Instructions" ON public.work_instructions FOR UPDATE USING (true);
CREATE POLICY "Public Delete Instructions" ON public.work_instructions FOR DELETE USING (true);

-- Storage for Instruction Images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('instruction-images', 'instruction-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
DROP POLICY IF EXISTS "Instructions Public Select" ON storage.objects;
DROP POLICY IF EXISTS "Instructions Public Insert" ON storage.objects;
DROP POLICY IF EXISTS "Instructions Public Update" ON storage.objects;

CREATE POLICY "Instructions Public Select" ON storage.objects 
FOR SELECT USING ( bucket_id = 'instruction-images' );

CREATE POLICY "Instructions Public Insert" ON storage.objects 
FOR INSERT WITH CHECK ( bucket_id = 'instruction-images' );

CREATE POLICY "Instructions Public Update" ON storage.objects 
FOR UPDATE USING ( bucket_id = 'instruction-images' );
-- Create table for Kaizen Problems
CREATE TABLE IF NOT EXISTS public.kaizen_problems (
    id TEXT PRIMARY KEY,
    description TEXT,
    sector TEXT,
    responsible TEXT,
    status TEXT DEFAULT 'Aberto',
    date TIMESTAMPTZ DEFAULT NOW(),
    photo_url TEXT,
    history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.kaizen_problems ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.kaizen_problems;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.kaizen_problems;
DROP POLICY IF EXISTS "Allow public insert" ON public.kaizen_problems;
DROP POLICY IF EXISTS "Allow public update" ON public.kaizen_problems;
DROP POLICY IF EXISTS "Allow public delete" ON public.kaizen_problems;

-- Re-create policies for table - EXTREMELY PERMISSIVE (Use with caution in production, but solves the issue now)
-- Allows ANYONE (even not logged in) to insert, select, update, delete.
CREATE POLICY "Allow public insert" ON public.kaizen_problems FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public select" ON public.kaizen_problems FOR SELECT USING (true);
CREATE POLICY "Allow public update" ON public.kaizen_problems FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.kaizen_problems FOR DELETE USING (true);


-- STORAGE SETUP

-- 1. Insert bucket if not exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('kaizen-images', 'kaizen-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Drop existing policies to ensure clean slate
DROP POLICY IF EXISTS "Kaizen Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Kaizen Auth Upload" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Auth Upload" ON storage.objects;
DROP POLICY IF EXISTS "Kaizen Upload" ON storage.objects;
DROP POLICY IF EXISTS "Kaizen Update" ON storage.objects;

-- 3. Create permissive policies for 'kaizen-images'
-- ALLOW SELECT for everyone (public)
CREATE POLICY "Kaizen Public Access" ON storage.objects 
FOR SELECT USING ( bucket_id = 'kaizen-images' );

-- ALLOW INSERT for everyone (auth + anon) to allow easy testing if auth is tricky
CREATE POLICY "Kaizen Upload" ON storage.objects 
FOR INSERT WITH CHECK ( bucket_id = 'kaizen-images' );

-- ALLOW UPDATE for everyone
CREATE POLICY "Kaizen Update" ON storage.objects 
FOR UPDATE USING ( bucket_id = 'kaizen-images' );
-- Migration to add applied_to_stock column and set up inventory_sessions table correctly
-- Run this in the Supabase SQL Editor

-- 1. Create the table if it doesn't exist (safety)
CREATE TABLE IF NOT EXISTS public.inventory_sessions (
    id TEXT PRIMARY KEY,
    material_type TEXT NOT NULL,
    bitola TEXT NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'open',
    operator TEXT,
    items_count INTEGER DEFAULT 0,
    checked_count INTEGER DEFAULT 0,
    audited_lots JSONB DEFAULT '[]'::jsonb,
    applied_to_stock BOOLEAN DEFAULT FALSE
);

-- 2. Add the column if it's missing (it likely is)
ALTER TABLE public.inventory_sessions 
ADD COLUMN IF NOT EXISTS applied_to_stock BOOLEAN DEFAULT FALSE;

-- 3. Enable RLS and add policies
ALTER TABLE public.inventory_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for all users" ON public.inventory_sessions;
CREATE POLICY "Enable all access for all users" ON public.inventory_sessions FOR ALL USING (true);

-- 4. Enable Realtime
ALTER publication supabase_realtime ADD TABLE inventory_sessions;
-- Create the stock_gauges table
CREATE TABLE IF NOT EXISTS public.stock_gauges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_type TEXT NOT NULL,
    gauge TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(material_type, gauge)
);

-- Enable RLS
ALTER TABLE public.stock_gauges ENABLE ROW LEVEL SECURITY;

-- Create policy for all actions (simple for now)
CREATE POLICY "Enable all for authenticated users" ON public.stock_gauges
    FOR ALL USING (true) WITH CHECK (true);

-- Insert initial data based on hardcoded constants in types.ts
-- Fio Máquina
INSERT INTO public.stock_gauges (material_type, gauge) VALUES 
('Fio Máquina', '8.00'),
('Fio Máquina', '7.00'),
('Fio Máquina', '6.50'),
('Fio Máquina', '6.35'),
('Fio Máquina', '5.50')
ON CONFLICT DO NOTHING;

-- CA-60 (represented as TrefilaBitolaOptions in code)
INSERT INTO public.stock_gauges (material_type, gauge) VALUES 
('CA-60', '3.40'),
('CA-60', '3.80'),
('CA-60', '4.20'),
('CA-60', '4.60'),
('CA-60', '5.00'),
('CA-60', '5.40'),
('CA-60', '6.00'),
('CA-60', '6.35'),
('CA-60', '3.20'),
('CA-60', '5.60'),
('CA-60', '5.80'),
('CA-60', '8.00')
ON CONFLICT DO NOTHING;
-- Script para criar/atualizar a tabela production_orders no Supabase
-- Execute este script no SQL Editor do Supabase

-- 1. Dropar a tabela se existir (CUIDADO: isso apaga todos os dados!)
-- DROP TABLE IF EXISTS production_orders CASCADE;

-- 2. Criar a tabela production_orders
CREATE TABLE IF NOT EXISTS production_orders (
    -- Campos principais
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT NOT NULL UNIQUE,
    machine TEXT NOT NULL CHECK (machine IN ('Trefila', 'Treliça')),
    target_bitola TEXT NOT NULL,
    
    -- Campos específicos para Treliça
    trelica_model TEXT,
    tamanho TEXT,
    quantity_to_produce INTEGER,
    
    -- Seleção de lotes (pode ser array ou JSONB para objeto)
    selected_lot_ids JSONB NOT NULL,
    
    -- Pesos
    total_weight NUMERIC NOT NULL DEFAULT 0,
    planned_output_weight NUMERIC,
    actual_produced_weight NUMERIC,
    actual_produced_quantity INTEGER,
    scrap_weight NUMERIC,
    
    -- Status e datas
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    
    -- Arrays complexos (JSONB)
    downtime_events JSONB DEFAULT '[]'::jsonb,
    processed_lots JSONB DEFAULT '[]'::jsonb,
    operator_logs JSONB DEFAULT '[]'::jsonb,
    weighed_packages JSONB DEFAULT '[]'::jsonb,
    pontas JSONB DEFAULT '[]'::jsonb,
    
    -- Processamento ativo
    active_lot_processing JSONB,
    
    -- Timestamps automáticos
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_production_orders_order_number ON production_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_production_orders_machine ON production_orders(machine);
CREATE INDEX IF NOT EXISTS idx_production_orders_status ON production_orders(status);
CREATE INDEX IF NOT EXISTS idx_production_orders_creation_date ON production_orders(creation_date);

-- 4. Criar trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_production_orders_updated_at ON production_orders;
CREATE TRIGGER update_production_orders_updated_at
    BEFORE UPDATE ON production_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. Habilitar RLS (Row Level Security)
ALTER TABLE production_orders ENABLE ROW LEVEL SECURITY;

-- 6. Criar políticas de acesso
-- Política para SELECT (leitura) - todos podem ler
DROP POLICY IF EXISTS "Allow read access to production_orders" ON production_orders;
CREATE POLICY "Allow read access to production_orders"
    ON production_orders
    FOR SELECT
    USING (true);

-- Política para INSERT (criação) - todos podem criar
DROP POLICY IF EXISTS "Allow insert access to production_orders" ON production_orders;
CREATE POLICY "Allow insert access to production_orders"
    ON production_orders
    FOR INSERT
    WITH CHECK (true);

-- Política para UPDATE (atualização) - todos podem atualizar
DROP POLICY IF EXISTS "Allow update access to production_orders" ON production_orders;
CREATE POLICY "Allow update access to production_orders"
    ON production_orders
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Política para DELETE (exclusão) - todos podem deletar
DROP POLICY IF EXISTS "Allow delete access to production_orders" ON production_orders;
CREATE POLICY "Allow delete access to production_orders"
    ON production_orders
    FOR DELETE
    USING (true);

-- 7. Comentários na tabela (documentação)
COMMENT ON TABLE production_orders IS 'Tabela de ordens de produção para Trefila e Treliça';
COMMENT ON COLUMN production_orders.id IS 'ID único da ordem (UUID)';
COMMENT ON COLUMN production_orders.order_number IS 'Número da ordem de produção (único)';
COMMENT ON COLUMN production_orders.machine IS 'Tipo de máquina: Trefila ou Treliça';
COMMENT ON COLUMN production_orders.target_bitola IS 'Bitola alvo a ser produzida';
COMMENT ON COLUMN production_orders.selected_lot_ids IS 'IDs dos lotes selecionados (array ou objeto JSON)';
COMMENT ON COLUMN production_orders.status IS 'Status da ordem: pending, in_progress, completed';
-- Create table for Spare Parts
CREATE TABLE IF NOT EXISTS spare_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    model TEXT NOT NULL,
    machine TEXT NOT NULL,
    current_stock INTEGER NOT NULL DEFAULT 0,
    min_stock INTEGER NOT NULL DEFAULT 0,
    location TEXT,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create table for Part Usage History
CREATE TABLE IF NOT EXISTS part_usage_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_id UUID REFERENCES spare_parts(id) ON DELETE CASCADE,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    quantity INTEGER NOT NULL,
    machine TEXT,
    reason TEXT,
    user_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies (simple permissive)
ALTER TABLE spare_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE part_usage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for users" ON spare_parts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for users" ON part_usage_history FOR ALL USING (true) WITH CHECK (true);

-- Add image_url to spare_parts for model photos
ALTER TABLE spare_parts ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add type to part_usage_history to distinguish Entrada (IN) and Saída (OUT)
-- Default is 'OUT' to correspond to existing 'usage' records
ALTER TABLE part_usage_history ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'OUT';

-- Update RLS if needed (already permissive)

-- Create a public bucket for spare parts images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('spare-parts', 'spare-parts', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow public read access
CREATE POLICY "Public Read Access" ON storage.objects 
FOR SELECT USING (bucket_id = 'spare-parts');

-- Policy to allow authenticated uploads
CREATE POLICY "Authenticated Upload" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'spare-parts');

-- Policy to allow authenticated updates
CREATE POLICY "Authenticated Update" ON storage.objects 
FOR UPDATE WITH CHECK (bucket_id = 'spare-parts');

-- Create table for Trefila Recipes
CREATE TABLE IF NOT EXISTS trefila_recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT,
    entry_diameter NUMERIC,
    final_diameter NUMERIC,
    passes INTEGER,
    pass_diameters JSONB, -- Array of numbers
    pass_rings JSONB,     -- Array of {entry, output} objects
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE trefila_recipes ENABLE ROW LEVEL SECURITY;

-- Create policy for full access (public for now, or authenticated if user prefers)
CREATE POLICY "Public access to recipes" ON trefila_recipes
    FOR ALL USING (true) WITH CHECK (true);
-- Create table for Trefila Rings Stock
create table if not exists public.trefila_rings_stock (
    id uuid default gen_random_uuid() primary key,
    model text not null, -- e.g. "PR 3.20", "CA 3.55"
    quantity integer default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.trefila_rings_stock enable row level security;

-- Create permissive policy for now (matching other tables in this project context)
create policy "Enable all for public" on public.trefila_rings_stock for all using (true) with check (true);

-- Functions to update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger handle_trefila_rings_stock_updated_at
before update on public.trefila_rings_stock
for each row execute procedure public.handle_updated_at();
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
