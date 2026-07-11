-- =====================================================================
-- SCRIPT DE MANUTENÇÃO E LIMPEZA DE ESPAÇO (SUPABASE)
-- =====================================================================
-- Rode este script mensalmente no SQL Editor do Supabase para limpar
-- registros antigos e liberar espaço no banco de dados.

-- 1. Limpar Logs de Acesso (Login/Logout) mais antigos que 60 dias
DELETE FROM public.user_access_logs
WHERE created_at < NOW() - INTERVAL '60 days';

-- 2. (Opcional) Limpar Paradas de Máquina muito antigas (mais de 6 meses)
-- Descomente a linha abaixo se quiser limpar o histórico de paradas antigas
-- DELETE FROM public.machine_stops WHERE created_at < NOW() - INTERVAL '180 days';

-- 3. (Opcional) Limpar logs de sistema gerais se houver tabela de log

-- Nota: O Supabase vai limpar fisicamente o disco após o comando Vacuum.
-- O comando abaixo força a liberação de espaço no disco do PostgreSQL.
VACUUM (ANALYZE) public.user_access_logs;
