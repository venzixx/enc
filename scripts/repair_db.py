import sqlite3
import os

db_file = 'app/prisma/dev.db.new_bak'
if not os.path.exists(db_file):
    print("File not found")
    exit()

try:
    # Try to open in read-only mode and see if we can get anything
    conn = sqlite3.connect(f"file:{db_file}?mode=ro", uri=True)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in cursor.fetchall()]
    print("Tables found in malformed DB:", tables)
    
    for table in tables:
        try:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            print(f"  {table}: {cursor.fetchone()[0]}")
        except Exception as e:
            print(f"  {table}: Error {e}")
    conn.close()
except Exception as e:
    print(f"Global Error: {e}")
