-- Cria a tabela de histórico de paradas de máquina
CREATE TABLE IF NOT EXISTS public.machine_stops (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    machine TEXT NOT NULL,
    user_id UUID REFERENCES public.app_users(id),
    username TEXT,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    reason TEXT DEFAULT 'Aguardando início de produção',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ativa Segurança a Nível de Linha (RLS)
ALTER TABLE public.machine_stops ENABLE ROW LEVEL SECURITY;

-- Cria políticas genéricas de acesso para leitura e gravação
CREATE POLICY "Enable all actions for all users" ON public.machine_stops FOR ALL USING (true) WITH CHECK (true);
