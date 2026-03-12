"""
Migration script to add new columns to existing database
"""

from app import create_app
from extensions import db
import sqlite3
import os

def migrate():
    app = create_app()
    db_path = os.path.join(os.path.dirname(__file__), 'instance', 'synapselink.db')
    
    if not os.path.exists(db_path):
        print("Database doesn't exist. Run init_db.py instead.")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check if columns exist
    cursor.execute("PRAGMA table_info(users)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if 'is_blocked' not in columns:
        cursor.execute("ALTER TABLE users ADD COLUMN is_blocked BOOLEAN DEFAULT 0")
        print("Added is_blocked column")
    
    if 'blocked_reason' not in columns:
        cursor.execute("ALTER TABLE users ADD COLUMN blocked_reason VARCHAR(255)")
        print("Added blocked_reason column")
    
    if 'blocked_at' not in columns:
        cursor.execute("ALTER TABLE users ADD COLUMN blocked_at DATETIME")
        print("Added blocked_at column")
    
    conn.commit()
    conn.close()
    print("Migration completed successfully!")

if __name__ == '__main__':
    migrate()
