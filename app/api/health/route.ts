/**
 * Health Check API Endpoint
 *
 * Provides comprehensive health checks for all system components.
 * Used by load balancers, orchestration systems, and monitoring tools.
 */

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { structuredLogger } from '@/lib/monitoring/structured-logger';
import { telemetry } from '@/lib/monitoring/telemetry';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: HealthStatus;
    redis: HealthStatus;
    storage: HealthStatus;
    qdrant: HealthStatus;
  };
  metrics: {
    memory: NodeJS.MemoryUsage;
    cpu: {
      usage: number;
    };
  };
}

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  latency?: number;
  error?: string;
}

/**
 * GET /api/health - Basic health check
 */
export async function GET() {
  const startTime = Date.now();
  const logger = structuredLogger.child({ component: 'health_check' });

  logger.info('Health check requested');

  try {
    const healthCheck = await performHealthCheck();
    const duration = Date.now() - startTime;

    logger.info('Health check completed', {
      status: healthCheck.status,
      duration_ms: duration,
    });

    telemetry.timing('health_check.duration', duration, {
      status: healthCheck.status,
    });

    // Return appropriate status code
    const statusCode =
      healthCheck.status === 'healthy' ? 200 : healthCheck.status === 'degraded' ? 200 : 503;

    return NextResponse.json(healthCheck, { status: statusCode });
  } catch (error) {
    logger.error('Health check failed', error instanceof Error ? error : undefined);

    telemetry.increment('health_check.error');

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}

/**
 * Perform comprehensive health checks
 */
async function performHealthCheck(): Promise<HealthCheckResult> {
  const uptime = process.uptime();
  const version = process.env.npm_package_version || '0.1.0';

  // Run all health checks in parallel
  const [dbStatus, redisStatus, storageStatus, qdrantStatus] = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
    checkStorage(),
    checkQdrant(),
  ]);

  const checks = {
    database:
      dbStatus.status === 'fulfilled' ? dbStatus.value : { status: 'unhealthy' as const, error: 'Check failed' },
    redis:
      redisStatus.status === 'fulfilled'
        ? redisStatus.value
        : { status: 'unhealthy' as const, error: 'Check failed' },
    storage:
      storageStatus.status === 'fulfilled'
        ? storageStatus.value
        : { status: 'unhealthy' as const, error: 'Check failed' },
    qdrant:
      qdrantStatus.status === 'fulfilled'
        ? qdrantStatus.value
        : { status: 'unhealthy' as const, error: 'Check failed' },
  };

  // Determine overall health
  const allHealthy = Object.values(checks).every((check) => check.status === 'healthy');
  const anyHealthy = Object.values(checks).some((check) => check.status === 'healthy');

  const overallStatus = allHealthy ? 'healthy' : anyHealthy ? 'degraded' : 'unhealthy';

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime,
    version,
    checks,
    metrics: {
      memory: process.memoryUsage(),
      cpu: {
        usage: process.cpuUsage().user / 1000000, // Convert to seconds
      },
    },
  };
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<HealthStatus> {
  const startTime = Date.now();

  try {
    // Simple query to check connection
    await query('SELECT 1');

    const latency = Date.now() - startTime;

    telemetry.gauge('health.database.latency', latency);

    return {
      status: 'healthy',
      latency,
    };
  } catch (error) {
    telemetry.increment('health.database.error');

    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}

/**
 * Check Redis connectivity
 */
async function checkRedis(): Promise<HealthStatus> {
  const startTime = Date.now();

  try {
    const { getRedisClient } = await import('@/lib/redis');
    const client = getRedisClient();

    if (!client) {
      return {
        status: 'unhealthy',
        error: 'Redis client not available',
      };
    }

    // Ping Redis - use a simple get operation as ping
    await client.get('health_check_ping');

    const latency = Date.now() - startTime;

    telemetry.gauge('health.redis.latency', latency);

    return {
      status: 'healthy',
      latency,
    };
  } catch (error) {
    telemetry.increment('health.redis.error');

    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown Redis error',
    };
  }
}

/**
 * Check storage connectivity (MinIO/S3)
 */
async function checkStorage(): Promise<HealthStatus> {
  const startTime = Date.now();

  try {
    const { getMinioClient } = await import('@/lib/storage/minio');
    const minioClient = await getMinioClient();

    if (!minioClient) {
      return {
        status: 'unhealthy',
        error: 'MinIO client not configured',
      };
    }

    // Check if bucket exists or is accessible
    const bucket = process.env.MINIO_BUCKET || 'nexary';
    const exists = await minioClient.bucketExists(bucket);

    const latency = Date.now() - startTime;

    telemetry.gauge('health.storage.latency', latency);

    if (exists) {
      return {
        status: 'healthy',
        latency,
      };
    }

    return {
      status: 'unhealthy',
      error: `Bucket ${bucket} does not exist`,
    };
  } catch (error) {
    telemetry.increment('health.storage.error');

    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown storage error',
    };
  }
}

/**
 * Check Qdrant connectivity
 */
async function checkQdrant(): Promise<HealthStatus> {
  const startTime = Date.now();

  try {
    // Import the qdrant functions directly
    const { ensureCollection } = await import('@/lib/rag/qdrant');

    // Try to check if a collection exists to verify connectivity
    // Use a random collection name that's unlikely to exist
    await ensureCollection('_health_check_temp');

    const latency = Date.now() - startTime;

    telemetry.gauge('health.qdrant.latency', latency);

    return {
      status: 'healthy',
      latency,
    };
  } catch (error) {
    telemetry.increment('health.qdrant.error');

    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown Qdrant error',
    };
  }
}
