#!/bin/sh
set -e

echo "🚀 Nexus Mail Starting..."

# 确保数据目录存在且可写
DATA_DIR="/app/data"
DB_FILE="$DATA_DIR/dev.db"
TAGS_FILE="$DATA_DIR/tags.json"

# 检查数据库是否需要初始化
if [ ! -s "$DB_FILE" ]; then
    echo "📦 Initializing database..."
    
    # 使用 SQLite 直接创建表结构
    sqlite3 "$DB_FILE" << 'EOSQL'
-- Account table
CREATE TABLE IF NOT EXISTS "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "tag" TEXT,
    "host" TEXT NOT NULL DEFAULT 'localhost',
    "port" INTEGER NOT NULL DEFAULT 993,
    "smtpPort" INTEGER NOT NULL DEFAULT 587,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Account_email_key" ON "Account"("email");

-- Email table
CREATE TABLE IF NOT EXISTS "Email" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "uid" INTEGER NOT NULL,
    "providerKey" TEXT NOT NULL,
    "subject" TEXT,
    "from" TEXT,
    "to" TEXT,
    "date" DATETIME NOT NULL,
    "flags" TEXT,
    "content" TEXT,
    "folder" TEXT NOT NULL DEFAULT 'INBOX',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "localStatus" TEXT NOT NULL DEFAULT 'NORMAL',
    CONSTRAINT "Email_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Email_accountId_providerKey_key" ON "Email"("accountId", "providerKey");
CREATE INDEX IF NOT EXISTS "Email_date_idx" ON "Email"("date");
CREATE INDEX IF NOT EXISTS "Email_folder_idx" ON "Email"("folder");
CREATE INDEX IF NOT EXISTS "Email_archived_idx" ON "Email"("archived");

-- Draft table
CREATE TABLE IF NOT EXISTS "Draft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "to" TEXT,
    "cc" TEXT,
    "bcc" TEXT,
    "subject" TEXT,
    "textBody" TEXT,
    "htmlBody" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SAVED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Draft_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
EOSQL
    
    echo "✅ Database initialized"
fi

# 确保 tags.json 存在
if [ ! -f "$TAGS_FILE" ]; then
    echo "📝 Creating default tags.json..."
    cat > "$TAGS_FILE" << 'EOJSON'
[
  {"id": "vip", "label": "VIP", "color": "#8b5cf6"},
  {"id": "important", "label": "重要", "color": "#ef4444"},
  {"id": "normal", "label": "普通", "color": "#9ca3af"}
]
EOJSON
    echo "✅ tags.json created"
fi

echo "✨ Initialization complete, starting server..."

# 执行传入的命令（node server.js）
exec "$@"
