-- Support Inquiries Table
CREATE TABLE IF NOT EXISTS support_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'unread', -- 'unread', 'read_unhandled', 'handled'
  reply_message TEXT,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_inquiries_user_id ON support_inquiries(user_id);
CREATE INDEX IF NOT EXISTS idx_support_inquiries_status ON support_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_support_inquiries_created_at ON support_inquiries(created_at DESC);
