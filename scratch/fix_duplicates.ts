import { supabase } from '../services/supabaseService';

async function fixDuplicates() {
    console.log("Buscando pedidos duplicados do Cadastro Rápido (orderNumber = '001')...");
    
    // Busca todos os pedidos com orderNumber 001 criados via Cadastro Rápido (status Aguardando Engenharia)
    const { data, error } = await supabase
        .from('commercial_orders')
        .select('id, created_at, client_name')
        .eq('order_number', '001')
        .eq('status', 'Aguardando Engenharia')
        .order('created_at', { ascending: true });
        
    if (error) {
        console.error("Erro ao buscar:", error);
        return;
    }

    if (!data || data.length <= 1) {
        console.log("Não há duplicatas para resolver. Encontrados:", data?.length);
        return;
    }

    console.log(`Encontrados ${data.length} pedidos. Mantendo o primeiro e deletando os ${data.length - 1} restantes...`);
    
    // O primeiro é o original, os outros são duplicatas
    const idsToDelete = data.slice(1).map(d => d.id);
    
    if (idsToDelete.length > 0) {
        const { error: deleteError } = await supabase
            .from('commercial_orders')
            .delete()
            .in('id', idsToDelete);
            
        if (deleteError) {
            console.error("Erro ao deletar:", deleteError);
        } else {
            console.log(`Sucesso! ${idsToDelete.length} duplicatas foram removidas.`);
        }
    }
}

fixDuplicates();
