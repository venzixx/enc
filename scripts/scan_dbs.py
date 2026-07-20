import sqlite3
import os

db_files = [
    'app/prisma/dev.db',
    'app/prisma/dev.db.bak',
    'app/prisma/dev.db.new_bak',
    'app/prisma/inspect_old.db',
    'app/prisma/latest_inspect.db'
]

tables = [
    'Guild', 'Member', 'AuditLog', 'AntiNukeConfig', 'AutoModFilter', 'CommandAlias'
]

for db_file in db_files:
    if not os.path.exists(db_file):
        print(f"--- {db_file}: File not found ---")
        continue
    print(f"--- Scanning {db_file} ---")
    try:
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()
        for table in tables:
            try:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                count = cursor.fetchone()[0]
                print(f"  {table}: {count}")
            except:
                print(f"  {table}: Not found")
        conn.close()
    except Exception as e:
        print(f"  Error: {e}")
