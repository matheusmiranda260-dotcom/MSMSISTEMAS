-- Atualiza os status antigos para os novos formatos
UPDATE machine_maintenance SET status = 'Planejada' WHERE status = 'Pendente';
UPDATE machine_maintenance SET status = 'Encerrada' WHERE status = 'Concluída';
-- 'Em Andamento' não mudou, então não precisa alterar.
