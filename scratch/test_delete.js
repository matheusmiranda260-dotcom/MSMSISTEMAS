import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uakwypgyajcxdvktoauc.supabase.co';
const supabaseAnonKey = 'sb_publishable_7oaV3SqtvtotqMHY6uzgWg_wQgGQY5F';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
    console.log("Fetching all stock_gauges...");
    const { data: gauges, error: gError } = await supabase
        .from('stock_gauges')
        .select('*');

    if (gError) {
        console.error("Error fetching gauges:", gError);
        return;
    }

    console.log(`Found ${gauges.length} gauges.`);
    console.log("All gauges:", gauges);
}

run();
