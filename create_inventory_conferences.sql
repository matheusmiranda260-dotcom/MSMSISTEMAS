-- Script para criar a tabela de histórico de conferências de inventário (Pátio)

CREATE TABLE IF NOT EXISTS inventory_conferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    lots JSONB NOT NULL DEFAULT '[]'::jsonb,
    user_name TEXT,
    status TEXT DEFAULT 'Finalizada'
);

-- Configurando permissões do Row Level Security (RLS) para permitir leitura e gravação
ALTER TABLE inventory_conferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON inventory_conferences FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON inventory_conferences FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON inventory_conferences FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON inventory_conferences FOR DELETE USING (true);
