const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://uakwypgyajcxdvktoauc.supabase.co';
const supabaseAnonKey = 'sb_publishable_7oaV3SqtvtotqMHY6uzgWg_wQgGQY5F';
const supabase = createClient(supabaseUrl, supabaseAnonKey);
async function run() {
  const osId = 'a1bd1ba2-6a69-42b7-bd20-0d19f3900994'; // Não sabemos o id, mas vou puxar o pedido 0000002 que foi testado
  const { data: poList } = await supabase.from('production_orders').select('*').limit(1);
  if (poList && poList.length > 0) {
      const po = poList[0];
      const testProgress = po.sub_items_progress || {};
      testProgress['TEST_KEY'] = { status: 'producing', start_time: new Date().toISOString() };
      
      const { data, error } = await supabase.from('production_orders').update({
          sub_items_progress: testProgress
      }).eq('id', po.id);
      
      console.log("UPDATE ERROR:", error);
      console.log("UPDATE SUCCESS:", data);
  }
}
run();
