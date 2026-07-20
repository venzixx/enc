import sqlite3
import os

db_files = [
    'app/prisma/dev.db',
    'app/prisma/latest_inspect.db'
]

for db_file in db_files:
    if not os.path.exists(db_file): continue
    print(f"--- {db_file} ---")
    try:
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM Guild")
        ids = [r[0] for r in cursor.fetchall()]
        print(f"  Guild IDs: {ids}")
        conn.close()
    except:
        print(f"  Error reading Guilds")
