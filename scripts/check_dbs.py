import sqlite3
import os

db_files = [
    'app/prisma/dev.db',
    'app/prisma/dev.db.bak',
    'app/prisma/dev.db.new_bak',
    'app/prisma/inspect_old.db',
    'app/prisma/latest_inspect.db'
]

for db_file in db_files:
    if not os.path.exists(db_file):
        print(f"{db_file}: File not found")
        continue
    try:
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='AuditLog'")
        if cursor.fetchone():
            cursor.execute("SELECT COUNT(*) FROM AuditLog")
            count = cursor.fetchone()[0]
            cursor.execute("SELECT MIN(createdAt), MAX(createdAt) FROM AuditLog")
            dates = cursor.fetchone()
            print(f"{db_file}: AuditLog count = {count}, Range: {dates[0]} to {dates[1]}")
        else:
            print(f"{db_file}: Table AuditLog not found")
        conn.close()
    except Exception as e:
        print(f"{db_file}: Error {e}")
