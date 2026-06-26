-- Ativar o Realtime (Atualização Automática) para a tabela de clientes
ALTER PUBLICATION supabase_realtime ADD TABLE customers;

-- Garantir que quando um cliente for deletado, o realtime consiga enviar os dados completos dele para a tela de quem estiver usando
ALTER TABLE customers REPLICA IDENTITY FULL;
