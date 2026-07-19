// Spaced-repetition scheduler — an SM-2 variant with Anki-style learning
// steps and a 4-button grade (Again / Hard / Good / Easy). Pure functions
// only: given a card's current scheduling state and a grade, it returns the
// next state and when the card is next due. The service layer persists it.
//
// Why the intervals grow daily → weekly → monthly: a new card graduates at
// 1 day, the first review lands at ~6 days, and each subsequent successful
// recall multiplies the interval by the card's ease (default 2.5), so a
// well-known card is seen a week later, then ~2 weeks, then ~5-6 weeks, then
// months apart — you stop wasting time on what you already know.

export type Rating = "again" | "hard" | "good" | "easy";
export type CardStatus = "learning" | "review" | "lapsed";

export interface CardState {
  status: CardStatus;
  learningStep: number;
  /** Ease factor ×1000 (2500 = EF 2.5). Integer to avoid float drift. */
  easeMilli: number;
  intervalDays: number;
  reps: number;
  lapses: number;
}

export interface ScheduleResult extends CardState {
  /** Minutes from "now" until the card is next due. Learning steps use
   * minute-scale so a card can resurface within the same review session;
   * review intervals are whole days expressed in minutes. */
  dueInMinutes: number;
}

// --- Tunables (Anki defaults, adapted) ---
const LEARNING_STEPS_MIN = [1, 10]; // new card must pass these before "review"
const RELEARN_STEPS_MIN = [10]; // a lapsed card re-learns through these
const GRADUATING_INTERVAL_DAYS = 1;
const EASY_INTERVAL_DAYS = 4;
const FIRST_REVIEW_INTERVAL_DAYS = 6; // SM-2's classic 2nd interval
const HARD_FACTOR = 1.2;
const EASY_BONUS = 1.3;
const LAPSE_INTERVAL_DAYS = 1; // interval to restore after relearning
const MIN_EASE_MILLI = 1300;
const MAX_INTERVAL_DAYS = 365 * 4;

const EASE_DELTA: Record<Rating, number> = {
  again: -200,
  hard: -150,
  good: 0,
  easy: 150,
};

const DAY_MIN = 1440;

function clampEase(milli: number): number {
  return Math.max(MIN_EASE_MILLI, milli);
}
function capInterval(days: number): number {
  return Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(days)));
}

/** Fresh state for a newly created card (due immediately). */
export function newCardState(): CardState {
  return {
    status: "learning",
    learningStep: 0,
    easeMilli: 2500,
    intervalDays: 0,
    reps: 0,
    lapses: 0,
  };
}

/** Apply a grade to a card, returning its next scheduling state. */
export function schedule(card: CardState, rating: Rating): ScheduleResult {
  if (card.status === "learning" || card.status === "lapsed") {
    return scheduleLearning(card, rating);
  }
  return scheduleReview(card, rating);
}

function scheduleLearning(card: CardState, rating: Rating): ScheduleResult {
  const steps = card.status === "lapsed" ? RELEARN_STEPS_MIN : LEARNING_STEPS_MIN;

  // Easy always graduates immediately.
  if (rating === "easy") {
    return graduate(card, card.status === "lapsed" ? card.intervalDays : EASY_INTERVAL_DAYS);
  }

  if (rating === "again") {
    return {
      ...card,
      learningStep: 0,
      dueInMinutes: steps[0]!,
    };
  }

  // "hard" repeats the current step; "good" advances it.
  let step = card.learningStep;
  if (rating === "good") step += 1;

  if (step >= steps.length) {
    // Graduate: a lapsed card returns to its restored interval, a new card
    // graduates at the 1-day interval.
    return graduate(card, card.status === "lapsed" ? card.intervalDays : GRADUATING_INTERVAL_DAYS);
  }

  const stepMinutes = steps[Math.min(step, steps.length - 1)]!;
  return { ...card, learningStep: step, dueInMinutes: stepMinutes };
}

function graduate(card: CardState, intervalDays: number): ScheduleResult {
  const interval = capInterval(intervalDays);
  return {
    status: "review",
    learningStep: 0,
    easeMilli: card.easeMilli,
    intervalDays: interval,
    reps: 1,
    lapses: card.lapses,
    dueInMinutes: interval * DAY_MIN,
  };
}

function scheduleReview(card: CardState, rating: Rating): ScheduleResult {
  const ease = clampEase(card.easeMilli + EASE_DELTA[rating]);
  const ef = ease / 1000;

  if (rating === "again") {
    // Lapse: forget → relearn. Restore to a short interval after relearning.
    return {
      status: "lapsed",
      learningStep: 0,
      easeMilli: ease,
      intervalDays: LAPSE_INTERVAL_DAYS,
      reps: 0,
      lapses: card.lapses + 1,
      dueInMinutes: RELEARN_STEPS_MIN[0]!,
    };
  }

  const prev = Math.max(1, card.intervalDays);
  let next: number;
  if (rating === "hard") {
    next = Math.max(prev * HARD_FACTOR, prev + 1);
  } else if (rating === "good") {
    // First review after graduation jumps to the classic 6-day interval,
    // then compounds by ease thereafter.
    next = card.reps < 2 ? Math.max(FIRST_REVIEW_INTERVAL_DAYS, prev + 1) : Math.max(prev * ef, prev + 1);
  } else {
    // easy
    next = Math.max(prev * ef * EASY_BONUS, prev + 1);
  }

  return {
    status: "review",
    learningStep: 0,
    easeMilli: ease,
    intervalDays: capInterval(next),
    reps: card.reps + 1,
    lapses: card.lapses,
    dueInMinutes: capInterval(next) * DAY_MIN,
  };
}

/** Human label for when a card is next due, from a minute count. */
export function dueLabel(dueInMinutes: number): string {
  if (dueInMinutes < 60) return "곧 (이번 세션)";
  const days = dueInMinutes / DAY_MIN;
  if (days < 1) return `${Math.round(dueInMinutes / 60)}시간 후`;
  if (days < 1.5) return "내일";
  if (days < 7) return `${Math.round(days)}일 후`;
  if (days < 30) return `${Math.round(days / 7)}주 후`;
  if (days < 365) return `${Math.round(days / 30)}개월 후`;
  return `${(days / 365).toFixed(1)}년 후`;
}
