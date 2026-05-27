-- Adicionar novas colunas de rastreamento na tabela app_users
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Habilitar replicação em tempo real para a tabela app_users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'app_users'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE app_users;
    END IF;
END $$;
