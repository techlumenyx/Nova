/**
 * Stage 11 — Follow-up Cron Job
 *
 * Runs every hour. Finds COMPLETED sessions where:
 *   - followUpScheduled <= now
 *   - followUpResponse is absent
 *
 * Phase 1: Sets a `followUpDue` flag on the session so the frontend
 * can show an in-app follow-up card on the user's next visit.
 *
 * Phase 2: Replace with FCM push notification.
 *
 * Sessions with no response after 72 hours are auto-closed (flag cleared).
 */

import cron from 'node-cron';
import { logger } from '@nova/shared';
import { sessionService } from '../services/session.service';
import { DiagnosisSession } from '../models/session.model';

const FOLLOW_UP_WINDOW_HOURS = 72;

export function startFollowUpCron(): void {
  // Run every hour at :00
  cron.schedule('0 * * * *', async () => {
    try {
      await processFollowUps();
    } catch (err) {
      logger.error('[FollowUpCron] Unhandled error in cron job', { err });
    }
  });

  logger.info('[FollowUpCron] Scheduled — runs every hour');
}

async function processFollowUps(): Promise<void> {
  const dueSessions = await sessionService.getDueForFollowUp();

  if (!dueSessions.length) return;

  logger.info('[FollowUpCron] Processing follow-up sessions', { count: dueSessions.length });

  const now = new Date();

  await Promise.all(
    dueSessions.map(async session => {
      const sessionId = (session._id as unknown as string).toString();
      try {
        const scheduledAt = session.followUpScheduled!;
        const hoursSinceScheduled =
          (now.getTime() - scheduledAt.getTime()) / (1000 * 60 * 60);

        if (hoursSinceScheduled > FOLLOW_UP_WINDOW_HOURS) {
          // Auto-close: window expired with no response
          await DiagnosisSession.findByIdAndUpdate(sessionId, {
            $unset: { followUpScheduled: '' },
          });
          logger.info('[FollowUpCron] Auto-closed follow-up (no response)', { sessionId });
        } else {
          // Phase 1: Mark as due so frontend shows the card
          await DiagnosisSession.findByIdAndUpdate(sessionId, {
            $set: { followUpDue: true },
          });
          logger.info('[FollowUpCron] Marked follow-up due', { sessionId });
          // Phase 2: await sendFCMNotification(session.userId, sessionId);
        }
      } catch (err) {
        logger.error('[FollowUpCron] Failed to process session', { sessionId, err });
      }
    }),
  );
}
