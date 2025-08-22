-- Migration: 001_add_support_chat_system.sql
-- Description: Adds support ticket and messaging system for Company Admin <-> Super Admin communication
-- Date: 2025-08-22
-- Dependencies: Requires existing companies and profiles tables

-- =============================================================================
-- SUPPORT CHAT SYSTEM MIGRATION
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. CREATE SUPPORT TICKETS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  created_by UUID REFERENCES profiles(id) NOT NULL, -- Company admin who created ticket
  assigned_to UUID REFERENCES profiles(id), -- Super admin handling the ticket
  
  -- Ticket Details
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT CHECK (priority IN ('low', 'normal', 'high', 'urgent')) DEFAULT 'normal',
  status TEXT CHECK (status IN ('open', 'in_progress', 'waiting_for_customer', 'resolved', 'closed')) DEFAULT 'open',
  category TEXT CHECK (category IN ('technical', 'billing', 'feature_request', 'bug_report', 'general')) DEFAULT 'general',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  
  -- Metadata
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_by UUID REFERENCES profiles(id)
);

-- -----------------------------------------------------------------------------
-- 2. CREATE SUPPORT MESSAGES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  
  -- Message Content
  message TEXT NOT NULL,
  message_type TEXT CHECK (message_type IN ('message', 'note', 'status_change', 'assignment')) DEFAULT 'message',
  
  -- File Attachments (for future enhancement)
  attachment_url TEXT,
  attachment_filename TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Read Status (for unread indicators)
  read_by_customer BOOLEAN DEFAULT false,
  read_by_support BOOLEAN DEFAULT false
);

-- -----------------------------------------------------------------------------
-- 3. CREATE PERFORMANCE INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_support_tickets_company_id ON support_tickets(company_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_last_message_at ON support_tickets(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_id ON support_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON support_messages(created_at DESC);

-- -----------------------------------------------------------------------------
-- 4. ENABLE ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 5. CREATE RLS POLICIES
-- -----------------------------------------------------------------------------

-- Support Tickets - Company users can see their company's tickets
CREATE POLICY "support_tickets_company_access" ON support_tickets
FOR ALL USING (
  company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin', 'user')
);

-- Support Tickets - Super admins can see all tickets
CREATE POLICY "support_tickets_admin_access" ON support_tickets
FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
);

-- Support Messages - Company users can see messages from their tickets
CREATE POLICY "support_messages_company_access" ON support_messages
FOR ALL USING (
  ticket_id IN (
    SELECT id FROM support_tickets 
    WHERE company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
  )
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin', 'user')
);

-- Support Messages - Super admins can see all messages
CREATE POLICY "support_messages_admin_access" ON support_messages
FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
);

-- -----------------------------------------------------------------------------
-- 6. CREATE TRIGGER FUNCTIONS
-- -----------------------------------------------------------------------------

-- Update ticket's last_message_at when new message is added
CREATE OR REPLACE FUNCTION update_ticket_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE support_tickets 
  SET 
    last_message_at = NEW.created_at,
    last_message_by = NEW.user_id,
    updated_at = NOW()
  WHERE id = NEW.ticket_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Mark messages as read based on sender role
CREATE OR REPLACE FUNCTION mark_message_read()
RETURNS TRIGGER AS $$
DECLARE
  sender_role TEXT;
BEGIN
  -- Get the role of the message sender
  SELECT role INTO sender_role FROM profiles WHERE id = NEW.user_id;
  
  -- If sent by super admin, mark as read by support
  -- If sent by company user, mark as read by customer
  IF sender_role = 'super_admin' THEN
    NEW.read_by_support = true;
  ELSE
    NEW.read_by_customer = true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 7. CREATE TRIGGERS
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_ticket_last_message_trigger ON support_messages;
CREATE TRIGGER update_ticket_last_message_trigger
  AFTER INSERT ON support_messages
  FOR EACH ROW EXECUTE FUNCTION update_ticket_last_message();

DROP TRIGGER IF EXISTS mark_message_read_trigger ON support_messages;
CREATE TRIGGER mark_message_read_trigger
  BEFORE INSERT ON support_messages
  FOR EACH ROW EXECUTE FUNCTION mark_message_read();

-- -----------------------------------------------------------------------------
-- 8. CREATE HELPER FUNCTIONS
-- -----------------------------------------------------------------------------

-- Get unread ticket count for a company
CREATE OR REPLACE FUNCTION get_unread_ticket_count(p_company_id UUID)
RETURNS INTEGER AS $$
DECLARE
  unread_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO unread_count
  FROM support_tickets st
  WHERE st.company_id = p_company_id
    AND st.status IN ('open', 'in_progress', 'waiting_for_customer')
    AND EXISTS (
      SELECT 1 FROM support_messages sm
      WHERE sm.ticket_id = st.id
        AND sm.read_by_customer = false
        AND sm.user_id != (SELECT id FROM profiles WHERE company_id = p_company_id AND role = 'company_admin' LIMIT 1)
    );
  
  RETURN COALESCE(unread_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get unread ticket count for super admin
CREATE OR REPLACE FUNCTION get_unread_tickets_for_admin()
RETURNS INTEGER AS $$
DECLARE
  unread_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO unread_count
  FROM support_tickets st
  WHERE st.status IN ('open', 'in_progress')
    AND EXISTS (
      SELECT 1 FROM support_messages sm
      WHERE sm.ticket_id = st.id
        AND sm.read_by_support = false
        AND sm.user_id NOT IN (SELECT id FROM profiles WHERE role = 'super_admin')
    );
  
  RETURN COALESCE(unread_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark all messages in a ticket as read by current user
CREATE OR REPLACE FUNCTION mark_ticket_messages_read(p_ticket_id UUID)
RETURNS VOID AS $$
DECLARE
  current_user_role TEXT;
BEGIN
  -- Get current user's role
  SELECT role INTO current_user_role FROM profiles WHERE id = auth.uid();
  
  -- Update read status based on role
  IF current_user_role = 'super_admin' THEN
    UPDATE support_messages 
    SET read_by_support = true 
    WHERE ticket_id = p_ticket_id AND read_by_support = false;
  ELSE
    UPDATE support_messages 
    SET read_by_customer = true 
    WHERE ticket_id = p_ticket_id AND read_by_customer = false;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 9. GRANT PERMISSIONS (if needed)
-- -----------------------------------------------------------------------------
-- These are handled by RLS policies, but included for completeness
-- GRANT ALL ON support_tickets TO authenticated;
-- GRANT ALL ON support_messages TO authenticated;

COMMIT;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- To verify the migration worked correctly, run these queries:
-- SELECT * FROM support_tickets LIMIT 1;
-- SELECT * FROM support_messages LIMIT 1;
-- SELECT get_unread_ticket_count('your-company-id');
-- SELECT get_unread_tickets_for_admin();