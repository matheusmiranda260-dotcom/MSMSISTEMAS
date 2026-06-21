-- Cole este código no SQL Editor do Supabase e clique em RUN
-- Isso irá desativar as políticas de segurança de linha (RLS) de todas as tabelas do sistema de apontamento, liberando a leitura e gravação.

-- Tabelas de Orçamentos
ALTER TABLE public.quotes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_product_ferros DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_history DISABLE ROW LEVEL SECURITY;

-- Tabelas de Modelos
ALTER TABLE public.model_estribos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_ferros DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_travas DISABLE ROW LEVEL SECURITY;

-- Tabelas de Configurações
ALTER TABLE public.config_bitolas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_arame DISABLE ROW LEVEL SECURITY;
