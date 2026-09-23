/**
 * Sync Scheduler
 * Manages scheduled synchronization jobs using cron patterns
 *
 * Features:
 * - Cron-based scheduling
 * - Dynamic job management
 * - Manual trigger support
 * - Error handling and retry
 * - Next sync calculation
 */

import { pool } from '../db';

export interface ScheduledJob {
  id: string;
  dataSourceId: string;
  cronExpression: string;
  enabled: boolean;
  lastRun?: Date;
  nextRun: Date;
  jobType: 'full' | 'incremental' | 'webhook' | 'manual';
}

export interface ScheduleResult {
  success: boolean;
  jobId?: string;
  nextRun?: Date;
  error?: string;
}

// In-memory task storage (in production, use persistent storage)
const scheduledTasks = new Map<string, {
  task: any;
  interval: NodeJS.Timeout;
  dataSourceId: string;
}>();

/**
 * Get cron expression from sync frequency
 */
export function getCronExpression(frequency: string): string {
  switch (frequency) {
    case 'hourly':
      return '0 * * * *'; // Every hour at minute 0
    case 'daily':
      return '0 2 * * *'; // Every day at 2 AM
    case 'weekly':
      return '0 2 * * 0'; // Every Sunday at 2 AM
    case 'monthly':
      return '0 2 1 * *'; // Every month on the 1st at 2 AM
    case 'every_6_hours':
      return '0 */6 * * *'; // Every 6 hours
    case 'every_12_hours':
      return '0 */12 * * *'; // Every 12 hours
    case 'manual':
      throw new Error('Manual sync cannot be scheduled');
    default:
      throw new Error(`Unknown frequency: ${frequency}`);
  }
}

/**
 * Get human-readable description of cron expression
 */
export function describeCronExpression(cronExpression: string): string {
  const [minute, hour, dayOfMonth, month, dayOfWeek] = cronExpression.split(' ');

  if (minute === '0' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return 'Every hour';
  }

  if (minute === '0' && hour.startsWith('*/')) {
    const hours = parseInt(hour.substring(2));
    return `Every ${hours} hours`;
  }

  if (minute === '0' && hour === '2' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return 'Daily at 2 AM';
  }

  if (minute === '0' && hour === '2' && dayOfMonth === '*' && month === '*' && dayOfWeek === '0') {
    return 'Weekly on Sunday at 2 AM';
  }

  if (minute === '0' && hour === '2' && dayOfMonth === '1' && month === '*' && dayOfWeek === '*') {
    return 'Monthly on the 1st at 2 AM';
  }

  return cronExpression;
}

/**
 * Calculate next run time from cron expression
 */
export function getNextRunTime(cronExpression: string, from: Date = new Date()): Date {
  const [minute, hour, dayOfMonth, month, dayOfWeek] = cronExpression.split(' ');

  const next = new Date(from);
  next.setSeconds(0, 0);
  next.setMilliseconds(0);

  // Simple implementation - for production use a proper cron library
  const targetMinute = minute === '*' ? 0 : parseInt(minute);
  const targetHour = hour === '*' || hour.includes('*/') ? next.getHours() : parseInt(hour);
  const targetDayOfMonth = dayOfMonth === '*' ? next.getDate() : parseInt(dayOfMonth);
  const targetMonth = month === '*' ? next.getMonth() : parseInt(month) - 1;

  // Set target time
  next.setMinutes(targetMinute);
  next.setHours(targetHour);
  next.setDate(targetDayOfMonth);
  next.setMonth(targetMonth);

  // If time has passed, move to next occurrence
  if (next <= from) {
    // Simple increment (in production, use proper cron calculation)
    if (hour.includes('*/')) {
      const hours = parseInt(hour.substring(2));
      next.setHours(next.getHours() + hours);
    } else {
      next.setDate(next.getDate() + 1);
    }
  }

  return next;
}

/**
 * Sync Scheduler class
 */
export class SyncScheduler {
  private running = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 60000; // Check every minute

  /**
   * Start the scheduler
   */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    // Load all scheduled data sources
    await this.loadScheduledSources();

    // Start the check interval
    this.checkInterval = setInterval(() => {
      this.checkAndTriggerSyncs().catch(error => {
        console.error('[Sync Scheduler] Error checking syncs:', error);
      });
    }, this.CHECK_INTERVAL_MS);
  }

  /**
   * Stop the scheduler
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;

    // Clear all scheduled tasks
    for (const [jobId, task] of Array.from(scheduledTasks.entries())) {
      clearInterval(task.interval);
    }
    scheduledTasks.clear();

    // Clear check interval
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Load all data sources with scheduled sync
   */
  private async loadScheduledSources(): Promise<void> {
    try {
      const result = await pool.query(`
        SELECT
          id,
          team_slug,
          name,
          source_type,
          sync_frequency
        FROM projectnexus.data_sources
        WHERE sync_enabled = TRUE
          AND sync_frequency != 'manual'
          AND status = 'active'
          AND archived_at IS NULL
        ORDER BY next_sync_at ASC
      `);

      for (const dataSource of result.rows) {
        try {
          await this.scheduleDataSource(dataSource.id, dataSource.sync_frequency);
        } catch (error) {
          console.error(`[Sync Scheduler] Failed to schedule ${dataSource.name}:`, error);
        }
      }
    } catch (error) {
      console.error('[Sync Scheduler] Error loading scheduled sources:', error);
    }
  }

  /**
   * Schedule a data source for sync
   */
  async scheduleDataSource(
    dataSourceId: string,
    frequency: string
  ): Promise<ScheduleResult> {
    try {
      const cronExpression = getCronExpression(frequency);
      const nextRun = getNextRunTime(cronExpression);

      // Update next_sync_at in database
      await pool.query(
        'UPDATE projectnexus.data_sources SET next_sync_at = $1 WHERE id = $2',
        [nextRun, dataSourceId]
      );

      // Create interval-based task (simplified cron)
      const intervalMs = this.getIntervalFromFrequency(frequency);
      const taskId = `scheduled_${dataSourceId}`;

      // Clear existing task if any
      if (scheduledTasks.has(taskId)) {
        clearInterval(scheduledTasks.get(taskId)!.interval);
        scheduledTasks.delete(taskId);
      }

      // Create new task
      const task = setInterval(async () => {
        await this.triggerSync(dataSourceId, 'scheduled');
      }, intervalMs);

      scheduledTasks.set(taskId, {
        task,
        interval: task,
        dataSourceId
      });

      return {
        success: true,
        jobId: taskId,
        nextRun
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Unschedule a data source
   */
  async unscheduleDataSource(dataSourceId: string): Promise<void> {
    const taskId = `scheduled_${dataSourceId}`;

    if (scheduledTasks.has(taskId)) {
      clearInterval(scheduledTasks.get(taskId)!.interval);
      scheduledTasks.delete(taskId);
    }
  }

  /**
   * Reschedule a data source with new frequency
   */
  async rescheduleDataSource(
    dataSourceId: string,
    newFrequency: string
  ): Promise<ScheduleResult> {
    await this.unscheduleDataSource(dataSourceId);
    return this.scheduleDataSource(dataSourceId, newFrequency);
  }

  /**
   * Check and trigger syncs that are due
   */
  private async checkAndTriggerSyncs(): Promise<void> {
    if (!this.running) {
      return;
    }

    try {
      const now = new Date();

      // Find data sources where next_sync_at has passed
      const result = await pool.query(`
        SELECT id, name, team_slug, sync_frequency
        FROM projectnexus.data_sources
        WHERE sync_enabled = TRUE
          AND next_sync_at <= $1
          AND status = 'active'
          AND archived_at IS NULL
        LIMIT 100
      `, [now]);

      for (const dataSource of result.rows) {
        try {
          await this.triggerSync(dataSource.id, 'scheduled');
        } catch (error) {
          console.error(`[Sync Scheduler] Error triggering sync for ${dataSource.name}:`, error);
        }
      }
    } catch (error) {
      console.error('[Sync Scheduler] Error checking syncs:', error);
    }
  }

  /**
   * Trigger a sync job for a data source
   */
  async triggerSync(
    dataSourceId: string,
    triggerType: 'manual' | 'scheduled' | 'webhook' = 'manual',
    jobType: 'full' | 'incremental' = 'incremental',
    userId?: string
  ): Promise<string> {
    try {
      // Get data source info
      const dsResult = await pool.query(
        'SELECT source_type, sync_frequency FROM projectnexus.data_sources WHERE id = $1',
        [dataSourceId]
      );

      if (dsResult.rows.length === 0) {
        throw new Error(`Data source not found: ${dataSourceId}`);
      }

      const dataSource = dsResult.rows[0];

      // Calculate next sync time
      const nextSyncAt = dataSource.sync_frequency !== 'manual'
        ? getNextRunTime(getCronExpression(dataSource.sync_frequency))
        : null;

      // Create sync job
      const jobResult = await pool.query(`
        INSERT INTO projectnexus.sync_jobs (
          data_source_id,
          job_type,
          trigger_type,
          status,
          triggered_by,
          metadata
        ) VALUES ($1, $2, $3, 'pending', $4, $5)
        RETURNING id
      `, [
        dataSourceId,
        jobType,
        triggerType,
        userId || 'system',
        JSON.stringify({ triggerType })
      ]);

      const jobId = jobResult.rows[0].id;

      // Update data source's next_sync_at
      if (nextSyncAt) {
        await pool.query(
          'UPDATE projectnexus.data_sources SET next_sync_at = $1 WHERE id = $2',
          [nextSyncAt, dataSourceId]
        );
      }

      // Note: In production, you would queue this job for background processing
      // For now, we'll rely on a separate worker to process pending jobs

      return jobId;
    } catch (error) {
      console.error(`[Sync Scheduler] Error triggering sync for ${dataSourceId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel a sync job
   */
  async cancelSync(jobId: string): Promise<boolean> {
    try {
      const result = await pool.query(`
        UPDATE projectnexus.sync_jobs
        SET status = 'cancelled',
            completed_at = NOW(),
            error_message = 'Cancelled by user'
        WHERE id = $1
          AND status IN ('pending', 'running')
        RETURNING id
      `, [jobId]);

      return result.rows.length > 0;
    } catch (error) {
      console.error(`[Sync Scheduler] Error cancelling job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    running: boolean;
    scheduledTasks: number;
    nextCheckIn: number;
  } {
    return {
      running: this.running,
      scheduledTasks: scheduledTasks.size,
      nextCheckIn: this.CHECK_INTERVAL_MS
    };
  }

  /**
   * Get interval in milliseconds from frequency string
   */
  private getIntervalFromFrequency(frequency: string): number {
    const intervals: Record<string, number> = {
      'hourly': 60 * 60 * 1000,
      'every_6_hours': 6 * 60 * 60 * 1000,
      'every_12_hours': 12 * 60 * 60 * 1000,
      'daily': 24 * 60 * 60 * 1000,
      'weekly': 7 * 24 * 60 * 60 * 1000,
      'monthly': 30 * 24 * 60 * 60 * 1000
    };

    return intervals[frequency] || intervals['hourly'];
  }
}

// Singleton instance
let schedulerInstance: SyncScheduler | null = null;

/**
 * Get the singleton scheduler instance
 */
export function getScheduler(): SyncScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new SyncScheduler();
  }
  return schedulerInstance;
}

/**
 * Initialize and start the scheduler
 */
export async function initializeScheduler(): Promise<void> {
  const scheduler = getScheduler();
  await scheduler.start();
}

/**
 * Stop the scheduler
 */
export async function stopScheduler(): Promise<void> {
  if (schedulerInstance) {
    await schedulerInstance.stop();
  }
}
