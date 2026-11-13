import { Worker } from 'bullmq';
import { validateEnv } from './config/env.config';
import { logger } from './infrastructure/logger/pino.logger';
import { Pool } from 'pg';

const env = validateEnv();

async function bootstrapWorker() {
  logger.info('Memulai BullMQ background worker...');

  const pool = new Pool({
    connectionString: env.DATABASE_URL,
  });

  const worker = new Worker(
    'system-jobs',
    async (job) => {
      logger.info({ job: job.name, id: job.id }, 'Memproses background job');

      if (job.name === 'partitions.ensure') {
        logger.info('Menjalankan ensure_future_partitions(3)...');
        await pool.query('SELECT ensure_future_partitions(3);');
        logger.info('Partisi bulanan berhasil diverifikasi.');
      } else if (job.name === 'outbox.process') {
        const events = await pool.query(
          `SELECT id, aggregate_type, aggregate_id, event_type, payload
           FROM outbox_events
           WHERE processed_at IS NULL
           ORDER BY created_at ASC
           LIMIT 100`,
        );

        for (const ev of events.rows) {
          logger.info({ eventType: ev.event_type, id: ev.id }, 'Memproses outbox event');
          // Dispatch event / invalidate cache here
          await pool.query(
            'UPDATE outbox_events SET processed_at = now() WHERE id = $1',
            [ev.id],
          );
        }
      }
    },
    {
      connection: {
        url: env.REDIS_URL,
      },
    },
  );

  worker.on('completed', (job) => {
    logger.info({ job: job.name, id: job.id }, 'Job selesai diproses');
  });

  worker.on('failed', (job, err) => {
    logger.error({ job: job?.name, id: job?.id, err }, 'Job gagal dieksekusi');
  });

  const shutdown = async () => {
    logger.info('Menutup worker...');
    await worker.close();
    await pool.end();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrapWorker().catch((err) => {
  logger.error({ err }, 'Worker gagal bootstrap');
  process.exit(1);
});

