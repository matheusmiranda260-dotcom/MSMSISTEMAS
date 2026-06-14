const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uakwypgyajcxdvktoauc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_7oaV3SqtvtotqMHY6uzgWg_wQgGQY5F'; // Let's check fallback

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
    try {
        console.log("Fetching stock_gauges...");
        const { data: gauges, error: gError } = await supabase.from('stock_gauges').select('*');
        if (gError) throw gError;
        console.log("Gauges count:", gauges.length);
        console.log("Gauges sample:", gauges.map(g => ({ id: g.id, material_type: g.material_type, gauge: g.gauge, item_type: g.item_type })));

        console.log("\nFetching gauge_components...");
        const { data: comps, error: cError } = await supabase.from('gauge_components').select('*');
        if (cError) throw cError;
        console.log("Components count:", comps.length);
        console.log("Components:", comps);
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
