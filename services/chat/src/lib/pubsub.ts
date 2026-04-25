/**
 * In-process pub/sub for GraphQL subscriptions.
 * Uses graphql-subscriptions PubSub — no Redis needed for Phase 1 (single process).
 * Replace with RedisPubSub when horizontal scaling is needed.
 */

import { PubSub } from 'graphql-subscriptions';

export const pubsub = new PubSub();

export const SESSION_UPDATED = 'SESSION_UPDATED';

export type SessionEventType =
  | 'MESSAGE'       // Nova replied during interview
  | 'STAGE_CHANGE'  // Background stages done / analysis started
  | 'COMPLETED'     // DiagnosisOutput ready
  | 'ESCALATED';    // Emergency triggered

export interface SessionEvent {
  sessionId:      string;
  type:           SessionEventType;
  message?:       string;
  stage:          number;
  status:         string;
  requiresAction: string;
  output?:        any;   // DiagnosisOutput — only set on COMPLETED
}

export function publishSessionEvent(event: SessionEvent): void {
  pubsub.publish(SESSION_UPDATED, { sessionUpdated: event });
}
