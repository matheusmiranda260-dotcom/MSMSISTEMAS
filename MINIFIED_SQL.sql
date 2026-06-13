CREATE TABLE IF NOT EXISTS public.app_users (

    id TEXT PRIMARY KEY,

    username TEXT NOT NULL UNIQUE,

    password TEXT NOT NULL,

    role TEXT CHECK (role IN ('admin', 'user', 'gestor')),

    permissions JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ DEFAULT NOW()

);

DROP POLICY IF EXISTS "Enable all access for all users" ON public.app_users;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.app_users;

DROP POLICY IF EXISTS "Enable insert access for all users" ON public.app_users;

DROP POLICY IF EXISTS "Enable update access for all users" ON public.app_users;

DROP POLICY IF EXISTS "Enable delete access for all users" ON public.app_users;

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.app_users

    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON public.app_users

    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON public.app_users

    FOR UPDATE USING (true);

CREATE POLICY "Enable delete access for all users" ON public.app_users

    FOR DELETE USING (true);

INSERT INTO public.app_users (id, username, password, role, permissions)

VALUES 

    ('admin-001', 'gestor', '070223', 'gestor', '{"trelica": true, "trefila": true, "stock": true, "reports": true}'::jsonb),

    ('admin-002', 'matheusmiranda357@gmail.com', '070223', 'gestor', '{"trelica": true, "trefila": true, "stock": true, "reports": true}'::jsonb)

ON CONFLICT (username) DO NOTHING;

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

CREATE TABLE IF NOT EXISTS public.evaluations (

    id TEXT PRIMARY KEY,

    employee_id TEXT REFERENCES public.employees(id),

    evaluator TEXT NOT NULL, -- Quem avaliou (nome do gestor)

    date TIMESTAMPTZ DEFAULT NOW(),

    organization_score INTEGER NOT NULL,

    cleanliness_score INTEGER NOT NULL,

    effort_score INTEGER NOT NULL,

    communication_score INTEGER NOT NULL,

    improvement_score INTEGER NOT NULL,

    total_score INTEGER GENERATED ALWAYS AS (organization_score + cleanliness_score + effort_score + communication_score + improvement_score) STORED,

    note TEXT,

    photo_url TEXT -- Evidência opcional

);

CREATE TABLE IF NOT EXISTS public.achievements (

    id TEXT PRIMARY KEY,

    employee_id TEXT REFERENCES public.employees(id),

    type TEXT NOT NULL, -- 'model_area', 'idea_month', 'highlight_week', 'custom'

    title TEXT NOT NULL,

    description TEXT,

    date TIMESTAMPTZ DEFAULT NOW()

);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access employees" ON public.employees FOR ALL USING (true);

CREATE POLICY "Access evaluations" ON public.evaluations FOR ALL USING (true);

CREATE POLICY "Access achievements" ON public.achievements FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS public.org_units (

    id TEXT PRIMARY KEY,

    name TEXT NOT NULL, -- Ex: "Máquina Trefila 01"

    unit_type TEXT, -- 'machine', 'department', 'sector'

    parent_id TEXT REFERENCES public.org_units(id), -- Para hierarquias de setores (opcional)

    display_order INTEGER DEFAULT 0

);

CREATE TABLE IF NOT EXISTS public.org_positions (

    id TEXT PRIMARY KEY,

    org_unit_id TEXT REFERENCES public.org_units(id) ON DELETE CASCADE,

    title TEXT NOT NULL, -- Ex: "Operador de Máquina"

    is_leadership BOOLEAN DEFAULT FALSE,

    display_order INTEGER DEFAULT 0

);

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS org_position_id TEXT REFERENCES public.org_positions(id);

ALTER TABLE public.org_units ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.org_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access org_units" ON public.org_units FOR ALL USING (true);

CREATE POLICY "Access org_positions" ON public.org_positions FOR ALL USING (true);

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS job_title TEXT; -- Cargo

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS admission_date DATE;

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS birth_date DATE;

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS marital_status TEXT; -- Solteiro(a), Casado(a), etc

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS children_count INTEGER DEFAULT 0;

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS manager_id TEXT REFERENCES public.employees(id); -- Para o Organograma

CREATE TABLE IF NOT EXISTS public.employee_courses (

    id TEXT PRIMARY KEY,

    employee_id TEXT REFERENCES public.employees(id),

    course_name TEXT NOT NULL,

    institution TEXT,

    completion_date DATE,

    expiry_date DATE, -- Para cursos com validade (NRs)

    status TEXT CHECK (status IN ('Concluído', 'Em Andamento', 'Pendente'))

);

CREATE TABLE IF NOT EXISTS public.employee_absences (

    id TEXT PRIMARY KEY,

    employee_id TEXT REFERENCES public.employees(id),

    start_date DATE NOT NULL,

    end_date DATE,

    reason TEXT NOT NULL, -- Doença, Falta Injustificada, Motivos Pessoais

    type TEXT -- Atestado, Falta, Licença

);

CREATE TABLE IF NOT EXISTS public.employee_vacations (

    id TEXT PRIMARY KEY,

    employee_id TEXT REFERENCES public.employees(id),

    period TEXT,

    start_date DATE NOT NULL,

    end_date DATE NOT NULL,

    status TEXT CHECK (status IN ('Agendada', 'Programada', 'Gozada', 'Vendida', 'Cancelada'))

);

CREATE TABLE IF NOT EXISTS public.employee_responsibilities (

    id TEXT PRIMARY KEY,

    employee_id TEXT REFERENCES public.employees(id),

    description TEXT NOT NULL,

    is_critical BOOLEAN DEFAULT FALSE -- Se é uma função chave

);

ALTER TABLE public.employee_courses ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.employee_absences ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.employee_vacations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.employee_responsibilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access employee_courses" ON public.employee_courses FOR ALL USING (true);

CREATE POLICY "Access employee_absences" ON public.employee_absences FOR ALL USING (true);

CREATE POLICY "Access employee_vacations" ON public.employee_vacations FOR ALL USING (true);

CREATE POLICY "Access employee_responsibilities" ON public.employee_responsibilities FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS public.employee_documents (

    id TEXT PRIMARY KEY,

    employee_id TEXT REFERENCES public.employees(id),

    title TEXT NOT NULL, -- Ex: "Carteira de Vacinação"

    type TEXT NOT NULL, -- Ex: "Atestado", "Pessoal", "Outros"

    url TEXT NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW()

);

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access employee_documents" ON public.employee_documents FOR ALL USING (true);

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

ALTER TABLE spare_parts ENABLE ROW LEVEL SECURITY;

ALTER TABLE part_usage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for users" ON spare_parts FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for users" ON part_usage_history FOR ALL USING (true) WITH CHECK (true);

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

ALTER TABLE trefila_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access to recipes" ON trefila_recipes

    FOR ALL USING (true) WITH CHECK (true);

create table if not exists public.trefila_rings_stock (

    id uuid default gen_random_uuid() primary key,

    model text not null, -- e.g. "PR 3.20", "CA 3.55"

    quantity integer default 0,

    created_at timestamp with time zone default timezone('utc'::text, now()) not null,

    updated_at timestamp with time zone default timezone('utc'::text, now()) not null

);

alter table public.trefila_rings_stock enable row level security;

create policy "Enable all for public" on public.trefila_rings_stock for all using (true) with check (true);

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

CREATE TABLE IF NOT EXISTS public.work_instructions (

    id TEXT PRIMARY KEY,

    title TEXT NOT NULL,

    machine TEXT, -- The machine or function this applies to

    description TEXT,

    steps JSONB DEFAULT '[]'::jsonb, -- Array of { title, description, photoUrl, order }

    created_at TIMESTAMPTZ DEFAULT NOW(),

    updated_at TIMESTAMPTZ DEFAULT NOW()

);

ALTER TABLE public.work_instructions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Select Instructions" ON public.work_instructions;

DROP POLICY IF EXISTS "Public Insert Instructions" ON public.work_instructions;

DROP POLICY IF EXISTS "Public Update Instructions" ON public.work_instructions;

DROP POLICY IF EXISTS "Public Delete Instructions" ON public.work_instructions;

CREATE POLICY "Public Select Instructions" ON public.work_instructions FOR SELECT USING (true);

CREATE POLICY "Public Insert Instructions" ON public.work_instructions FOR INSERT WITH CHECK (true);

CREATE POLICY "Public Update Instructions" ON public.work_instructions FOR UPDATE USING (true);

CREATE POLICY "Public Delete Instructions" ON public.work_instructions FOR DELETE USING (true);

INSERT INTO storage.buckets (id, name, public) 

VALUES ('instruction-images', 'instruction-images', true)

ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Instructions Public Select" ON storage.objects;

DROP POLICY IF EXISTS "Instructions Public Insert" ON storage.objects;

DROP POLICY IF EXISTS "Instructions Public Update" ON storage.objects;

CREATE POLICY "Instructions Public Select" ON storage.objects 

FOR SELECT USING ( bucket_id = 'instruction-images' );

CREATE POLICY "Instructions Public Insert" ON storage.objects 

FOR INSERT WITH CHECK ( bucket_id = 'instruction-images' );

CREATE POLICY "Instructions Public Update" ON storage.objects 

FOR UPDATE USING ( bucket_id = 'instruction-images' );

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

ALTER TABLE public.kaizen_problems ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.kaizen_problems;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.kaizen_problems;

DROP POLICY IF EXISTS "Allow public insert" ON public.kaizen_problems;

DROP POLICY IF EXISTS "Allow public update" ON public.kaizen_problems;

DROP POLICY IF EXISTS "Allow public delete" ON public.kaizen_problems;

CREATE POLICY "Allow public insert" ON public.kaizen_problems FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public select" ON public.kaizen_problems FOR SELECT USING (true);

CREATE POLICY "Allow public update" ON public.kaizen_problems FOR UPDATE USING (true);

CREATE POLICY "Allow public delete" ON public.kaizen_problems FOR DELETE USING (true);

INSERT INTO storage.buckets (id, name, public) 

VALUES ('kaizen-images', 'kaizen-images', true)

ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Kaizen Public Access" ON storage.objects;

DROP POLICY IF EXISTS "Kaizen Auth Upload" ON storage.objects;

DROP POLICY IF EXISTS "Public Access" ON storage.objects;

DROP POLICY IF EXISTS "Auth Upload" ON storage.objects;

DROP POLICY IF EXISTS "Kaizen Upload" ON storage.objects;

DROP POLICY IF EXISTS "Kaizen Update" ON storage.objects;

CREATE POLICY "Kaizen Public Access" ON storage.objects 

FOR SELECT USING ( bucket_id = 'kaizen-images' );

CREATE POLICY "Kaizen Upload" ON storage.objects 

FOR INSERT WITH CHECK ( bucket_id = 'kaizen-images' );

CREATE POLICY "Kaizen Update" ON storage.objects 

FOR UPDATE USING ( bucket_id = 'kaizen-images' );

CREATE TABLE IF NOT EXISTS public.meetings (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    title TEXT NOT NULL,

    meeting_date TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ DEFAULT now(),

    author TEXT NOT NULL,

    items JSONB DEFAULT '[]'::jsonb

);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for all users" ON public.meetings;

CREATE POLICY "Enable all access for all users" ON public.meetings FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.meetings (title, meeting_date, author, items)

SELECT 'Reunião Semanal 18/02', now(), 'Gestor', 

'[{"id": "1", "content": "Definir metas de produção", "completed": false}, {"id": "2", "content": "Revisar segurança da trefila", "completed": true}]'::jsonb

WHERE NOT EXISTS (SELECT 1 FROM public.meetings);

CREATE TABLE IF NOT EXISTS public.lab_analysis (

    id TEXT PRIMARY KEY,

    lote TEXT NOT NULL,

    fornecedor TEXT NOT NULL,

    k7_1_entrada DOUBLE PRECISION,

    k7_1_saida DOUBLE PRECISION,

    k7_2_entrada DOUBLE PRECISION,

    k7_2_saida DOUBLE PRECISION,

    k7_3_entrada DOUBLE PRECISION,

    k7_3_saida DOUBLE PRECISION,

    k7_4_entrada DOUBLE PRECISION,

    k7_4_saida DOUBLE PRECISION,

    velocidade DOUBLE PRECISION,

    comprimento DOUBLE PRECISION,

    massa DOUBLE PRECISION,

    escoamento DOUBLE PRECISION,

    resistencia DOUBLE PRECISION,

    alongamento DOUBLE PRECISION,

    date TIMESTAMPTZ DEFAULT NOW(),

    operator TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()

);

ALTER TABLE public.lab_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated users" ON public.lab_analysis

    FOR ALL

    USING (true)

    WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.downtime_configs (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    reason TEXT NOT NULL,

    threshold_minutes INTEGER NOT NULL DEFAULT 15,

    machine_type TEXT NOT NULL DEFAULT 'Geral',

    is_active BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT now()

);

ALTER TABLE public.downtime_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.downtime_configs

    FOR SELECT USING (true);

CREATE POLICY "Enable all access for authenticated users" ON public.downtime_configs

    FOR ALL USING (true);

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

CREATE TABLE IF NOT EXISTS employee_documents (

    id TEXT PRIMARY KEY,

    employee_id TEXT REFERENCES employees(id),

    title TEXT,

    type TEXT,

    url TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())

);

ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access" ON employee_documents;

CREATE POLICY "Enable all access" ON employee_documents FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.company_documents (

    id TEXT PRIMARY KEY,

    title TEXT NOT NULL,

    category TEXT,

    url TEXT NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    author TEXT,

    file_type TEXT

);

ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Access company_documents" ON public.company_documents;

CREATE POLICY "Access company_documents" ON public.company_documents FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS public.user_access_logs (

    id TEXT PRIMARY KEY,

    user_id TEXT REFERENCES public.app_users(id) ON DELETE CASCADE,

    username TEXT NOT NULL,

    login_at TIMESTAMPTZ DEFAULT NOW()

);

ALTER TABLE public.user_access_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.user_access_logs;

DROP POLICY IF EXISTS "Enable insert access for all users" ON public.user_access_logs;

DROP POLICY IF EXISTS "Enable delete access for all users" ON public.user_access_logs;

CREATE POLICY "Enable read access for all users" ON public.user_access_logs

    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON public.user_access_logs

    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable delete access for all users" ON public.user_access_logs

    FOR DELETE USING (true);

DO $$

BEGIN

    IF NOT EXISTS (

        SELECT 1 FROM pg_publication_tables 

        WHERE pubname = 'supabase_realtime' AND tablename = 'user_access_logs'

    ) THEN

        ALTER PUBLICATION supabase_realtime ADD TABLE user_access_logs;

    END IF;

END $$;

DROP TABLE IF EXISTS public.technical_evaluations;

CREATE TABLE IF NOT EXISTS public.technical_evaluations (

    id TEXT PRIMARY KEY,

    employee_id TEXT REFERENCES public.employees(id) ON DELETE CASCADE,

    evaluator TEXT NOT NULL,

    date TIMESTAMPTZ DEFAULT NOW(),

    month_num INTEGER NOT NULL, -- 1º, 2º ou 3º Mês de experiência

    machine_type TEXT NOT NULL, -- 'Trefila' ou 'Treliça'

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

    h1_score NUMERIC NOT NULL DEFAULT 0, -- Setup e Ajustes da Máquina

    h2_score NUMERIC NOT NULL DEFAULT 0, -- Ritmo de Trabalho e Produtividade

    h3_score NUMERIC NOT NULL DEFAULT 0, -- Controle de Qualidade e Bitolas

    h4_score NUMERIC NOT NULL DEFAULT 0, -- Segurança e Operação Segura

    a1_score NUMERIC NOT NULL DEFAULT 0, -- Organização e Limpeza (5S)

    a2_score NUMERIC NOT NULL DEFAULT 0, -- Assiduidade e Disciplina

    a3_score NUMERIC NOT NULL DEFAULT 0, -- Iniciativa e Melhoria Contínua

    a4_score NUMERIC NOT NULL DEFAULT 0, -- Trabalho em Equipe e Colaboração

    total_score NUMERIC NOT NULL DEFAULT 0, -- Média geral ponderada/aritmética

    note TEXT

);

ALTER TABLE public.technical_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access technical_evaluations" ON public.technical_evaluations FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS production_orders (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    order_number TEXT NOT NULL UNIQUE,

    machine TEXT NOT NULL CHECK (machine IN ('Trefila', 'Treliça')),

    target_bitola TEXT NOT NULL,

    trelica_model TEXT,

    tamanho TEXT,

    quantity_to_produce INTEGER,

    selected_lot_ids JSONB NOT NULL,

    total_weight NUMERIC NOT NULL DEFAULT 0,

    planned_output_weight NUMERIC,

    actual_produced_weight NUMERIC,

    actual_produced_quantity INTEGER,

    scrap_weight NUMERIC,

    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),

    creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    start_time TIMESTAMPTZ,

    end_time TIMESTAMPTZ,

    downtime_events JSONB DEFAULT '[]'::jsonb,

    processed_lots JSONB DEFAULT '[]'::jsonb,

    operator_logs JSONB DEFAULT '[]'::jsonb,

    weighed_packages JSONB DEFAULT '[]'::jsonb,

    pontas JSONB DEFAULT '[]'::jsonb,

    active_lot_processing JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    updated_at TIMESTAMPTZ DEFAULT NOW()

);

CREATE INDEX IF NOT EXISTS idx_production_orders_order_number ON production_orders(order_number);

CREATE INDEX IF NOT EXISTS idx_production_orders_machine ON production_orders(machine);

CREATE INDEX IF NOT EXISTS idx_production_orders_status ON production_orders(status);

CREATE INDEX IF NOT EXISTS idx_production_orders_creation_date ON production_orders(creation_date);

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

ALTER TABLE production_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to production_orders" ON production_orders;

CREATE POLICY "Allow read access to production_orders"

    ON production_orders

    FOR SELECT

    USING (true);

DROP POLICY IF EXISTS "Allow insert access to production_orders" ON production_orders;

CREATE POLICY "Allow insert access to production_orders"

    ON production_orders

    FOR INSERT

    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update access to production_orders" ON production_orders;

CREATE POLICY "Allow update access to production_orders"

    ON production_orders

    FOR UPDATE

    USING (true)

    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow delete access to production_orders" ON production_orders;

CREATE POLICY "Allow delete access to production_orders"

    ON production_orders

    FOR DELETE

    USING (true);

COMMENT ON TABLE production_orders IS 'Tabela de ordens de produção para Trefila e Treliça';

COMMENT ON COLUMN production_orders.id IS 'ID único da ordem (UUID)';

COMMENT ON COLUMN production_orders.order_number IS 'Número da ordem de produção (único)';

COMMENT ON COLUMN production_orders.machine IS 'Tipo de máquina: Trefila ou Treliça';

COMMENT ON COLUMN production_orders.target_bitola IS 'Bitola alvo a ser produzida';

COMMENT ON COLUMN production_orders.selected_lot_ids IS 'IDs dos lotes selecionados (array ou objeto JSON)';

COMMENT ON COLUMN production_orders.status IS 'Status da ordem: pending, in_progress, completed';

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

    CONSTRAINT unique_machine_date UNIQUE (date, machine_type)

);

ALTER TABLE public.trelica_daily_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for all users" ON public.trelica_daily_reports;

CREATE POLICY "Enable all access for all users" ON public.trelica_daily_reports 

    FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE public.trelica_daily_reports IS 'Tabela que armazena os relatórios de produção diária das máquinas Treliça 1 e 2.';

COMMENT ON COLUMN public.trelica_daily_reports.stops_shift_a IS 'Lista de paradas do turno A (JSON: [{inicio, fim, motivo, duracao}])';

COMMENT ON COLUMN public.trelica_daily_reports.stops_shift_b IS 'Lista de paradas do turno B (JSON: [{inicio, fim, motivo, duracao}])';

COMMENT ON COLUMN public.trelica_daily_reports.stats_shift_a IS 'Dados estatísticos do turno A (JSON: {horasTrabalhadas, pecasProduzidas, tamanhoPeca})';

COMMENT ON COLUMN public.trelica_daily_reports.stats_shift_b IS 'Dados estatísticos do turno B (JSON: {horasTrabalhadas, pecasProduzidas, tamanhoPeca})';

COMMENT ON COLUMN public.trelica_daily_reports.production_updates IS 'Tabela de atualizações de lotes/pesos (JSON: [{qnt, peso, media, data}])';

CREATE TABLE IF NOT EXISTS public.daily_reports (

    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    report_type  TEXT        NOT NULL,  -- 'trefila_diario' | 'trelica_final'

    machine_key  TEXT        NOT NULL,  -- 'Trefila' | 'FinalTrelica'

    date         DATE        NOT NULL,

    data         JSONB       NOT NULL DEFAULT '{}'::jsonb,

    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unique_report_machine_date UNIQUE (report_type, machine_key, date)

);

CREATE INDEX IF NOT EXISTS idx_daily_reports_type_key_date

    ON public.daily_reports (report_type, machine_key, date DESC);

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

ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access" ON public.daily_reports;

CREATE POLICY "Enable all access" ON public.daily_reports

    FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE  public.daily_reports IS 'Relatórios diários de produção: Trefila e Treliça Final.';

COMMENT ON COLUMN public.daily_reports.report_type IS 'Tipo do relatório: trefila_diario | trelica_final';

COMMENT ON COLUMN public.daily_reports.machine_key  IS 'Chave da máquina/setor: Trefila | FinalTrelica';

COMMENT ON COLUMN public.daily_reports.date         IS 'Data de produção do relatório (YYYY-MM-DD)';

COMMENT ON COLUMN public.daily_reports.data         IS 'Payload JSON completo do formulário';

CREATE TABLE IF NOT EXISTS public.stock_gauges (

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    material_type TEXT NOT NULL,

    gauge TEXT NOT NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    UNIQUE(material_type, gauge)

);

ALTER TABLE public.stock_gauges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated users" ON public.stock_gauges

    FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.stock_gauges (material_type, gauge) VALUES 

('Fio Máquina', '8.00'),

('Fio Máquina', '7.00'),

('Fio Máquina', '6.50'),

('Fio Máquina', '6.35'),

('Fio Máquina', '5.50')

ON CONFLICT DO NOTHING;

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

ALTER TABLE public.inventory_sessions 

ADD COLUMN IF NOT EXISTS applied_to_stock BOOLEAN DEFAULT FALSE;

ALTER TABLE public.inventory_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for all users" ON public.inventory_sessions;

CREATE POLICY "Enable all access for all users" ON public.inventory_sessions FOR ALL USING (true);

ALTER publication supabase_realtime ADD TABLE inventory_sessions;

ALTER TABLE public.stock_items ADD COLUMN IF NOT EXISTS location TEXT;

CREATE INDEX IF NOT EXISTS idx_stock_items_location ON public.stock_items (location);

INSERT INTO storage.buckets (id, name, public) 

VALUES ('spare-parts', 'spare-parts', true)

ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Read Access" ON storage.objects 

FOR SELECT USING (bucket_id = 'spare-parts');

CREATE POLICY "Authenticated Upload" ON storage.objects 

FOR INSERT WITH CHECK (bucket_id = 'spare-parts');

CREATE POLICY "Authenticated Update" ON storage.objects 

FOR UPDATE WITH CHECK (bucket_id = 'spare-parts');

ALTER TABLE spare_parts ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE part_usage_history ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'OUT';

ALTER TABLE public.evaluations DROP CONSTRAINT IF EXISTS evaluations_employee_id_fkey;

ALTER TABLE public.evaluations ADD CONSTRAINT evaluations_employee_id_fkey 

    FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

ALTER TABLE public.employee_responsibilities DROP CONSTRAINT IF EXISTS employee_responsibilities_employee_id_fkey;

ALTER TABLE public.employee_responsibilities ADD CONSTRAINT employee_responsibilities_employee_id_fkey 

    FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

ALTER TABLE public.employee_courses DROP CONSTRAINT IF EXISTS employee_courses_employee_id_fkey;

ALTER TABLE public.employee_courses ADD CONSTRAINT employee_courses_employee_id_fkey 

    FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

ALTER TABLE public.employee_absences DROP CONSTRAINT IF EXISTS employee_absences_employee_id_fkey;

ALTER TABLE public.employee_absences ADD CONSTRAINT employee_absences_employee_id_fkey 

    FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

ALTER TABLE public.employee_vacations DROP CONSTRAINT IF EXISTS employee_vacations_employee_id_fkey;

ALTER TABLE public.employee_vacations ADD CONSTRAINT employee_vacations_employee_id_fkey 

    FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;

ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_manager_id_fkey;

ALTER TABLE public.employees ADD CONSTRAINT employees_manager_id_fkey 

    FOREIGN KEY (manager_id) REFERENCES public.employees(id) ON DELETE SET NULL;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.stock_items;

DROP POLICY IF EXISTS "Enable update access for all users" ON public.stock_items;

DROP POLICY IF EXISTS "Allow all access to stock_items" ON public.stock_items;

DROP POLICY IF EXISTS "Enable all access for all users" ON public.stock_items;

CREATE POLICY "Enable all access for all users" ON public.stock_items 

    FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.conferences ADD COLUMN IF NOT EXISTS "conference_number" TEXT;

ALTER TABLE public.conferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to conferences" ON public.conferences;

DROP POLICY IF EXISTS "Enable all access for all users" ON public.conferences;

CREATE POLICY "Enable all access for all users" ON public.conferences 

    FOR ALL USING (true) WITH CHECK (true);

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

ALTER TABLE public.finished_goods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.finished_goods;

DROP POLICY IF EXISTS "Enable insert access for all users" ON public.finished_goods;

DROP POLICY IF EXISTS "Enable update access for all users" ON public.finished_goods;

DROP POLICY IF EXISTS "Enable delete access for all users" ON public.finished_goods;

DROP POLICY IF EXISTS "Enable all access for all users" ON public.finished_goods;

CREATE POLICY "Enable all access for all users" ON public.finished_goods FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.pontas_stock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for pontas_stock" ON public.pontas_stock;

DROP POLICY IF EXISTS "Enable all access for all users" ON public.pontas_stock;

CREATE POLICY "Enable all access for all users" ON public.pontas_stock FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to transfers" ON public.transfers;

DROP POLICY IF EXISTS "Enable all access for all users" ON public.transfers;

CREATE POLICY "Enable all access for all users" ON public.transfers FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.finished_goods_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to finished_goods_transfers" ON public.finished_goods_transfers;

DROP POLICY IF EXISTS "Enable all access for all users" ON public.finished_goods_transfers;

CREATE POLICY "Enable all access for all users" ON public.finished_goods_transfers FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.shift_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to shift_reports" ON public.shift_reports;

DROP POLICY IF EXISTS "Enable all access for all users" ON public.shift_reports;

CREATE POLICY "Enable all access for all users" ON public.shift_reports FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.production_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to production_records" ON public.production_records;

DROP POLICY IF EXISTS "Enable all access for all users" ON public.production_records;

CREATE POLICY "Enable all access for all users" ON public.production_records FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.inventory_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to inventory_sessions" ON public.inventory_sessions;

DROP POLICY IF EXISTS "Enable all access for all users" ON public.inventory_sessions;

CREATE POLICY "Enable all access for all users" ON public.inventory_sessions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.sticky_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to sticky_notes" ON public.sticky_notes;

DROP POLICY IF EXISTS "Enable all access for all users" ON public.sticky_notes;

CREATE POLICY "Enable all access for all users" ON public.sticky_notes FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.stock_gauges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to stock_gauges" ON public.stock_gauges;

DROP POLICY IF EXISTS "Enable all access for all users" ON public.stock_gauges;

CREATE POLICY "Enable all access for all users" ON public.stock_gauges FOR ALL USING (true) WITH CHECK (true);

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

        ALTER TABLE public.employee_vacations ADD COLUMN IF NOT EXISTS period TEXT;

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

CREATE TABLE IF NOT EXISTS public.meeting_categories (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    label TEXT NOT NULL,

    icon_name TEXT DEFAULT 'ClipboardListIcon',

    created_at TIMESTAMPTZ DEFAULT now()

);

ALTER TABLE public.meeting_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for all users" ON public.meeting_categories;

CREATE POLICY "Enable all access for all users" ON public.meeting_categories FOR ALL USING (true) WITH CHECK (true);

DO $$

BEGIN

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'meetings') THEN

        ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "Enable all access for all users" ON public.meetings;

        CREATE POLICY "Enable all access for all users" ON public.meetings FOR ALL USING (true) WITH CHECK (true);

    END IF;

END $$;

SELECT 'Master Fix aplicado com sucesso!' as status;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

ALTER TABLE public.finished_goods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.finished_goods;

CREATE POLICY "Enable read access for all users" ON public.finished_goods FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert access for all users" ON public.finished_goods;

CREATE POLICY "Enable insert access for all users" ON public.finished_goods FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update access for all users" ON public.finished_goods;

CREATE POLICY "Enable update access for all users" ON public.finished_goods FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Enable delete access for all users" ON public.finished_goods;

CREATE POLICY "Enable delete access for all users" ON public.finished_goods FOR DELETE USING (true);

ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.stock_items;

CREATE POLICY "Enable read access for all users" ON public.stock_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable update access for all users" ON public.stock_items;

CREATE POLICY "Enable update access for all users" ON public.stock_items FOR UPDATE USING (true);

ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS "actual_produced_weight" NUMERIC;

ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS "actual_produced_quantity" NUMERIC;

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

ALTER TABLE production_orders 

ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

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

COMMENT ON COLUMN production_orders.updated_at IS 'Data da última atualização do registro';

UPDATE stock_items

SET status = 'Disponível'

WHERE status = 'Em Produção - Trefila';

UPDATE stock_items

SET status = 'Disponível'

WHERE status = 'Em Produção - Treliça';

UPDATE stock_items

SET status = 'Disponível'

WHERE status = 'Em Produção';

ALTER TABLE production_orders ALTER COLUMN active_lot_processing DROP NOT NULL;

ALTER TABLE production_orders ALTER COLUMN processed_lots DROP NOT NULL;

ALTER TABLE production_orders ALTER COLUMN downtime_events DROP NOT NULL;

ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS "os_items" JSONB;

ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS "os_progress" JSONB;

ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS "is_ghost_order" BOOLEAN DEFAULT false;

ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS "input_bitola" TEXT;

ALTER TABLE employee_courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access" ON employee_courses;

CREATE POLICY "Enable all access" ON employee_courses FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access" ON evaluations;

CREATE POLICY "Enable all access" ON evaluations FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE employee_absences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access" ON employee_absences;

CREATE POLICY "Enable all access" ON employee_absences FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE employee_vacations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access" ON employee_vacations;

CREATE POLICY "Enable all access" ON employee_vacations FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE employee_responsibilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access" ON employee_responsibilities;

CREATE POLICY "Enable all access" ON employee_responsibilities FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access" ON employee_documents;

CREATE POLICY "Enable all access" ON employee_documents FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read stock_items" ON stock_items FOR SELECT USING (true);

ALTER TABLE conferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read conferences" ON conferences FOR SELECT USING (true);

ALTER TABLE production_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read production_orders" ON production_orders FOR SELECT USING (true);

ALTER TABLE finished_goods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read finished_goods" ON finished_goods FOR SELECT USING (true);

ALTER TABLE pontas_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read pontas_stock" ON pontas_stock FOR SELECT USING (true);

ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read transfers" ON transfers FOR SELECT USING (true);

ALTER TABLE finished_goods_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read finished_goods_transfers" ON finished_goods_transfers FOR SELECT USING (true);

ALTER TABLE parts_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read parts_requests" ON parts_requests FOR SELECT USING (true);

ALTER TABLE shift_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read shift_reports" ON shift_reports FOR SELECT USING (true);

ALTER TABLE production_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read production_records" ON production_records FOR SELECT USING (true);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read messages" ON messages FOR SELECT USING (true);

INSERT INTO storage.buckets (id, name, public) 

VALUES ('spare-parts', 'spare-parts', true)

ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;

DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;

DROP POLICY IF EXISTS "spare_parts_read" ON storage.objects;

DROP POLICY IF EXISTS "spare_parts_insert" ON storage.objects;

DROP POLICY IF EXISTS "spare_parts_update" ON storage.objects;

CREATE POLICY "spare_parts_read" ON storage.objects 

FOR SELECT USING (bucket_id = 'spare-parts');

CREATE POLICY "spare_parts_insert" ON storage.objects 

FOR INSERT WITH CHECK (bucket_id = 'spare-parts');

CREATE POLICY "spare_parts_update" ON storage.objects 

FOR UPDATE WITH CHECK (bucket_id = 'spare-parts');

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

select * from pg_publication_tables where pubname = 'supabase_realtime';

ALTER TABLE employee_absences 

ADD COLUMN IF NOT EXISTS attachment_url TEXT;

ALTER TABLE employees ADD COLUMN IF NOT EXISTS assigned_machine TEXT;

ALTER TABLE public.production_orders DROP CONSTRAINT IF EXISTS production_orders_status_check;

ALTER TABLE public.production_orders ADD CONSTRAINT production_orders_status_check 

    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'));

SELECT conname, pg_get_constraintdef(oid) 

FROM pg_constraint 

WHERE conrelid = 'public.production_orders'::regclass 

AND contype = 'c';

ALTER TABLE public.finished_goods ADD COLUMN IF NOT EXISTS is_conferred BOOLEAN DEFAULT true;

ALTER TABLE public.finished_goods ADD COLUMN IF NOT EXISTS conferral_justification TEXT;

ALTER TABLE public.finished_goods ADD COLUMN IF NOT EXISTS op_start_time TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.finished_goods ADD COLUMN IF NOT EXISTS op_end_time TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.pontas_stock ADD COLUMN IF NOT EXISTS is_conferred BOOLEAN DEFAULT true;

ALTER TABLE public.pontas_stock ADD COLUMN IF NOT EXISTS conferral_justification TEXT;

ALTER TABLE public.pontas_stock ADD COLUMN IF NOT EXISTS op_start_time TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.pontas_stock ADD COLUMN IF NOT EXISTS op_end_time TIMESTAMP WITH TIME ZONE;

DO $$

DECLARE

    constraint_name text;

BEGIN

    SELECT conname INTO constraint_name

    FROM pg_constraint

    WHERE conrelid = 'production_orders'::regclass

      AND contype = 'c'

      AND conname LIKE 'production_orders_machine_check%';

    IF constraint_name IS NOT NULL THEN

        EXECUTE format('ALTER TABLE production_orders DROP CONSTRAINT %I', constraint_name);

    END IF;

END $$;

ALTER TABLE production_orders

    ALTER COLUMN machine TYPE TEXT,

    ADD CONSTRAINT production_orders_machine_check

        CHECK (machine IN ('Trefila', 'Treliça', 'Desbobinadeira 1'));

ALTER TABLE production_orders

    ADD COLUMN IF NOT EXISTS input_bitola TEXT,

    ADD COLUMN IF NOT EXISTS os_items JSONB DEFAULT '[]'::jsonb,

    ADD COLUMN IF NOT EXISTS is_ghost_order BOOLEAN DEFAULT FALSE,

    ADD COLUMN IF NOT EXISTS summary JSONB;

ALTER TABLE public.production_orders DROP CONSTRAINT IF EXISTS production_orders_machine_check;

ALTER TABLE public.production_orders ADD CONSTRAINT production_orders_machine_check 

    CHECK (machine IN ('Trefila', 'Treliça', 'Trefila 1', 'Trefila 2', 'Treliça 1', 'Treliça 2', 'Desbobinadeira 1'));

SELECT conname, pg_get_constraintdef(oid) 

FROM pg_constraint 

WHERE conrelid = 'public.production_orders'::regclass 

AND contype = 'c';

ALTER TABLE production_orders ADD COLUMN lastQuantityUpdate text;

ALTER TABLE public.finished_goods ADD COLUMN IF NOT EXISTS pending_transfer_quantity NUMERIC DEFAULT 0;

ALTER TABLE public.pontas_stock ADD COLUMN IF NOT EXISTS pending_transfer_quantity NUMERIC DEFAULT 0;

ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS product_code TEXT;

ALTER TABLE shift_reports ADD COLUMN IF NOT EXISTS total_produced_quantity NUMERIC DEFAULT 0;

ALTER TABLE shift_reports ADD COLUMN IF NOT EXISTS total_produced_weight NUMERIC DEFAULT 0;

ALTER TABLE shift_reports ADD COLUMN IF NOT EXISTS total_produced_meters NUMERIC DEFAULT 0;

ALTER TABLE shift_reports ADD COLUMN IF NOT EXISTS total_scrap_weight NUMERIC DEFAULT 0;

ALTER TABLE shift_reports ADD COLUMN IF NOT EXISTS scrap_percentage NUMERIC DEFAULT 0;

ALTER TABLE public.production_orders DROP CONSTRAINT IF EXISTS production_orders_machine_check;

ALTER TABLE public.production_orders

    ADD CONSTRAINT production_orders_machine_check 

    CHECK (machine IN ('Trefila', 'Treliça', 'Trefila 1', 'Trefila 2', 'Treliça 1', 'Treliça 2', 'Desbobinadeira 1'));

ALTER TABLE public.production_orders

    ALTER COLUMN quantity_to_produce SET DEFAULT 0;

ALTER TABLE public.production_orders

    ADD COLUMN IF NOT EXISTS is_ghost_order BOOLEAN DEFAULT FALSE,

    ADD COLUMN IF NOT EXISTS input_bitola TEXT,

    ADD COLUMN IF NOT EXISTS os_items JSONB DEFAULT '[]'::jsonb,

    ADD COLUMN IF NOT EXISTS summary JSONB;

SELECT column_name, data_type, is_nullable, column_default

FROM information_schema.columns

WHERE table_name = 'production_orders'

ORDER BY ordinal_position;

ALTER TABLE app_users

ADD COLUMN IF NOT EXISTS employee_id TEXT REFERENCES employees(id);
