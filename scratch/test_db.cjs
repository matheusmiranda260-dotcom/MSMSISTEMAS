const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uakwypgyajcxdvktoauc.supabase.co';
const supabaseAnonKey = 'sb_publishable_7oaV3SqtvtotqMHY6uzgWg_wQgGQY5F';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
    try {
        console.log("Fetching stock_items...");
        const { data: items, error } = await supabase
            .from('stock_items')
            .select('id, internal_lot, material_type, bitola, remaining_quantity, status');
        if (error) throw error;
        console.log("Stock items count:", items.length);
        console.log("All Stock items:", items);
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
