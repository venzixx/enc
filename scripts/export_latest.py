import sqlite3
import json
import os

db_file = 'app/prisma/latest_inspect.db'
output_file = 'app/prisma/latest_data.json'

tables = [
    'Guild', 'Member', 'AuditLog', 'AntiNukeConfig', 'AutoModFilter', 'CommandAlias'
]

data = {}

conn = sqlite3.connect(db_file)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

for table in tables:
    try:
        cursor.execute(f"SELECT * FROM {table}")
        rows = [dict(row) for row in cursor.fetchall()]
        data[table] = rows
        print(f"Exported {len(rows)} from {table}")
    except:
        print(f"Table {table} not found")

with open(output_file, 'w') as f:
    json.dump(data, f)

conn.close()
print(f"Data saved to {output_file}")
