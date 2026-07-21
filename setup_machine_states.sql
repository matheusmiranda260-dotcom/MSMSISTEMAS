-- Criação da tabela para armazenar o estado em tempo real das máquinas
CREATE TABLE IF NOT EXISTS public.machine_current_states (
    machine_name TEXT PRIMARY KEY,
    operator_id TEXT REFERENCES public.app_users(id),
    status TEXT DEFAULT 'PARADA',
    status_since TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    stop_reason TEXT,
    idle_since TIMESTAMP WITH TIME ZONE,
    porta_rolo_1_lot TEXT,
    porta_rolo_2_lot TEXT,
    active_feed_1 BOOLEAN DEFAULT true,
    active_feed_2 BOOLEAN DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS (opcional, mas recomendado. Como é um painel interno, podemos deixar aberto para leitura/escrita autenticada)
ALTER TABLE public.machine_current_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all authenticated users" ON public.machine_current_states
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert/update for all authenticated users" ON public.machine_current_states
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Gatilho para atualizar a coluna updated_at
CREATE OR REPLACE FUNCTION update_machine_current_states_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_machine_current_states_updated_at ON public.machine_current_states;
CREATE TRIGGER trg_machine_current_states_updated_at
BEFORE UPDATE ON public.machine_current_states
FOR EACH ROW
EXECUTE FUNCTION update_machine_current_states_updated_at();

-- Garantir que a tabela esteja na publicação Realtime
-- Caso já exista, o Postgres ignora as que já estão, então é seguro rodar
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'machine_current_states'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.machine_current_states;
    END IF;
END $$;
