/** Every tunable rule lives here, never inside components. */
export interface Thresholds {
  waitingWorkingDays: number;
  lostAttentionDays: number;
  staleBacklogDays: number;
  /** Inbox items older than this have not been reviewed in a reasonable time. */
  unprocessedInboxDays: number;
  /** Rescheduled this many times or more counts as repeated postponement. */
  repeatedRescheduleCount: number;
  /** Recommended maximum of tasks In progress at once. */
  wipLimit: number;
  /** Active tasks idle for more than this many days count as "not moving". */
  idleWeekDays: number;
  largeBacklog: number;
  /** A task reviewed within this many days is left out of Weekly cleanup. */
  cleanupRecentReviewDays: number;
  cleanupMaxItems: number;
  /** Project or workstream with no movement for this long needs a look. */
  projectInactiveDays: number;
  /** A project in Waiting for this long needs a follow-up. */
  projectWaitingDays: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  waitingWorkingDays: 5,
  lostAttentionDays: 5,
  staleBacklogDays: 30,
  unprocessedInboxDays: 3,
  repeatedRescheduleCount: 3,
  wipLimit: 5,
  idleWeekDays: 7,
  largeBacklog: 25,
  cleanupRecentReviewDays: 7,
  cleanupMaxItems: 10,
  projectInactiveDays: 14,
  projectWaitingDays: 7,
};
