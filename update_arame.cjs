const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uakwypgyajcxdvktoauc.supabase.co';
const supabaseAnonKey = 'sb_publishable_7oaV3Sqtv চ্যালেঞ্জ';

const supabase = createClient(supabaseUrl, 'sb_publishable_7oaV3SqtvtotqMHY6uzgWg_wQgGQY5F');

async function checkGauges() {
    const { data, error } = await supabase
        .from('stock_gauges')
        .select('*');
    
    if (error) {
        console.error(error);
        return;
    }
    
    console.log(data.map(g => ({ id: g.id, name: g.commercial_name, type: g.material_type, weight: g.raw_weight_value, price: g.purchase_price })));

    const arame = data.find(g => (g.commercial_name || g.material_type || '').toUpperCase().includes('ARAME'));
    if (arame) {
        console.log("Found arame:", arame);
        const { data: updated, error: updateError } = await supabase
            .from('stock_gauges')
            .update({
                raw_weight_value: 1,
                purchase_price: 25.00
            })
            .eq('id', arame.id)
            .select();
        console.log("Updated:", updated, updateError);
    }
}

checkGauges();
