import os

groups = [
    # 1. Tabelas Base (Sem dependências complexas)
    [
        "setup_users_table.sql",
        "setup_people_management.sql",
        "setup_org_chart.sql",
        "setup_hr_expansion.sql",
        "setup_documents.sql",
        "supabase_spare_parts.sql",
        "supabase_instructions.sql",
        "supabase_kaizen.sql",
        "create_documents_table.sql",
        "create_general_documents.sql"
    ],
    # 2. Tabelas Relacionais (Dependem das tabelas base)
    [
        "create_access_logs_table.sql",
        "create_technical_evaluations.sql",
        "supabase_migration_stock_gauges.sql",
        "supabase_migration_inventory_applied.sql",
        "supabase_add_stock_location.sql",
        "supabase_storage_bucket.sql",
        "supabase_spare_parts_v2.sql",
        "supabase_production_orders_schema.sql",
        "create_daily_reports_table.sql"
    ],
    # 3. Alterações e Fixes Finais
    [
        "fix_delete_cascade.sql",
        "MASTER_FIX_DATABASE.sql",
        "fix_tables_and_rls.sql",
        "fix_updated_at_column.sql",
        "fix_bugged_stock_items.sql",
        "fix_people_management_permissions.sql",
        "fix_rls_for_realtime.sql",
        "fix_storage_policies.sql",
        "activate_realtime.sql",
        "add_absence_attachment.sql",
        "add_conferral_and_op_columns.sql",
        "add_last_quantity_update_column.sql",
        "add_pending_transfer_column.sql",
        "add_product_code_to_gauges.sql",
        "link_users_employees.sql",
        "FIX_DESBOBINADEIRA_FINAL.sql"
    ]
]

with open('SETUP_MSMSISTEMAS_FINAL.sql', 'w', encoding='utf-8') as outfile:
    outfile.write("-- SCRIPT GERADO AUTOMATICAMENTE PARA O NOVO BANCO MSMSISTEMAS (ENXUTO) --\n\n")
    
    for i, group in enumerate(groups):
        outfile.write(f"\n\n-- ======================================\n")
        outfile.write(f"-- GRUPO {i+1}\n")
        outfile.write(f"-- ======================================\n\n")
        for filename in group:
            if os.path.exists(filename):
                with open(filename, 'r', encoding='utf-8') as infile:
                    outfile.write(f"-- Arquivo: {filename}\n")
                    outfile.write(infile.read())
                    outfile.write("\n\n")
            else:
                print(f"Warning: {filename} not found.")

print("Arquivo SETUP_MSMSISTEMAS_FINAL.sql gerado com sucesso!")
