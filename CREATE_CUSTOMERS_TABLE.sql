-- Script para criar a tabela de clientes

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_type VARCHAR(50) NOT NULL, -- 'Pessoa Física' or 'Pessoa Jurídica'
    code VARCHAR(50) NOT NULL, -- Sequencial gerado pelo app, ex: CLI-0001
    name VARCHAR(255) NOT NULL, -- Nome Completo / Razão Social
    document1 VARCHAR(50), -- CPF / CNPJ
    document2 VARCHAR(50), -- RG / Inscrição Estadual
    birth_date DATE, -- Para Pessoa Física
    email VARCHAR(255),
    phone VARCHAR(50),
    address_main TEXT, -- Endereço Residencial (PF)
    address_delivery TEXT, -- Endereço de Entrega
    address_billing TEXT, -- Endereço Correspondente (PJ)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS e criar policies básicas se necessário
-- ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Permitir leitura para usuários autenticados" ON customers FOR SELECT USING (auth.role() = 'authenticated');
-- CREATE POLICY "Permitir escrita para usuários autenticados" ON customers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- CREATE POLICY "Permitir atualização para usuários autenticados" ON customers FOR UPDATE USING (auth.role() = 'authenticated');
-- CREATE POLICY "Permitir deleção para usuários autenticados" ON customers FOR DELETE USING (auth.role() = 'authenticated');
