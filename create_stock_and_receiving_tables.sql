-- create_stock_and_receiving_tables.sql
-- Tabelas centrais do estoque, recebimento e apontamento de produção

-- ==========================================
-- 1. Tabela de Conferência (Recebimento)
-- ==========================================
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

ALTER TABLE public.conferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.conferences;
CREATE POLICY "Enable all access for all users" ON public.conferences FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 2. Tabela de Lotes no Estoque (Matéria-Prima)
-- ==========================================
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

ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.stock_items;
CREATE POLICY "Enable all access for all users" ON public.stock_items FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 3. Tabela de Transferências de Aço (FIFO)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.transfers (
    id TEXT PRIMARY KEY,
    date TIMESTAMPTZ DEFAULT NOW(),
    operator TEXT,
    destination_sector TEXT,
    transferred_lots JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.transfers;
CREATE POLICY "Enable all access for all users" ON public.transfers FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 4. Tabela de Movimentação de Produtos Acabados
-- ==========================================
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

ALTER TABLE public.finished_goods_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.finished_goods_transfers;
CREATE POLICY "Enable all access for all users" ON public.finished_goods_transfers FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 5. Tabela de Requisições de Peças de Reposição
-- ==========================================
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

ALTER TABLE public.parts_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.parts_requests;
CREATE POLICY "Enable all access for all users" ON public.parts_requests FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 6. Tabela de Relatórios de Turno
-- ==========================================
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

ALTER TABLE public.shift_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.shift_reports;
CREATE POLICY "Enable all access for all users" ON public.shift_reports FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 7. Tabela de Apontamento de Produção Realizada
-- ==========================================
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

ALTER TABLE public.production_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.production_records;
CREATE POLICY "Enable all access for all users" ON public.production_records FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 8. Tabela de Quadro de Avisos / Notas Adesivas
-- ==========================================
CREATE TABLE IF NOT EXISTS public.sticky_notes (
    id TEXT PRIMARY KEY,
    content TEXT,
    color TEXT,
    author TEXT,
    date TIMESTAMPTZ DEFAULT NOW(),
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sticky_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.sticky_notes;
CREATE POLICY "Enable all access for all users" ON public.sticky_notes FOR ALL USING (true) WITH CHECK (true);
