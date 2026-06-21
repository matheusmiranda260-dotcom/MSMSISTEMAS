-- RESOLVENDO PROBLEMAS DE PERMISSÃO (RLS)
-- Cole isso no SQL Editor do Supabase e clique em RUN

-- 1. Se você quiser manter o RLS ativado por segurança, 
-- precisamos criar políticas (policies) que permitam ao aplicativo ler, inserir, atualizar e deletar os dados.

-- Tabela: config_bitolas
ALTER TABLE public.config_bitolas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso total bitolas" ON public.config_bitolas;
CREATE POLICY "Permitir acesso total bitolas" ON public.config_bitolas FOR ALL USING (true) WITH CHECK (true);

-- Tabela: config_arame
ALTER TABLE public.config_arame ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso total arame" ON public.config_arame;
CREATE POLICY "Permitir acesso total arame" ON public.config_arame FOR ALL USING (true) WITH CHECK (true);

-- Tabela: model_estribos
ALTER TABLE public.model_estribos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso total estribos" ON public.model_estribos;
CREATE POLICY "Permitir acesso total estribos" ON public.model_estribos FOR ALL USING (true) WITH CHECK (true);

-- Tabela: model_ferros
ALTER TABLE public.model_ferros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso total ferros" ON public.model_ferros;
CREATE POLICY "Permitir acesso total ferros" ON public.model_ferros FOR ALL USING (true) WITH CHECK (true);

-- Tabela: model_travas
ALTER TABLE public.model_travas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso total travas" ON public.model_travas;
CREATE POLICY "Permitir acesso total travas" ON public.model_travas FOR ALL USING (true) WITH CHECK (true);
