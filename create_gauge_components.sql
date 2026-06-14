-- 1. Adicionar o tipo de item para diferenciar matéria-prima de produto composto
ALTER TABLE public.stock_gauges ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'materia_prima';

-- 2. Criar a tabela de componentes da ficha técnica do produto composto
CREATE TABLE IF NOT EXISTS public.gauge_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_gauge_id UUID REFERENCES public.stock_gauges(id) ON DELETE CASCADE,
    component_gauge_id UUID REFERENCES public.stock_gauges(id) ON DELETE RESTRICT,
    funcao TEXT, -- ex: 'Banzo Sup. (Topo)', 'Diagonais', 'Banzo Inf. (Base)', ou customizado
    consumption NUMERIC NOT NULL DEFAULT 0, -- consumo em kg por unidade
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Habilitar segurança RLS na nova tabela
ALTER TABLE public.gauge_components ENABLE ROW LEVEL SECURITY;

-- 4. Criar política de acesso livre (idêntica às outras tabelas do sistema)
DROP POLICY IF EXISTS "Enable all access for all users" ON public.gauge_components;
CREATE POLICY "Enable all access for all users" ON public.gauge_components FOR ALL USING (true) WITH CHECK (true);
