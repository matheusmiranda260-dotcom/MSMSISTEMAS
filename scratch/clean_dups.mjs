import fs from 'fs';
import dotenv from 'dotenv';

const envConfig = dotenv.parse(fs.readFileSync('.env'));
const SUPABASE_URL = envConfig.VITE_SUPABASE_URL;
const SUPABASE_KEY = envConfig.VITE_SUPABASE_ANON_KEY;

async function clean() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/commercial_orders?order_number=eq.001&status=eq.Aguardando+Engenharia&select=id`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        const data = await res.json();
        
        if (data.length > 1) {
            const idsToDelete = data.slice(1).map(d => d.id);
            const delRes = await fetch(`${SUPABASE_URL}/rest/v1/commercial_orders?id=in.(${idsToDelete.join(',')})`, {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            });
            console.log(`Sucesso! ${idsToDelete.length} pedidos duplicados foram apagados.`);
        } else {
            console.log('Nenhuma duplicata encontrada ou os pedidos já foram apagados.');
        }
    } catch (e) {
        console.error("Erro:", e);
    }
}

clean();
