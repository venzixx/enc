import sqlite3
import os

db_files = [
    'app/prisma/dev.db',
    'app/prisma/latest_inspect.db'
]

guild_id = '1493521070584500354'

for db_file in db_files:
    if not os.path.exists(db_file): continue
    print(f"--- {db_file} ---")
    try:
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM AuditLog WHERE guildId = ?", (guild_id,))
        logs = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM Member WHERE guildId = ?", (guild_id,))
        members = cursor.fetchone()[0]
        print(f"  Logs: {logs}, Members: {members}")
        conn.close()
    except Exception as e:
        print(f"  Error: {e}")
