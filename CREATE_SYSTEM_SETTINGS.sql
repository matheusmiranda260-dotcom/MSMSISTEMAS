-- Criação da tabela system_settings
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ativar RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
-- Permitir leitura para usuários autenticados
CREATE POLICY "Allow read access for authenticated users on system_settings"
    ON system_settings FOR SELECT
    USING (auth.role() = 'authenticated');

-- Permitir update/insert para usuários autenticados (ou você pode restringir por role depois)
CREATE POLICY "Allow insert/update access for authenticated users on system_settings"
    ON system_settings FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Inserir as configurações padrão de taxas (se não existir)
INSERT INTO system_settings (key, value)
VALUES (
    'payment_fees',
    '{"card_1x": 3.46, "card_2x": 4.85, "card_3x": 5.44}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
