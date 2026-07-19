CREATE TABLE IF NOT EXISTS machine_manuals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    machine_name TEXT NOT NULL,
    title TEXT NOT NULL,
    file_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Migrar manuais existentes da tabela machine_technical_details para a nova tabela
INSERT INTO machine_manuals (machine_name, title, file_url)
SELECT machine_name, 'Manual de Instruções', instruction_manual_url
FROM machine_technical_details
WHERE instruction_manual_url IS NOT NULL;

INSERT INTO machine_manuals (machine_name, title, file_url)
SELECT machine_name, 'Manual de Peças', parts_manual_url
FROM machine_technical_details
WHERE parts_manual_url IS NOT NULL;

-- Desabilitar RLS para permitir acesso total pelo frontend (ou pode configurar policies se preferir)
ALTER TABLE machine_manuals DISABLE ROW LEVEL SECURITY;
