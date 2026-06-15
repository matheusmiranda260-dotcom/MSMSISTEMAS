const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uakwypgyajcxdvktoauc.supabase.co';
const supabaseAnonKey = 'sb_publishable_7oaV3SqtvtotqMHY6uzgWg_wQgGQY5F';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkPartners() {
    try {
        const { data, error } = await supabase.from('partners').select('*');
        if (error) throw error;
        console.log("Partners list:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error checking partners:", e);
    }
}

checkPartners();
