import os
from supabase import create_client

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("VITE_SUPABASE_ANON_KEY")

if not url or not key:
    print("Env vars missing")
else:
    supabase = create_client(url, key)
    response = supabase.table("machine_stops").select("*").order("start_time", desc=True).limit(5).execute()
    print("Recent stops:", response.data)
