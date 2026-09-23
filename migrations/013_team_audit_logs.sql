-- Migration: Team Audit Logs
-- Tracks team actions for compliance and debugging

CREATE TABLE IF NOT EXISTS projectnexus.team_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_slug TEXT NOT NULL,
  user_email TEXT NOT NULL,
  action TEXT NOT NULL, -- 'api_key_created', 'api_key_deleted', 'cost_settings_updated', etc.
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_audit_logs_team
    FOREIGN KEY (team_slug)
    REFERENCES projectnexus.teams(slug)
    ON DELETE CASCADE
);

-- Indexes for audit logs
CREATE INDEX IF NOT EXISTS idx_team_audit_logs_team_slug ON projectnexus.team_audit_logs(team_slug);
CREATE INDEX IF NOT EXISTS idx_team_audit_logs_action ON projectnexus.team_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_team_audit_logs_created_at ON projectnexus.team_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_audit_logs_user_email ON projectnexus.team_audit_logs(user_email);

-- Comments
COMMENT ON TABLE projectnexus.team_audit_logs IS 'Audit log for team actions';
COMMENT ON COLUMN projectnexus.team_audit_logs.action IS 'Type of action performed';
COMMENT ON COLUMN projectnexus.team_audit_logs.details IS 'Additional details about the action';

-- Function to delete old audit logs (older than 90 days) - run via cron/job
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM projectnexus.team_audit_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;
