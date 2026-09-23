-- Migration: AI Usage Tracking
-- Tracks AI model usage, costs, and analytics

-- Table: ai_usage_logs
-- Logs all AI API calls for cost tracking and analytics
CREATE TABLE IF NOT EXISTS projectnexus.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_slug TEXT NOT NULL,
  user_email TEXT NOT NULL,
  conversation_id UUID,
  message_id UUID,

  -- AI Model Info
  provider TEXT NOT NULL, -- 'openai', 'anthropic', 'gemini', 'mistral'
  model TEXT NOT NULL, -- 'gpt-4o', 'claude-3-5-sonnet-20241022', etc.

  -- Request/Response Details
  request_tokens INTEGER NOT NULL DEFAULT 0,
  response_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,

  -- Cost Calculation (in USD)
  input_cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  output_cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  total_cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,

  -- Features Used
  features_used TEXT[] NOT NULL DEFAULT '{}', -- ['streaming', 'reasoning', 'vision', 'rag', 'web_search']

  -- Performance Metrics
  response_time_ms INTEGER,
  time_to_first_token_ms INTEGER,
  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_ai_usage_logs_team
    FOREIGN KEY (team_slug)
    REFERENCES projectnexus.teams(slug)
    ON DELETE CASCADE
);

-- Indexes for ai_usage_logs
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_team_slug ON projectnexus.ai_usage_logs(team_slug);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_email ON projectnexus.ai_usage_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_conversation_id ON projectnexus.ai_usage_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_provider_model ON projectnexus.ai_usage_logs(provider, model);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON projectnexus.ai_usage_logs(created_at DESC);

-- Table: ai_cost_settings
-- Stores pricing tiers and budget alerts per team
CREATE TABLE IF NOT EXISTS projectnexus.ai_cost_settings (
  team_slug TEXT PRIMARY KEY,

  -- Budget Configuration
  monthly_budget_usd NUMERIC(10, 2), -- Optional monthly budget
  alert_threshold_percentage INTEGER DEFAULT 80, -- Alert at 80% of budget
  current_monthly_spend_usd NUMERIC(10, 2) NOT NULL DEFAULT 0,
  current_month_start_date DATE DEFAULT DATE_TRUNC('month', CURRENT_DATE),

  -- Cost Per Model Override (optional, allows custom pricing)
  model_pricing JSONB DEFAULT '{}', -- { "gpt-4o": { "input": 0.005, "output": 0.015 } }

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_ai_cost_settings_team
    FOREIGN KEY (team_slug)
    REFERENCES projectnexus.teams(slug)
    ON DELETE CASCADE
);

-- Index for cost settings
CREATE INDEX IF NOT EXISTS idx_ai_cost_settings_team_slug ON projectnexus.ai_cost_settings(team_slug);

-- Table: ai_budget_alerts
-- Stores budget alert history
CREATE TABLE IF NOT EXISTS projectnexus.ai_budget_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_slug TEXT NOT NULL,
  alert_type TEXT NOT NULL, -- 'threshold_reached', 'budget_exceeded', 'custom'
  percentage_used INTEGER,
  monthly_spend_usd NUMERIC(10, 2),
  budget_usd NUMERIC(10, 2),
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_ai_budget_alerts_team
    FOREIGN KEY (team_slug)
    REFERENCES projectnexus.teams(slug)
    ON DELETE CASCADE
);

-- Indexes for budget alerts
CREATE INDEX IF NOT EXISTS idx_ai_budget_alerts_team_slug ON projectnexus.ai_budget_alerts(team_slug);
CREATE INDEX IF NOT EXISTS idx_ai_budget_alerts_created_at ON projectnexus.ai_budget_alerts(created_at DESC);

-- Comments
COMMENT ON TABLE projectnexus.ai_usage_logs IS 'Logs all AI API calls for cost tracking and analytics';
COMMENT ON TABLE projectnexus.ai_cost_settings IS 'Stores pricing tiers and budget alerts per team';
COMMENT ON TABLE projectnexus.ai_budget_alerts IS 'Stores budget alert history';
COMMENT ON COLUMN projectnexus.ai_usage_logs.total_cost_usd IS 'Total cost in USD for this request';
COMMENT ON COLUMN projectnexus.ai_cost_settings.monthly_budget_usd IS 'Optional monthly budget limit';
COMMENT ON COLUMN projectnexus.ai_cost_settings.alert_threshold_percentage IS 'Send alert when spending reaches X% of budget';

-- Function to reset monthly spend (run via cron/job on 1st of each month)
CREATE OR REPLACE FUNCTION reset_monthly_ai_spend()
RETURNS void AS $$
BEGIN
  UPDATE projectnexus.ai_cost_settings
  SET
    current_monthly_spend_usd = 0,
    current_month_start_date = DATE_TRUNC('month', CURRENT_DATE),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_ai_cost_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ai_cost_settings_updated_at
  BEFORE UPDATE ON projectnexus.ai_cost_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_cost_settings_updated_at();

-- Default pricing data (as of 2025)
-- OpenAI: GPT-4o ($0.005/1M input, $0.015/1K output), GPT-4o-mini ($0.00015/1M input, $0.0006/1K output)
-- Anthropic: Claude 3.5 Sonnet ($0.003/1M input, $0.015/1K output), Claude 3 Haiku ($0.00025/1M input, $0.00125/1K output)
-- Gemini: Gemini 1.5 Pro ($0.00125/1M input, $0.005/1K output)
