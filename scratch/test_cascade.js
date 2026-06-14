import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uakwypgyajcxdvktoauc.supabase.co';
const supabaseAnonKey = 'sb_publishable_7oaV3SqtvtotqMHY6uzgWg_wQgGQY5F';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
    try {
        console.log("1. Fetching raw material CA-60 to use as component...");
        const { data: rawGauges, error: rawError } = await supabase
            .from('stock_gauges')
            .select('*')
            .eq('material_type', 'rolo-ca60');
            
        if (rawError || !rawGauges || rawGauges.length === 0) {
            console.error("Could not find CA-60:", rawError);
            return;
        }
        
        const rawMaterial = rawGauges[0];
        console.log("Found raw material:", rawMaterial.id);

        console.log("2. Inserting temporary compound product...");
        const { data: parent, error: pError } = await supabase
            .from('stock_gauges')
            .insert({
                material_type: 'Treliça Teste',
                gauge: 'H8 Teste',
                item_type: 'produto_composto',
                product_code: '9999'
            })
            .select()
            .single();

        if (pError) {
            console.error("Error inserting parent gauge:", pError);
            return;
        }

        console.log("Inserted parent gauge ID:", parent.id);

        console.log("3. Inserting component in gauge_components...");
        const { data: component, error: cError } = await supabase
            .from('gauge_components')
            .insert({
                parent_gauge_id: parent.id,
                component_gauge_id: rawMaterial.id,
                funcao: 'Teste',
                consumption: 2.5
            })
            .select()
            .single();

        if (cError) {
            console.error("Error inserting component:", cError);
            // Clean up parent
            await supabase.from('stock_gauges').delete().eq('id', parent.id);
            return;
        }

        console.log("Inserted component successfully:", component.id);

        console.log("4. Attempting to delete the compound product (parent)...");
        const { error: dError } = await supabase
            .from('stock_gauges')
            .delete()
            .eq('id', parent.id);

        if (dError) {
            console.error("❌ DELETE FAILED:", dError);
        } else {
            console.log("✅ DELETE SUCCEEDED! The parent and its component were successfully removed.");
        }
    } catch (e) {
        console.error("Error in test script:", e);
    }
}

run();
