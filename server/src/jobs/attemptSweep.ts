import { sweepExpiredAttempts } from '../services/assessments/attemptService.js';
import { logger } from '../utils/logger.js';

/**
 * Periodic maintenance job that finalises attempts whose server-recorded
 * deadline has passed. The client is never trusted to submit on time; this
 * sweep guarantees the system state is correct even if every browser closes.
 */
export async function runAttemptSweep(): Promise<number> {
  try {
    return await sweepExpiredAttempts();
  } catch (error) {
    logger.error('job.attempt_sweep_failed', { message: (error as Error).message });
    return 0;
  }
}
