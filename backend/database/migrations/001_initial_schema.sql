-- ============================================
-- 社区事务闭环系统 - 初始化数据库结构
-- Version: 1.0.0  MVP
-- Date: 2026-05-12
-- ============================================

-- 1. 社区表
CREATE TABLE IF NOT EXISTS communities (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  city        VARCHAR(50) DEFAULT '',
  district    VARCHAR(50) DEFAULT '',
  address     VARCHAR(255) DEFAULT '',
  latitude    DECIMAL(10,7) DEFAULT NULL,
  longitude   DECIMAL(10,7) DEFAULT NULL,
  status      SMALLINT DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 用户表
CREATE TABLE IF NOT EXISTS users (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  openid       VARCHAR(64) NOT NULL UNIQUE,
  unionid      VARCHAR(64),
  nickname     VARCHAR(50) DEFAULT '',
  avatar_url   VARCHAR(512) DEFAULT '',
  phone        VARCHAR(20) DEFAULT '',
  role         VARCHAR(20) DEFAULT 'resident' CHECK (role IN ('resident','property','admin')),
  community_id BIGINT REFERENCES communities(id),
  building     VARCHAR(50) DEFAULT '',
  room_number  VARCHAR(20) DEFAULT '',
  status       SMALLINT DEFAULT 1,
  last_login_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_users_community ON users(community_id);

-- 3. 分类表
CREATE TABLE IF NOT EXISTS categories (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       VARCHAR(50) NOT NULL,
  icon       VARCHAR(10) DEFAULT '',
  sort_order INT DEFAULT 0,
  status     SMALLINT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO categories (name, icon, sort_order) VALUES
  ('停车占位', '🚗', 1),
  ('报修', '🔧', 2),
  ('环境卫生', '🌿', 3),
  ('失物招领', '📦', 4),
  ('宠物相关', '🐾', 5),
  ('小区通知', '📢', 6),
  ('其他', '💬', 7);

-- 4. 工单表
CREATE TABLE IF NOT EXISTS tickets (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_no       VARCHAR(32) NOT NULL UNIQUE,
  user_id         BIGINT NOT NULL REFERENCES users(id),
  community_id    BIGINT NOT NULL REFERENCES communities(id),
  category_id     BIGINT REFERENCES categories(id),
  title           VARCHAR(200) DEFAULT '',
  description     TEXT,
  images          JSONB DEFAULT '[]',
  location_desc   VARCHAR(255) DEFAULT '',
  ai_category     VARCHAR(50),
  ai_priority     VARCHAR(20) DEFAULT 'normal' CHECK (ai_priority IN ('normal','urgent')),
  ai_tags         JSONB DEFAULT '[]',
  status          VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open','processing','resolved','closed')),
  assigned_to     BIGINT REFERENCES users(id),
  resolved_at     TIMESTAMPTZ,
  resolved_by     BIGINT REFERENCES users(id),
  comment_count   INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_tickets_community_cat ON tickets(community_id, category_id, status, created_at DESC);
CREATE INDEX idx_tickets_user ON tickets(user_id, created_at DESC);

-- 5. 工单评论表
CREATE TABLE IF NOT EXISTS ticket_comments (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id  BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id    BIGINT NOT NULL REFERENCES users(id),
  content    VARCHAR(500) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_comments_ticket ON ticket_comments(ticket_id, created_at);

-- 6. 工单日志表
CREATE TABLE IF NOT EXISTS ticket_logs (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id  BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  action     VARCHAR(20) NOT NULL CHECK (action IN ('created','resolved','reopened','commented','accepted','processing')),
  user_id    BIGINT REFERENCES users(id),
  remark     VARCHAR(200) DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_logs_ticket ON ticket_logs(ticket_id);

-- 7. 通知表
CREATE TABLE IF NOT EXISTS notifications (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id),
  ticket_id  BIGINT REFERENCES tickets(id) ON DELETE SET NULL,
  type       VARCHAR(20) DEFAULT 'system' CHECK (type IN ('comment','resolved','system')),
  title      VARCHAR(200) DEFAULT '',
  content    VARCHAR(500) DEFAULT '',
  is_read    SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- 8. AI Prompt 模板表
CREATE TABLE IF NOT EXISTS ai_prompt_templates (
  id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scene                VARCHAR(50) NOT NULL,
  version              INT DEFAULT 1,
  system_prompt        TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,
  model                VARCHAR(50) DEFAULT 'deepseek-chat',
  temperature          DECIMAL(3,2) DEFAULT 0.3,
  max_tokens           INT DEFAULT 500,
  is_active            SMALLINT DEFAULT 1,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO ai_prompt_templates (scene, system_prompt, user_prompt_template) VALUES (
  'classify',
  '你是社区事务分类助手。根据用户描述判断问题类别和紧急程度。类别：停车占位/报修/环境卫生/失物招领/宠物相关/小区通知/其他。优先级：normal/urgent。',
  '用户描述：{{description}}
用户选定分类（如有）：{{category}}
请返回JSON格式：{"category":"分类","priority":"优先级","tags":["标签1","标签2"]}
只返回JSON，不要其他内容。'
);

-- 9. AI 调用日志表
CREATE TABLE IF NOT EXISTS ai_call_logs (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id         BIGINT REFERENCES tickets(id) ON DELETE SET NULL,
  scene             VARCHAR(50) NOT NULL,
  prompt_tokens     INT DEFAULT 0,
  completion_tokens INT DEFAULT 0,
  latency_ms        INT DEFAULT 0,
  model             VARCHAR(50) DEFAULT '',
  success           SMALLINT DEFAULT 1,
  error_msg         VARCHAR(500) DEFAULT '',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ai_logs_created ON ai_call_logs(created_at);

-- 10. 物业通知表（预留，MVP 不开发）
CREATE TABLE IF NOT EXISTS notices (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  community_id BIGINT NOT NULL REFERENCES communities(id),
  author_id    BIGINT NOT NULL REFERENCES users(id),
  title        VARCHAR(200) NOT NULL,
  content      TEXT,
  notice_type  VARCHAR(20) DEFAULT 'general' CHECK (notice_type IN ('general','water','power','parking','sanitation','security','other')),
  is_important SMALLINT DEFAULT 0,
  publish_at   TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notices_community ON notices(community_id, publish_at DESC);
