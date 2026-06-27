-- Criar a tabela de orçamentos e pedidos
CREATE TABLE public.commercial_orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_number TEXT NOT NULL,
    date DATE NOT NULL,
    salesperson TEXT,
    client_code TEXT,
    client_name TEXT,
    client_city TEXT,
    client_obs TEXT,
    price NUMERIC(15, 2) DEFAULT 0.00,
    status TEXT DEFAULT 'Orçamento Vazio',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ativar segurança em nível de linha (RLS)
ALTER TABLE public.commercial_orders ENABLE ROW LEVEL SECURITY;

-- Criar política para permitir leitura para todos os usuários autenticados
CREATE POLICY "Permitir leitura de orçamentos" 
ON public.commercial_orders FOR SELECT 
USING (true);

-- Criar política para permitir inserção
CREATE POLICY "Permitir inserção de orçamentos" 
ON public.commercial_orders FOR INSERT 
WITH CHECK (true);

-- Criar política para permitir atualização
CREATE POLICY "Permitir atualização de orçamentos" 
ON public.commercial_orders FOR UPDATE 
USING (true);

-- Criar política para permitir deleção
CREATE POLICY "Permitir deleção de orçamentos" 
ON public.commercial_orders FOR DELETE 
USING (true);

-- ATIVAR O REALTIME PARA A TABELA (Para atualizações automáticas na tela sem precisar dar F5)
ALTER PUBLICATION supabase_realtime ADD TABLE public.commercial_orders;
ALTER TABLE public.commercial_orders REPLICA IDENTITY FULL;
