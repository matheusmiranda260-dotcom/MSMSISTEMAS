import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uakwypgyajcxdvktoauc.supabase.co';
const supabaseAnonKey = 'sb_publishable_7oaV3SqtvtotqMHY6uzgWg_wQgGQY5F';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
    try {
        console.log("Testing insert into stock_gauges...");
        const testGauge = {
            id: '00000000-0000-0000-0000-000000000000', // temporary UUID
            material_type: 'Test Material',
            gauge: '10.00 mm',
            product_code: 'TEST9999',
            status: 'Ativo',
            custom_field_label: 'Tipo de Aço',
            custom_field_options: '1010,1018,1020',
            custom_field_value: '1018'
        };
        const { data, error } = await supabase.from('stock_gauges').insert(testGauge).select();
        if (error) {
            console.error("Insert failed:", error);
        } else {
            console.log("Insert successful, returned:", data);
            // Delete it immediately to clean up
            const { error: delError } = await supabase.from('stock_gauges').delete().eq('id', '00000000-0000-0000-0000-000000000000');
            if (delError) console.error("Clean up delete failed:", delError);
            else console.log("Clean up delete successful.");
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
