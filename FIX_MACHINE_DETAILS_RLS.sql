-- Desabilitar RLS para permitir inserções e atualizações a partir do frontend
ALTER TABLE machine_technical_details DISABLE ROW LEVEL SECURITY;

-- Alternativamente, se preferir manter o RLS ativado, descomente as linhas abaixo:
-- ALTER TABLE machine_technical_details ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "Allow all operations" ON machine_technical_details;
-- CREATE POLICY "Allow all operations" ON machine_technical_details FOR ALL USING (true) WITH CHECK (true);
