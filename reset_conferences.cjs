const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uakwypgyajcxdvktoauc.supabase.co';
const supabaseAnonKey = 'sb_publishable_7oaV3SqtvtotqMHY6uzgWg_wQgGQY5F';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
    console.log('Resetting conferences and stock_items...');

    // Get all conferences
    const { data: conferences, error: confError } = await supabase.from('conferences').select('conference_number');
    
    if (confError) {
        console.error('Error fetching conferences:', confError);
        return;
    }

    if (conferences && conferences.length > 0) {
        const confNumbers = conferences.map(c => c.conference_number);
        console.log(`Deleting ${conferences.length} conferences...`);

        // Usually RLS and CASCADE take care of children, but just in case, we also delete stock_items related
        for (const c of conferences) {
            // Delete from stock_items first
            await supabase.from('stock_items').delete().eq('conference_number', c.conference_number);
            
            // Delete conference
            const { error: delError } = await supabase.from('conferences').delete().eq('conference_number', c.conference_number);
            if (delError) {
                console.error(`Error deleting conference ${c.conference_number}:`, delError);
            }
        }
        
        console.log('Conferences reset successfully.');
    } else {
        console.log('No conferences found to delete.');
    }
}

run();
