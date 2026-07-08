-- Script para criar a tabela de turnos de operadores
CREATE TABLE IF NOT EXISTS operator_shifts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  username TEXT,
  machine TEXT,
  start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Permissões de RLS para a nova tabela
ALTER TABLE operator_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON operator_shifts
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON operator_shifts
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON operator_shifts
    FOR UPDATE USING (true);
