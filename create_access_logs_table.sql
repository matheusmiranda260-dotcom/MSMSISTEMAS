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
