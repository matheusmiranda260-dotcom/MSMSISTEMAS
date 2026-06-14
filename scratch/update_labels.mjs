import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uakwypgyajcxdvktoauc.supabase.co';
const supabaseAnonKey = 'sb_publishable_7oaV3SqtvtotqMHY6uzgWg_wQgGQY5F';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runUpdate() {
    try {
        console.log("Fetching gauges from supabase...");
        const { data: gauges, error: fetchErr } = await supabase
            .from('stock_gauges')
            .select('id, custom_field_label');

        if (fetchErr) {
            console.error("Fetch error:", fetchErr);
            return;
        }

        console.log(`Found ${gauges?.length || 0} gauges in database.`);
        let updateCount = 0;

        for (const g of (gauges || [])) {
            if (g.custom_field_label === 'Tipo de Aço' || g.custom_field_label === 'Tipo Aço') {
                console.log(`Updating gauge ID ${g.id} label from "${g.custom_field_label}" to "Especificações"...`);
                const { error: updateErr } = await supabase
                    .from('stock_gauges')
                    .update({ custom_field_label: 'Especificações' })
                    .eq('id', g.id);

                if (updateErr) {
                    console.error(`Error updating gauge ${g.id}:`, updateErr);
                } else {
                    updateCount++;
                }
            }
        }

        console.log(`Database update complete! Updated ${updateCount} records.`);
    } catch (e) {
        console.error("Error during execution:", e);
    }
}

runUpdate();
