-- supabase_pointing_system.sql
-- =========================================
-- CONFIGURAÇÕES PARAMÉTRICAS
-- =========================================

-- config_bitolas
CREATE TABLE IF NOT EXISTS public.config_bitolas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL,
    kgm NUMERIC NOT NULL,
    price NUMERIC DEFAULT 0,
    amarrado BOOLEAN DEFAULT true,
    corte_dobra BOOLEAN DEFAULT true,
    cod_merco TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- config_arame
CREATE TABLE IF NOT EXISTS public.config_arame (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pts_por_kg NUMERIC NOT NULL DEFAULT 256,
    preco_por_kg NUMERIC NOT NULL DEFAULT 10,
    material_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- model_estribos
CREATE TABLE IF NOT EXISTS public.model_estribos (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    formula TEXT NOT NULL,
    required_sides JSONB NOT NULL DEFAULT '[]'::jsonb,
    svg_template TEXT,
    custom_image_url TEXT,
    custom_drawing_data JSONB,
    applications JSONB NOT NULL DEFAULT '["Coluna", "Pilar", "Broca", "Viga Superior", "Viga Baldrame", "Sapata", "Corte e Dobra", "Outros"]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- model_ferros
CREATE TABLE IF NOT EXISTS public.model_ferros (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    formula TEXT NOT NULL,
    required_sides JSONB NOT NULL DEFAULT '[]'::jsonb,
    custom_image_url TEXT,
    custom_drawing_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- model_travas
CREATE TABLE IF NOT EXISTS public.model_travas (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    formula TEXT NOT NULL,
    required_sides JSONB NOT NULL DEFAULT '[]'::jsonb,
    shape_id INTEGER NOT NULL,
    custom_image_url TEXT,
    custom_drawing_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================
-- ORÇAMENTOS (QUOTES)
-- =========================================

-- quotes
CREATE TABLE IF NOT EXISTS public.quotes (
    id TEXT PRIMARY KEY,
    date TEXT,
    salesperson TEXT,
    client_code TEXT,
    client_name TEXT,
    client_city TEXT,
    client_obs TEXT,
    price NUMERIC DEFAULT 0,
    hardware_type TEXT,
    forecast_date TEXT,
    status TEXT,
    ddd TEXT,
    phone TEXT,
    email TEXT,
    discharge_by_client TEXT,
    acrescimo_percent NUMERIC DEFAULT 0,
    acrescimo_real NUMERIC DEFAULT 0,
    desconto_percent NUMERIC DEFAULT 0,
    desconto_real NUMERIC DEFAULT 0,
    condicoes_pagamento TEXT,
    arame_kg NUMERIC DEFAULT 0,
    arame_preco NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- quote_products
CREATE TABLE IF NOT EXISTS public.quote_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id TEXT REFERENCES public.quotes(id) ON DELETE CASCADE,
    description TEXT,
    qty NUMERIC DEFAULT 0,
    length NUMERIC DEFAULT 0,
    weight_per_meter NUMERIC DEFAULT 0,
    weight NUMERIC DEFAULT 0,
    price NUMERIC DEFAULT 0,
    locked BOOLEAN DEFAULT false,
    attachment_name TEXT,
    attachment_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- quote_product_ferros
CREATE TABLE IF NOT EXISTS public.quote_product_ferros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.quote_products(id) ON DELETE CASCADE,
    nome_elemento TEXT,
    qtde NUMERIC DEFAULT 0,
    bitola TEXT,
    bitola_kgm NUMERIC DEFAULT 0,
    bitola_price NUMERIC DEFAULT 0,
    ferro_model_id TEXT,
    lado_a TEXT,
    lado_b TEXT,
    lado_c TEXT,
    lado_d TEXT,
    lado_e TEXT,
    lado_f TEXT,
    obs TEXT,
    drawing_type TEXT,
    estribo_shape TEXT,
    espacamento TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- quote_notes
CREATE TABLE IF NOT EXISTS public.quote_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id TEXT REFERENCES public.quotes(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- quote_history
CREATE TABLE IF NOT EXISTS public.quote_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id TEXT REFERENCES public.quotes(id) ON DELETE CASCADE,
    date TEXT,
    action TEXT,
    username TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================
-- PUBLICAÇÃO REALTIME E POLÍTICAS DE ACESSO
-- =========================================

-- Desabilitando RLS para facilitar a transição imediata (assim como os partners), 
-- futuramente devem ser habilitadas as políticas apropriadas
ALTER TABLE public.config_bitolas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_arame DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_estribos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_ferros DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_travas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_product_ferros DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_history DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'quotes') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.quotes;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'quote_products') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.quote_products;
    END IF;
END $$;
