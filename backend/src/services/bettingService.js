// Live betting penalty tiers
// 0–45min: 0% | 46–60min: 10% | 61–70min: 25% | 71–75min: 40% | 76+: locked
const LIVE_LOCK_MINUTE = 75;

const PENALTY_TIERS = [
  { from: 0,  to: 45, pct: 0  },
  { from: 46, to: 60, pct: 10 },
  { from: 61, to: 70, pct: 25 },
  { from: 71, to: 75, pct: 40 },
];

function getLivePenalty(minute) {
  if (minute == null) return 0;
  if (minute > LIVE_LOCK_MINUTE) return null; // null = locked
  const tier = PENALTY_TIERS.find(t => minute >= t.from && minute <= t.to);
  return tier ? tier.pct : 0;
}

function isLiveBettingAllowed(minute) {
  return minute == null || minute <= LIVE_LOCK_MINUTE;
}

// payout = stake × odds × (1 - penalty/100), floored to whole points
function calculatePayout(stake, odds, penaltyPct = 0) {
  return stake * odds * (1 - penaltyPct / 100);
}

module.exports = { getLivePenalty, isLiveBettingAllowed, calculatePayout, LIVE_LOCK_MINUTE };
