-- SCRIPT GERADO AUTOMATICAMENTE PARA O NOVO BANCO MSMSISTEMAS (ENXUTO) --



-- ======================================
-- GRUPO 1
-- ======================================

-- Arquivo: create_stock_and_receiving_tables.sql
-- create_stock_and_receiving_tables.sql
-- Tabelas centrais do estoque, recebimento e apontamento de produção

-- 1. Tabela de Conferência (Recebimento)
CREATE TABLE IF NOT EXISTS public.conferences (
    id TEXT PRIMARY KEY,
    date TIMESTAMPTZ DEFAULT NOW(),
    entry_date TIMESTAMPTZ,
    operator TEXT,
    supplier TEXT,
    nfe TEXT,
    conference_number TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Lotes no Estoque (Matéria-Prima)
CREATE TABLE IF NOT EXISTS public.stock_items (
    id TEXT PRIMARY KEY,
    internal_lot TEXT,
    supplier_lot TEXT,
    run_number TEXT,
    model TEXT,
    bitola TEXT,
    quantity NUMERIC,
    weight NUMERIC,
    label_weight NUMERIC DEFAULT 0,
    initial_quantity NUMERIC,
    remaining_quantity NUMERIC,
    sector TEXT,
    material_type TEXT DEFAULT 'Fio Máquina',
    supplier TEXT,
    nfe TEXT,
    conference_number TEXT,
    entry_date TIMESTAMPTZ,
    status TEXT DEFAULT 'Disponível',
    history JSONB DEFAULT '[]'::jsonb,
    last_movement TIMESTAMPTZ,
    sub_slot TEXT,
    production_order_ids JSONB DEFAULT '[]'::jsonb,
    location TEXT,
    last_audit_date TIMESTAMPTZ,
    audit_observation TEXT,
    steel_type TEXT DEFAULT '1006',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Transferências de Aço (FIFO)
CREATE TABLE IF NOT EXISTS public.transfers (
    id TEXT PRIMARY KEY,
    date TIMESTAMPTZ DEFAULT NOW(),
    operator TEXT,
    destination_sector TEXT,
    transferred_lots JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela de Movimentação de Produtos Acabados
CREATE TABLE IF NOT EXISTS public.finished_goods_transfers (
    id TEXT PRIMARY KEY,
    date TIMESTAMPTZ DEFAULT NOW(),
    operator TEXT,
    destination_sector TEXT,
    other_destination TEXT,
    transferred_items JSONB DEFAULT '[]'::jsonb,
    withdraw_physical_now BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabela de Requisições de Peças de Reposição
CREATE TABLE IF NOT EXISTS public.parts_requests (
    id TEXT PRIMARY KEY,
    date TIMESTAMPTZ DEFAULT NOW(),
    operator TEXT,
    machine TEXT,
    production_order_id TEXT,
    part_description TEXT,
    quantity NUMERIC,
    priority TEXT CHECK (priority IN ('Normal', 'Urgente')),
    status TEXT CHECK (status IN ('Pendente', 'Atendido')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tabela de Relatórios de Turno
CREATE TABLE IF NOT EXISTS public.shift_reports (
    id TEXT PRIMARY KEY,
    machine TEXT,
    operator TEXT,
    production_order_id TEXT,
    order_number TEXT,
    target_bitola TEXT,
    trelica_model TEXT,
    tamanho TEXT,
    quantity_to_produce NUMERIC,
    shift_start_time TIMESTAMPTZ,
    shift_end_time TIMESTAMPTZ,
    processed_lots JSONB DEFAULT '[]'::jsonb,
    downtime_events JSONB DEFAULT '[]'::jsonb,
    total_produced_quantity NUMERIC DEFAULT 0,
    total_produced_weight NUMERIC DEFAULT 0,
    total_produced_meters NUMERIC DEFAULT 0,
    total_scrap_weight NUMERIC DEFAULT 0,
    scrap_percentage NUMERIC DEFAULT 0,
    date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Tabela de Apontamento de Produção Realizada
CREATE TABLE IF NOT EXISTS public.production_records (
    id TEXT PRIMARY KEY,
    production_order_id TEXT,
    date TIMESTAMPTZ DEFAULT NOW(),
    machine TEXT,
    operator TEXT,
    produced_weight NUMERIC,
    produced_quantity NUMERIC,
    bitola TEXT,
    model TEXT,
    consumed_lots JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Tabela de Quadro de Avisos / Notas Adesivas
CREATE TABLE IF NOT EXISTS public.sticky_notes (
    id TEXT PRIMARY KEY,
    content TEXT,
    color TEXT,
    author TEXT,
    date TIMESTAMPTZ DEFAULT NOW(),
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- Arquivo: setup_users_table.sql
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


-- Arquivo: setup_people_management.sql
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


-- Arquivo: setup_org_chart.sql
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


-- Arquivo: setup_hr_expansion.sql
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


-- Arquivo: setup_documents.sql
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


-- Arquivo: supabase_spare_parts.sql
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


-- Arquivo: supabase_instructions.sql
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


-- Arquivo: supabase_kaizen.sql
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


-- Arquivo: create_documents_table.sql
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


-- Arquivo: create_general_documents.sql
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




-- ======================================
-- GRUPO 2
-- ======================================

-- Arquivo: create_access_logs_table.sql
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


-- Arquivo: create_technical_evaluations.sql
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


-- Arquivo: supabase_migration_stock_gauges.sql
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



-- Arquivo: supabase_migration_inventory_applied.sql
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


-- Arquivo: supabase_add_stock_location.sql
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS location TEXT;

-- Create an index for faster lookups by location if needed
CREATE INDEX IF NOT EXISTS idx_stock_items_location ON public.stock_items (location);


-- Arquivo: supabase_storage_bucket.sql

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


-- Arquivo: supabase_spare_parts_v2.sql

-- Add image_url to spare_parts for model photos
ALTER TABLE spare_parts ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add type to part_usage_history to distinguish Entrada (IN) and Saída (OUT)
-- Default is 'OUT' to correspond to existing 'usage' records
ALTER TABLE part_usage_history ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'OUT';

-- Update RLS if needed (already permissive)


-- Arquivo: supabase_production_orders_schema.sql
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


-- Arquivo: create_daily_reports_table.sql
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




-- ======================================
-- GRUPO 3
-- ======================================

-- Arquivo: fix_delete_cascade.sql
-- Alterar Constraints para DELETE CASCADE nas tabelas dependentes

-- Evaluations
ALTER TABLE public.evaluations DROP CONSTRAINT IF EXISTS evaluations_employee_id_fkey;
ALTER TABLE public.evaluations ADD CONSTRAINT evaluations_employee_id_fkey 
    FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

-- Achievements (se houver link)
-- Verificar se achievements tem employee_id, se tiver:
-- ALTER TABLE public.achievements DROP CONSTRAINT IF EXISTS achievements_employee_id_fkey;
-- ALTER TABLE public.achievements ADD CONSTRAINT achievements_employee_id_fkey 
--    FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

-- Employee Responsibilities
ALTER TABLE public.employee_responsibilities DROP CONSTRAINT IF EXISTS employee_responsibilities_employee_id_fkey;
ALTER TABLE public.employee_responsibilities ADD CONSTRAINT employee_responsibilities_employee_id_fkey 
    FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

-- Employee Courses
ALTER TABLE public.employee_courses DROP CONSTRAINT IF EXISTS employee_courses_employee_id_fkey;
ALTER TABLE public.employee_courses ADD CONSTRAINT employee_courses_employee_id_fkey 
    FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

-- Employee Absences
ALTER TABLE public.employee_absences DROP CONSTRAINT IF EXISTS employee_absences_employee_id_fkey;
ALTER TABLE public.employee_absences ADD CONSTRAINT employee_absences_employee_id_fkey 
    FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

-- Employee Vacations
ALTER TABLE public.employee_vacations DROP CONSTRAINT IF EXISTS employee_vacations_employee_id_fkey;
ALTER TABLE public.employee_vacations ADD CONSTRAINT employee_vacations_employee_id_fkey 
    FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

-- Manager Reference (Self Reference) - Definir para NULL se o gerente for deletado
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_manager_id_fkey;
ALTER TABLE public.employees ADD CONSTRAINT employees_manager_id_fkey 
    FOREIGN KEY (manager_id) REFERENCES public.employees(id) ON DELETE SET NULL;


-- Arquivo: MASTER_FIX_DATABASE.sql
-- MASTER SUPABASE FIX SCRIPT v2
-- Execute este script no SQL Editor do Supabase para corrigir colunas e permissões de acesso (RLS).

-- 1. Extensões Necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Correção da tabela stock_items (Lotes no Estoque)
-- Garante que todas as colunas necessárias existam
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS "label_weight" NUMERIC DEFAULT 0;
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS "production_order_ids" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS "history" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS "last_audit_date" TIMESTAMPTZ;
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS "internal_lot" TEXT;
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS "supplier_lot" TEXT;
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS "conference_number" TEXT;
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS "initial_quantity" NUMERIC;
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS "remaining_quantity" NUMERIC;
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS "steel_type" TEXT DEFAULT '1006';
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS "material_type" TEXT DEFAULT 'Fio Máquina';
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS "run_number" TEXT;
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS "entry_date" TIMESTAMPTZ;
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS "supplier" TEXT;
ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS "nfe" TEXT;

-- Habilita RLS e cria políticas de acesso total (IMPORTANTE: Corrige bugs de inserção/deleção)
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.stock_items;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.stock_items;
DROP POLICY IF EXISTS "Allow all access to stock_items" ON public.stock_items;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.stock_items;

CREATE POLICY "Enable all access for all users" ON public.stock_items 
    FOR ALL USING (true) WITH CHECK (true);

-- 3. Correção da tabela conferences (Conferências de Recebimento)
ALTER TABLE public.conferences ADD COLUMN IF NOT EXISTS "conference_number" TEXT;

ALTER TABLE public.conferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to conferences" ON public.conferences;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.conferences;

CREATE POLICY "Enable all access for all users" ON public.conferences 
    FOR ALL USING (true) WITH CHECK (true);

-- 4. Correção da tabela production_orders (Ordens de Produção)
-- Garante colunas de peso real se não existirem
ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS "actual_produced_weight" NUMERIC;
ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS "actual_produced_quantity" NUMERIC;
ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS "scrap_weight" NUMERIC;

ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read access to production_orders" ON public.production_orders;
DROP POLICY IF EXISTS "Allow insert access to production_orders" ON public.production_orders;
DROP POLICY IF EXISTS "Allow update access to production_orders" ON public.production_orders;
DROP POLICY IF EXISTS "Allow delete access to production_orders" ON public.production_orders;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.production_orders;

CREATE POLICY "Enable all access for all users" ON public.production_orders 
    FOR ALL USING (true) WITH CHECK (true);

-- 5. Outras tabelas de movimento e estoque
-- Finished Goods
ALTER TABLE public.finished_goods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.finished_goods;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.finished_goods;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.finished_goods;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.finished_goods;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.finished_goods;
CREATE POLICY "Enable all access for all users" ON public.finished_goods FOR ALL USING (true) WITH CHECK (true);

-- Pontas
ALTER TABLE public.pontas_stock ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for pontas_stock" ON public.pontas_stock;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.pontas_stock;
CREATE POLICY "Enable all access for all users" ON public.pontas_stock FOR ALL USING (true) WITH CHECK (true);

-- Transfers
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to transfers" ON public.transfers;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.transfers;
CREATE POLICY "Enable all access for all users" ON public.transfers FOR ALL USING (true) WITH CHECK (true);

-- FG Transfers
ALTER TABLE public.finished_goods_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to finished_goods_transfers" ON public.finished_goods_transfers;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.finished_goods_transfers;
CREATE POLICY "Enable all access for all users" ON public.finished_goods_transfers FOR ALL USING (true) WITH CHECK (true);

-- 6. Tabelas Auxiliares (Relatórios, Peças, Ganchos, etc)
-- Shift Reports
ALTER TABLE public.shift_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to shift_reports" ON public.shift_reports;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.shift_reports;
CREATE POLICY "Enable all access for all users" ON public.shift_reports FOR ALL USING (true) WITH CHECK (true);

-- Production Records
ALTER TABLE public.production_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to production_records" ON public.production_records;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.production_records;
CREATE POLICY "Enable all access for all users" ON public.production_records FOR ALL USING (true) WITH CHECK (true);

-- Inventory Sessions
ALTER TABLE public.inventory_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to inventory_sessions" ON public.inventory_sessions;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.inventory_sessions;
CREATE POLICY "Enable all access for all users" ON public.inventory_sessions FOR ALL USING (true) WITH CHECK (true);

-- Sticky Notes
ALTER TABLE public.sticky_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to sticky_notes" ON public.sticky_notes;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.sticky_notes;
CREATE POLICY "Enable all access for all users" ON public.sticky_notes FOR ALL USING (true) WITH CHECK (true);

-- Stock Gauges
ALTER TABLE public.stock_gauges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to stock_gauges" ON public.stock_gauges;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.stock_gauges;
CREATE POLICY "Enable all access for all users" ON public.stock_gauges FOR ALL USING (true) WITH CHECK (true);

-- 7. Tabelas de RH e Gestão de Pessoas (Se existirem)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'employees') THEN
        ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Access employees" ON public.employees;
        DROP POLICY IF EXISTS "Enable all access for all users" ON public.employees;
        CREATE POLICY "Enable all access for all users" ON public.employees FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'employee_courses') THEN
        ALTER TABLE public.employee_courses ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Enable all access for all users" ON public.employee_courses;
        CREATE POLICY "Enable all access for all users" ON public.employee_courses FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'employee_absences') THEN
        ALTER TABLE public.employee_absences ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Enable all access for all users" ON public.employee_absences;
        CREATE POLICY "Enable all access for all users" ON public.employee_absences FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'employee_vacations') THEN
        -- Adiciona a coluna period se ela não existir
        ALTER TABLE public.employee_vacations ADD COLUMN IF NOT EXISTS period TEXT;

        -- Atualiza a constraint de status para permitir 'Agendada'
        ALTER TABLE public.employee_vacations DROP CONSTRAINT IF EXISTS employee_vacations_status_check;
        ALTER TABLE public.employee_vacations ADD CONSTRAINT employee_vacations_status_check CHECK (status IN ('Agendada', 'Programada', 'Gozada', 'Vendida', 'Cancelada'));

        ALTER TABLE public.employee_vacations ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Enable all access for all users" ON public.employee_vacations;
        CREATE POLICY "Enable all access for all users" ON public.employee_vacations FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'employee_responsibilities') THEN
        ALTER TABLE public.employee_responsibilities ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Enable all access for all users" ON public.employee_responsibilities;
        CREATE POLICY "Enable all access for all users" ON public.employee_responsibilities FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 8. Tabela meeting_categories (Grupos de Pautas/Gemba)
CREATE TABLE IF NOT EXISTS public.meeting_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL,
    icon_name TEXT DEFAULT 'ClipboardListIcon',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.meeting_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.meeting_categories;
CREATE POLICY "Enable all access for all users" ON public.meeting_categories FOR ALL USING (true) WITH CHECK (true);

-- 9. Tabela meetings (Pautas de Reunião)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'meetings') THEN
        ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Enable all access for all users" ON public.meetings;
        CREATE POLICY "Enable all access for all users" ON public.meetings FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 10. Mensagem de Sucesso
SELECT 'Master Fix aplicado com sucesso!' as status;


-- Arquivo: fix_tables_and_rls.sql
-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create or Update 'finished_goods' table
CREATE TABLE IF NOT EXISTS public.finished_goods (
    id TEXT PRIMARY KEY,
    production_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    production_order_id TEXT,
    order_number TEXT,
    product_type TEXT,
    model TEXT,
    size TEXT,
    quantity NUMERIC,
    total_weight NUMERIC,
    status TEXT DEFAULT 'Disponível'
);

-- Ensure RLS is enabled
ALTER TABLE public.finished_goods ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for finished_goods
DROP POLICY IF EXISTS "Enable read access for all users" ON public.finished_goods;
CREATE POLICY "Enable read access for all users" ON public.finished_goods FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert access for all users" ON public.finished_goods;
CREATE POLICY "Enable insert access for all users" ON public.finished_goods FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update access for all users" ON public.finished_goods;
CREATE POLICY "Enable update access for all users" ON public.finished_goods FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Enable delete access for all users" ON public.finished_goods;
CREATE POLICY "Enable delete access for all users" ON public.finished_goods FOR DELETE USING (true);


-- 2. Ensure 'stock_items' has correct policies (just in case)
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.stock_items;
CREATE POLICY "Enable read access for all users" ON public.stock_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable update access for all users" ON public.stock_items;
CREATE POLICY "Enable update access for all users" ON public.stock_items FOR UPDATE USING (true);


-- 3. Verify 'production_orders' columns
-- Sometimes columns might be missing if schema evolved
ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS "actual_produced_weight" NUMERIC;
ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS "actual_produced_quantity" NUMERIC;

-- 4. Create or Update 'pontas_stock' table
CREATE TABLE IF NOT EXISTS public.pontas_stock (
    id TEXT PRIMARY KEY,
    production_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    production_order_id TEXT,
    order_number TEXT,
    product_type TEXT,
    model TEXT,
    size TEXT,
    quantity NUMERIC,
    total_weight NUMERIC,
    status TEXT DEFAULT 'Disponível'
);

ALTER TABLE public.pontas_stock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for pontas_stock" ON public.pontas_stock;
CREATE POLICY "Enable all access for pontas_stock" ON public.pontas_stock FOR ALL USING (true);


-- Arquivo: fix_updated_at_column.sql
-- Script para corrigir o erro "record "new" has no field "updated_at""
-- Este erro ocorre porque a tabela production_orders já existia sem a coluna updated_at,
-- e o comando CREATE TABLE IF NOT EXISTS não adiciona colunas a tabelas existentes.

-- 1. Adicionar a coluna updated_at se ela não existir
ALTER TABLE production_orders 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Garantir que a função do trigger existe e está correta
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Recriar o trigger para garantir que ele está associado corretamente
DROP TRIGGER IF EXISTS update_production_orders_updated_at ON production_orders;

CREATE TRIGGER update_production_orders_updated_at
    BEFORE UPDATE ON production_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Confirmação
COMMENT ON COLUMN production_orders.updated_at IS 'Data da última atualização do registro';


-- Arquivo: fix_bugged_stock_items.sql
-- Atualiza itens presos na Trefila
UPDATE stock_items
SET status = 'Disponível'
WHERE status = 'Em Produção - Trefila';

-- Atualiza itens presos na Treliça
UPDATE stock_items
SET status = 'Disponível'
WHERE status = 'Em Produção - Treliça';

-- Opcional: Atualiza o status genérico "Em Produção" se houver
UPDATE stock_items
SET status = 'Disponível'
WHERE status = 'Em Produção';


-- Arquivo: fix_people_management_permissions.sql
-- Enable RLS and add policies for People Management tables to ensure data is accessible
-- These policies allow the application (using the anon key) to Read/Write data.
-- Access control is handled by the Application Logic (App.tsx and PeopleManagement.tsx).

-- 1. Employee Courses
ALTER TABLE employee_courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON employee_courses;
CREATE POLICY "Enable all access" ON employee_courses FOR ALL USING (true) WITH CHECK (true);

-- 2. Evaluations
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON evaluations;
CREATE POLICY "Enable all access" ON evaluations FOR ALL USING (true) WITH CHECK (true);

-- 3. Employee Absences
ALTER TABLE employee_absences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON employee_absences;
CREATE POLICY "Enable all access" ON employee_absences FOR ALL USING (true) WITH CHECK (true);

-- 4. Employee Vacations
ALTER TABLE employee_vacations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON employee_vacations;
CREATE POLICY "Enable all access" ON employee_vacations FOR ALL USING (true) WITH CHECK (true);

-- 5. Employee Responsibilities
ALTER TABLE employee_responsibilities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON employee_responsibilities;
CREATE POLICY "Enable all access" ON employee_responsibilities FOR ALL USING (true) WITH CHECK (true);

-- 6. Employee Documents
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON employee_documents;
CREATE POLICY "Enable all access" ON employee_documents FOR ALL USING (true) WITH CHECK (true);


-- Arquivo: fix_rls_for_realtime.sql
-- Garante permissões de leitura para o Realtime funcionar
-- ATENÇÃO: Isso libera leitura pública. Em produção, ajuste conforme necessário.

-- Stock Items
ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read stock_items" ON stock_items FOR SELECT USING (true);

-- Conferences
ALTER TABLE conferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read conferences" ON conferences FOR SELECT USING (true);

-- Production Orders
ALTER TABLE production_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read production_orders" ON production_orders FOR SELECT USING (true);

-- Finished Goods
ALTER TABLE finished_goods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read finished_goods" ON finished_goods FOR SELECT USING (true);

-- Pontas Stock
ALTER TABLE pontas_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read pontas_stock" ON pontas_stock FOR SELECT USING (true);

-- Transfers
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read transfers" ON transfers FOR SELECT USING (true);

-- Finished Goods Transfers
ALTER TABLE finished_goods_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read finished_goods_transfers" ON finished_goods_transfers FOR SELECT USING (true);

-- Parts Requests
ALTER TABLE parts_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read parts_requests" ON parts_requests FOR SELECT USING (true);

-- Shift Reports
ALTER TABLE shift_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read shift_reports" ON shift_reports FOR SELECT USING (true);

-- Production Records
ALTER TABLE production_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read production_records" ON production_records FOR SELECT USING (true);

-- Messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read messages" ON messages FOR SELECT USING (true);


-- Arquivo: fix_storage_policies.sql

-- Fix Storage Policies for 'spare-parts'

-- 1. Ensure bucket exists and is public
INSERT INTO storage.buckets (id, name, public) 
VALUES ('spare-parts', 'spare-parts', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop potential conflicting policies for this bucket
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "spare_parts_read" ON storage.objects;
DROP POLICY IF EXISTS "spare_parts_insert" ON storage.objects;
DROP POLICY IF EXISTS "spare_parts_update" ON storage.objects;

-- 3. Create Permissive Policies for 'spare-parts' bucket (Allow Anon + Auth)
CREATE POLICY "spare_parts_read" ON storage.objects 
FOR SELECT USING (bucket_id = 'spare-parts');

CREATE POLICY "spare_parts_insert" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'spare-parts');

CREATE POLICY "spare_parts_update" ON storage.objects 
FOR UPDATE WITH CHECK (bucket_id = 'spare-parts');


-- Arquivo: activate_realtime.sql
-- Habilitar Realtime para todas as tabelas principais
-- Execute isso no SQL Editor do Supabase

-- Primeiro, garante que a publicação existe (padrão no Supabase)
-- Se der erro dizendo que já existe, ignore
-- create publication supabase_realtime;

-- Adiciona as tabelas à publicação
alter publication supabase_realtime add table stock_items;
alter publication supabase_realtime add table conferences;
alter publication supabase_realtime add table production_orders;
alter publication supabase_realtime add table transfers;
alter publication supabase_realtime add table finished_goods;
alter publication supabase_realtime add table pontas_stock;
alter publication supabase_realtime add table finished_goods_transfers;
alter publication supabase_realtime add table parts_requests;
alter publication supabase_realtime add table shift_reports;
alter publication supabase_realtime add table production_records;
alter publication supabase_realtime add table messages;

-- Verifica quais tabelas estão habilitadas
select * from pg_publication_tables where pubname = 'supabase_realtime';


-- Arquivo: add_absence_attachment.sql
-- Add attachment columns to employee_absences table
ALTER TABLE employee_absences 
ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- (Optional) If we wanted to track original filename too, but URL is enough for now.
-- ADD COLUMN IF NOT EXISTS attachment_name TEXT;


-- Arquivo: add_conferral_and_op_columns.sql
-- Adiciona colunas para controle de conferência e OP na tabela finished_goods
ALTER TABLE public.finished_goods ADD COLUMN IF NOT EXISTS is_conferred BOOLEAN DEFAULT true;
ALTER TABLE public.finished_goods ADD COLUMN IF NOT EXISTS conferral_justification TEXT;
ALTER TABLE public.finished_goods ADD COLUMN IF NOT EXISTS op_start_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.finished_goods ADD COLUMN IF NOT EXISTS op_end_time TIMESTAMP WITH TIME ZONE;

-- Adiciona colunas para controle de conferência e OP na tabela pontas_stock
ALTER TABLE public.pontas_stock ADD COLUMN IF NOT EXISTS is_conferred BOOLEAN DEFAULT true;
ALTER TABLE public.pontas_stock ADD COLUMN IF NOT EXISTS conferral_justification TEXT;
ALTER TABLE public.pontas_stock ADD COLUMN IF NOT EXISTS op_start_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.pontas_stock ADD COLUMN IF NOT EXISTS op_end_time TIMESTAMP WITH TIME ZONE;


-- Arquivo: add_last_quantity_update_column.sql
ALTER TABLE production_orders ADD COLUMN lastQuantityUpdate text;


-- Arquivo: add_pending_transfer_column.sql
-- Adiciona a coluna pending_transfer_quantity na tabela finished_goods
ALTER TABLE public.finished_goods ADD COLUMN IF NOT EXISTS pending_transfer_quantity NUMERIC DEFAULT 0;

-- Adiciona a coluna pending_transfer_quantity na tabela pontas_stock
ALTER TABLE public.pontas_stock ADD COLUMN IF NOT EXISTS pending_transfer_quantity NUMERIC DEFAULT 0;


-- Arquivo: add_product_code_to_gauges.sql
-- Add product_code column to stock_gauges table
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS product_code TEXT;


-- Arquivo: link_users_employees.sql
-- Link App Users to Employees (Corrected Type)
ALTER TABLE app_users
ADD COLUMN IF NOT EXISTS employee_id TEXT REFERENCES employees(id);


-- Arquivo: FIX_DESBOBINADEIRA_FINAL.sql
-- ============================================================
-- CORREÇÃO COMPLETA PARA DESBOBINADEIRA
-- Execute este script inteiro no SQL Editor do Supabase
-- ============================================================

-- 1. Remover constraint antiga de machine e criar nova que aceita Desbobinadeira
ALTER TABLE public.production_orders DROP CONSTRAINT IF EXISTS production_orders_machine_check;

ALTER TABLE public.production_orders
    ADD CONSTRAINT production_orders_machine_check 
    CHECK (machine IN ('Trefila', 'Treliça', 'Trefila 1', 'Trefila 2', 'Treliça 1', 'Treliça 2', 'Desbobinadeira 1'));

-- 2. Tornar quantity_to_produce opcional (Desbobinadeira não usa)
ALTER TABLE public.production_orders
    ALTER COLUMN quantity_to_produce SET DEFAULT 0;

-- 3. Adicionar novas colunas para Desbobinadeira (se ainda não existirem)
ALTER TABLE public.production_orders
    ADD COLUMN IF NOT EXISTS is_ghost_order BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS input_bitola TEXT,
    ADD COLUMN IF NOT EXISTS os_items JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS summary JSONB;

-- 4. Verificação: mostrar estrutura atual da tabela
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'production_orders'
ORDER BY ordinal_position;


