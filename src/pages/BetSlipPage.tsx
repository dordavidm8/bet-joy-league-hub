import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { placeBet, placeParlay } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

// Parlay bonus multiplier by number of legs
function parlayBonus(legs: number) {
  if (legs >= 4) return 1.20;
  if (legs >= 3) return 1.15;
  if (legs >= 2) return 1.10;
  return 1;
}

const BetSlipPage = () => {
  const { betSlip, removeFromBetSlip, clearBetSlip } = useApp();
  const { backendUser, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [isParlay, setIsParlay] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const totalStake = betSlip.reduce((sum, b) => sum + b.points, 0);
  const userPoints = backendUser?.points_balance ?? 0;

  // Individual: sum of each bet's (stake × odds)
  const individualPayout = betSlip.reduce((sum, b) => sum + Math.floor(b.points * b.odds), 0);

  // Parlay: totalStake × (product of all odds) × bonus
  const combinedOdds = betSlip.reduce((product, b) => product * b.odds, 1);
  const parlayPayout = Math.floor(totalStake * combinedOdds * parlayBonus(betSlip.length));

  const potentialPayout = isParlay ? parlayPayout : individualPayout;

  const handleConfirm = async () => {
    if (betSlip.length === 0 || totalStake > userPoints) return;
    setLoading(true);
    setResult(null);
    try {
      if (isParlay) {
        await placeParlay({
          legs: betSlip.map((b) => ({
            game_id: b.game_id,
            bet_question_id: b.bet_question_id,
            selected_outcome: b.selectedOption,
            odds: b.odds,
          })),
          stake: totalStake,
        });
      } else {
        for (const bet of betSlip) {
          await placeBet({
            game_id: bet.game_id,
            bet_question_id: bet.bet_question_id,
            selected_outcome: bet.selectedOption,
            stake: bet.points,
          });
        }
      }
      clearBetSlip();
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ["my-bets"] });
      queryClient.invalidateQueries({ queryKey: ["my-stats"] });
      setResult({ success: true, message: "ההימור אושר בהצלחה! 🎉" });
    } catch (err: any) {
      setResult({ success: false, message: err.message || "שגיאה בשליחת ההימור" });
    } finally {
      setLoading(false);
    }
  };

  if (betSlip.length === 0 && !result) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 pt-20 px-5 pb-24">
        <span className="text-5xl">📋</span>
        <h2 className="text-xl font-black">התלוש ריק</h2>
        <p className="text-muted-foreground text-sm text-center">הוסיפו הימורים ממשחקים כדי להתחיל</p>
      </div>
    );
  }

  if (result?.success) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 pt-20 px-5 pb-24">
        <span className="text-5xl">🎉</span>
        <h2 className="text-xl font-black">{result.message}</h2>
        <p className="text-muted-foreground text-sm text-center">ההימורים שלך נשלחו ומחכים לתוצאות</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-4 pb-24">
      <h2 className="text-2xl font-black">תלוש הימורים</h2>

      {/* Parlay Toggle */}
      {betSlip.length > 1 && (
        <div className="card-kickoff flex items-center justify-between">
          <div>
            <p className="font-bold text-sm">שילוב הימורים (פרליי)</p>
            <p className="text-xs text-muted-foreground">
              בונוס ×{parlayBonus(betSlip.length).toFixed(2)} על {betSlip.length} הימורים
            </p>
          </div>
          <button
            onClick={() => setIsParlay(!isParlay)}
            className={`w-12 h-7 rounded-full transition-colors duration-200 relative ${isParlay ? "bg-primary" : "bg-border"}`}
          >
            <span
              className={`absolute top-0.5 w-6 h-6 bg-card rounded-full shadow-sm transition-transform duration-200 ${
                isParlay ? "left-0.5" : "left-[calc(100%-1.625rem)]"
              }`}
            />
          </button>
        </div>
      )}

      {/* Bet Items */}
      <div className="flex flex-col gap-3">
        {betSlip.map((bet, i) => (
          <motion.div
            key={bet.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card-kickoff flex items-start justify-between gap-3"
          >
            <div className="flex flex-col gap-1 flex-1">
              <p className="font-bold text-sm">{bet.gameLabel}</p>
              <p className="text-xs text-muted-foreground">{bet.question}</p>
              <p className="text-sm font-bold text-primary">{bet.selectedOption}</p>
              <p className="text-xs text-muted-foreground">{bet.points} נקודות · ×{bet.odds}</p>
            </div>
            <button
              onClick={() => removeFromBetSlip(bet.id)}
              className="text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 size={18} />
            </button>
          </motion.div>
        ))}
      </div>

      {/* Summary */}
      <div className="card-kickoff flex flex-col gap-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">סה״כ נקודות בסיכון</span>
          <span className="font-bold">{totalStake.toLocaleString()}</span>
        </div>
        {isParlay && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">מכפיל משולב</span>
            <span className="font-bold">×{(combinedOdds * parlayBonus(betSlip.length)).toFixed(2)}</span>
          </div>
        )}
        <div className="border-t border-border my-1" />
        <div className="flex justify-between text-base">
          <span className="font-bold">רווח פוטנציאלי</span>
          <span className="font-black text-primary">{potentialPayout.toLocaleString()} נקודות</span>
        </div>
      </div>

      {result && !result.success && (
        <p className="text-xs text-destructive text-center">{result.message}</p>
      )}

      {/* Confirm */}
      <Button
        variant="cta"
        size="xl"
        className="w-full"
        onClick={handleConfirm}
        disabled={loading || totalStake > userPoints}
      >
        {loading ? "שולח..." : "אשר הימור"}
      </Button>

      {totalStake > userPoints && (
        <p className="text-xs text-destructive text-center">אין מספיק נקודות</p>
      )}
    </div>
  );
};

export default BetSlipPage;
