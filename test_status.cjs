const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://uakwypgyajcxdvktoauc.supabase.co';
const supabaseAnonKey = 'sb_publishable_7oaV3SqtvtotqMHY6uzgWg_wQgGQY5F';
const supabase = createClient(supabaseUrl, supabaseAnonKey);
async function run() {
  const { data: poList } = await supabase.from('production_orders').select('id, status').limit(1);
  if (poList && poList.length > 0) {
      const po = poList[0];
      const { data, error } = await supabase.from('production_orders').update({
          status: 'producing'
      }).eq('id', po.id);
      
      console.log("UPDATE STATUS ERROR:", error);
  }
}
run();
