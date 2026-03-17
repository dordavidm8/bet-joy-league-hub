/**
 * Live betting penalty system
 *
 * Minute 0–45:   0%  penalty
 * Minute 46–60: 10%  penalty
 * Minute 61–70: 25%  penalty
 * Minute 71–75: 40%  penalty
 * Minute 76+:   betting locked
 */

const LIVE_LOCK_MINUTE = 75;

const PENALTY_TIERS = [
  { from: 0,  to: 45, pct: 0  },
  { from: 46, to: 60, pct: 10 },
  { from: 61, to: 70, pct: 25 },
  { from: 71, to: 75, pct: 40 },
];

function getLivePenalty(minute) {
  if (minute === null || minute === undefined) return 0;
  if (minute > LIVE_LOCK_MINUTE) return null; // null = locked
  const tier = PENALTY_TIERS.find((t) => minute >= t.from && minute <= t.to);
  return tier ? tier.pct : 0;
}

function isLiveBettingAllowed(minute) {
  return minute === null || minute === undefined || minute <= LIVE_LOCK_MINUTE;
}

/**
 * Calculate potential payout
 * payout = stake * odds * (1 - penalty/100)
 * Result is floored to nearest integer (points are whole numbers)
 */
function calculatePayout(stake, odds, penaltyPct = 0) {
  return Math.floor(stake * odds * (1 - penaltyPct / 100));
}

module.exports = {
  getLivePenalty,
  isLiveBettingAllowed,
  calculatePayout,
  LIVE_LOCK_MINUTE,
};
