-- Migration: Multi-Source RAG - Sync Jobs
-- Tracks synchronization jobs for external data sources

-- Table: sync_jobs
-- Records of sync job execution for monitoring and debugging
CREATE TABLE IF NOT EXISTS projectnexus.sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id UUID NOT NULL REFERENCES projectnexus.data_sources(id) ON DELETE CASCADE,

  -- Job type and trigger
  job_type TEXT NOT NULL CHECK (job_type IN ('full', 'incremental', 'webhook', 'manual')),
  trigger_type TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('scheduled', 'manual', 'webhook', 'api')),

  -- Execution status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Statistics
  documents_fetched INTEGER NOT NULL DEFAULT 0,
  documents_created INTEGER NOT NULL DEFAULT 0,
  documents_updated INTEGER NOT NULL DEFAULT 0,
  documents_deleted INTEGER NOT NULL DEFAULT 0,
  documents_failed INTEGER NOT NULL DEFAULT 0,
  chunks_created INTEGER NOT NULL DEFAULT 0,

  -- Error tracking
  error_message TEXT,
  error_count INTEGER NOT NULL DEFAULT 0,

  -- Progress tracking
  total_items INTEGER,
  processed_items INTEGER NOT NULL DEFAULT 0,
  progress_percentage INTEGER CHECK (progress_percentage BETWEEN 0 AND 100),

  -- Metadata
  triggered_by TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Cancellation
  cancelled_at TIMESTAMPTZ,
  cancelled_by TEXT
);

-- Indexes for sync_jobs
CREATE INDEX IF NOT EXISTS idx_sync_jobs_data_source ON projectnexus.sync_jobs(data_source_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON projectnexus.sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_created_at ON projectnexus.sync_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_duration ON projectnexus.sync_jobs(started_at, completed_at);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_type ON projectnexus.sync_jobs(job_type, trigger_type);

-- Index for finding running jobs
CREATE INDEX IF NOT EXISTS idx_sync_jobs_running ON projectnexus.sync_jobs(data_source_id, status)
  WHERE status = 'running';

-- Comments
COMMENT ON TABLE projectnexus.sync_jobs IS 'Sync job execution records for external data sources';
COMMENT ON COLUMN projectnexus.sync_jobs.job_type IS 'full=complete sync, incremental=since last sync, webhook=triggered by webhook, manual=user triggered';
COMMENT ON COLUMN projectnexus.sync_jobs.trigger_type IS 'scheduled=cron job, manual=user initiated, webhook=external event, api=API call';
COMMENT ON COLUMN projectnexus.sync_jobs.progress_percentage IS '0-100, based on processed_items/total_items';
COMMENT ON COLUMN projectnexus.sync_jobs.chunks_created IS 'Total number of RAG chunks created from synced documents';

-- Add helpful view for sync job monitoring
CREATE OR REPLACE VIEW projectnexus.v_sync_job_summary AS
SELECT
  sj.id,
  ds.team_slug,
  ds.name AS data_source_name,
  ds.source_type,
  sj.job_type,
  sj.trigger_type,
  sj.status,
  sj.started_at,
  sj.completed_at,
  EXTRACT(EPOCH FROM (sj.completed_at - sj.started_at)) / 60 AS duration_minutes,
  sj.documents_fetched,
  sj.documents_created,
  sj.documents_updated,
  sj.documents_deleted,
  sj.documents_failed,
  sj.chunks_created,
  sj.progress_percentage,
  sj.error_message,
  sj.triggered_by,
  sj.created_at
FROM projectnexus.sync_jobs sj
JOIN projectnexus.data_sources ds ON ds.id = sj.data_source_id
ORDER BY sj.created_at DESC;

COMMENT ON VIEW projectnexus.v_sync_job_summary IS 'Summary view of sync jobs with data source details';
