import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { placeBet, placeParlay } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();
  const [isParlay, setIsParlay] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [shareText, setShareText] = useState("");

  // Only real-stake bets count toward parlay and global cost
  const realBets = betSlip.filter((b) => b.bet_mode !== "initial_balance");
  const scoringBets = betSlip.filter((b) => b.bet_mode === "initial_balance");

  const totalStake = realBets.reduce((sum, b) => sum + b.points, 0);
  const userPoints = backendUser?.points_balance ?? 0;

  const individualPayout = realBets.reduce((sum, b) => sum + Math.floor(b.points * b.odds), 0);
  const combinedOdds = realBets.reduce((product, b) => product * b.odds, 1);
  const parlayPayout = realBets.length >= 2
    ? Math.floor(totalStake * combinedOdds * parlayBonus(realBets.length))
    : 0;
  const potentialPayout = isParlay ? parlayPayout : individualPayout;

  const handleConfirm = async () => {
    if (betSlip.length === 0) return;
    
    // Check for expired bets (10 minutes before kickoff)
    const isExpired = (startTime: string) => {
      const tenMinutesBefore = new Date(new Date(startTime).getTime() - 10 * 60 * 1000);
      return new Date() >= tenMinutesBefore;
    };
    
    if (betSlip.some(b => isExpired(b.start_time))) {
      setResult({ success: false, message: "הימור אחד או יותר כבר נסגר (10 דקות לפני המשחק). אנא הסר אותם מהתלוש." });
      return;
    }

    if (totalStake > userPoints) return;
    setLoading(true);
    setResult(null);
    try {
      if (isParlay && realBets.length >= 2) {
        await placeParlay({
          legs: realBets.map((b) => ({
            game_id: b.game_id,
            bet_question_id: b.bet_question_id,
            selected_outcome: b.selectedOption,
            odds: b.odds,
          })),
          stake: totalStake,
        });
        // Scoring-only bets placed separately
        for (const bet of scoringBets) {
          await placeBet({
            game_id: bet.game_id,
            bet_question_id: bet.bet_question_id,
            selected_outcome: bet.selectedOption,
            stake: 0,
            league_id: bet.league_id,
            exact_score_prediction: bet.exact_score_prediction,
          });
        }
      } else {
        for (const bet of betSlip) {
          await placeBet({
            game_id: bet.game_id,
            bet_question_id: bet.bet_question_id,
            selected_outcome: bet.selectedOption,
            stake: bet.points,
            league_id: bet.league_id,
            exact_score_prediction: bet.exact_score_prediction,
          });
        }
      }

      const text = isParlay && realBets.length >= 2
        ? `⚽️ פרלאי של ${realBets.length} הימורים עם מכפיל x${combinedOdds.toFixed(2)} - ${totalStake.toLocaleString()} נקודות! הצטרף ל-Kickoff 🎯`
        : betSlip.length === 1
          ? `⚽️ הימרתי על ${betSlip[0].selectedOption} (x${betSlip[0].odds}) ב-${betSlip[0].gameLabel} - ${totalStake.toLocaleString()} נקודות! הצטרף ל-Kickoff 🎯`
          : `⚽️ שלחתי ${betSlip.length} הימורים עם פוטנציאל ${individualPayout.toLocaleString()} נקודות! הצטרף ל-Kickoff 🎯`;
      setShareText(text);
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
        {shareText && (
          <a
            href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full max-w-xs py-3 rounded-xl bg-green-500 text-white text-sm font-bold hover:bg-green-600 transition-colors"
          >
            שתף בוואטסאפ
          </a>
        )}
        <button
          onClick={() => navigate("/")}
          className="flex items-center justify-center gap-2 w-full max-w-xs py-3 rounded-xl bg-secondary text-foreground text-sm font-bold hover:bg-secondary/80 transition-colors"
        >
          חזרה למסך הבית
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-4 pb-24">
      <h2 className="text-2xl font-black">תלוש הימורים</h2>

      {/* Parlay Toggle — only for real-stake bets with 2+ */}
      {realBets.length > 1 && (
        <div className="card-kickoff flex items-center justify-between">
          <div>
            <p className="font-bold text-sm">שילוב הימורים (פרליי)</p>
            <p className="text-xs text-muted-foreground">
              בונוס ×{parlayBonus(realBets.length).toFixed(2)} · כל הבחירות חייבות לנצח
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
              <div className="flex items-center justify-between">
                <p className="font-bold text-sm">{bet.gameLabel}</p>
                {(() => {
                  const tenMinutesBefore = new Date(new Date(bet.start_time).getTime() - 10 * 60 * 1000);
                  const isLate = new Date() >= tenMinutesBefore;
                  return isLate && (
                    <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-lg animate-pulse">
                      נסגר
                    </span>
                  );
                })()}
              </div>
              <p className="text-xs text-muted-foreground">{bet.question}</p>
              <p className="text-sm font-bold text-primary">{bet.selectedOption}</p>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Context badge */}
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                  bet.bet_mode === "initial_balance"
                    ? "bg-amber-500/10 text-amber-600"
                    : bet.league_id
                      ? "bg-blue-500/10 text-blue-600"
                      : "bg-secondary text-muted-foreground"
                }`}>
                  {bet.league_name ?? "הימור חופשי"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {bet.bet_mode === "initial_balance"
                    ? `ניקוד · ×${bet.odds}`
                    : `${bet.points} נק׳ · ×${bet.odds}`}
                </span>
                {bet.exact_score_prediction && (
                  <span className="text-[11px] font-bold text-amber-500">
                    🎯 {bet.exact_score_prediction} · תוצאה נכונה = סה״כ ×3
                  </span>
                )}
              </div>
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
        {totalStake > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">נקודות בסיכון</span>
            <span className="font-bold">{totalStake.toLocaleString()}</span>
          </div>
        )}
        {scoringBets.length > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">הימורי ניקוד (ליגה)</span>
            <span className="font-bold">{scoringBets.length} הימורים</span>
          </div>
        )}
        {isParlay && realBets.length >= 2 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">מכפיל משולב</span>
            <span className="font-bold">×{(combinedOdds * parlayBonus(realBets.length)).toFixed(2)}</span>
          </div>
        )}
        {potentialPayout > 0 && (
          <>
            <div className="border-t border-border my-1" />
            <div className="flex justify-between text-base">
              <span className="font-bold">רווח פוטנציאלי</span>
              <span className="font-black text-primary">{potentialPayout.toLocaleString()} נקודות</span>
            </div>
          </>
        )}
      </div>

      {result && !result.success && (
        <p className="text-xs text-destructive text-center">{result.message}</p>
      )}

      <Button
        variant="cta"
        size="xl"
        className="w-full"
        onClick={handleConfirm}
        disabled={loading || (totalStake > userPoints) || (betSlip.length === 0)}
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
