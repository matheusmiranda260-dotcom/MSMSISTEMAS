-- Cole este código no SQL Editor do Supabase e clique em RUN
-- Isso vai recriar a tabela config_bitolas com id TEXT (igual às outras tabelas)
-- para aceitar os IDs simples que o sistema usa ('1', '2', '3' etc.)

-- 1. Apagar a tabela antiga (ela provavelmente está vazia ou com dados inválidos)
DROP TABLE IF EXISTS public.config_bitolas;

-- 2. Recriar com id TEXT (mais flexível, aceita qualquer string)
CREATE TABLE public.config_bitolas (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    kgm NUMERIC NOT NULL DEFAULT 0,
    price NUMERIC DEFAULT 0,
    amarrado BOOLEAN DEFAULT true,
    corte_dobra BOOLEAN DEFAULT true,
    cod_merco TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Desativar RLS
ALTER TABLE public.config_bitolas DISABLE ROW LEVEL SECURITY;
