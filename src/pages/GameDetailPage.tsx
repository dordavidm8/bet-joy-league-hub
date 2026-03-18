import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getGame } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ArrowRight, Sparkles, Lock } from "lucide-react";
import { motion } from "framer-motion";
import AiAdvisor from "@/components/AiAdvisor";

const GameDetailPage = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { addToBetSlip, betSlip } = useApp();
  const { backendUser } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ["game", gameId],
    queryFn: () => getGame(gameId!),
    enabled: !!gameId,
  });

  const [stakes, setStakes] = useState<Record<string, string>>({});
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [showAi, setShowAi] = useState(false);

  if (isLoading) return <div className="p-5 text-sm text-muted-foreground">טוען משחק...</div>;
  if (error || !data?.game) return <div className="p-5">משחק לא נמצא</div>;

  const { game, bet_questions } = data;
  const isLive = game.status === "live";
  const isFinished = game.status === "finished";
  const gameLabel = `${game.home_team} נגד ${game.away_team}`;

  const timeLabel = isLive
    ? game.minute ? `${game.minute}′` : "LIVE"
    : new Date(game.start_time).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });

  const handleSelect = (questionId: string, label: string) => {
    setSelections((prev) => ({ ...prev, [questionId]: label }));
  };

  const handleAddToSlip = (questionId: string) => {
    const selectedLabel = selections[questionId];
    const stakeVal = parseInt(stakes[questionId] || "0");
    if (!selectedLabel || stakeVal <= 0) return;

    const question = bet_questions.find((q) => q.id === questionId);
    if (!question) return;

    const outcome = question.outcomes?.find((o: any) => o.label === selectedLabel);
    const odds = outcome?.odds ?? 1;

    addToBetSlip({
      game_id: game.id,
      gameLabel,
      bet_question_id: questionId,
      question: question.question_text,
      selectedOption: selectedLabel,
      odds,
      points: stakeVal,
    });
  };

  const inSlip = (questionId: string) => betSlip.some((b) => b.bet_question_id === questionId);

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* Header */}
      <div className="px-5 pt-2">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-muted-foreground text-sm mb-4">
          <ArrowRight size={16} />
          חזרה
        </button>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-kickoff">
          <div className="flex items-center justify-between mb-2">
            <span className="section-label">{game.competition_name ?? "כדורגל"}</span>
            {isLive && (
              <span className="flex items-center gap-1 text-xs font-bold text-primary">
                <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                LIVE · {timeLabel}
              </span>
            )}
            {isFinished && <span className="text-xs font-bold text-muted-foreground">הסתיים</span>}
          </div>

          <div className="flex items-center justify-between gap-4 my-4">
            <div className="flex flex-col items-center gap-2 flex-1">
              <span className="text-3xl">⚽</span>
              <span className="text-sm font-bold text-center">{game.home_team}</span>
            </div>
            <div className="flex flex-col items-center">
              {(isLive || isFinished) && game.score_home != null ? (
                <span className="text-3xl font-black">{game.score_home} - {game.score_away}</span>
              ) : (
                <div className="text-center">
                  <p className="text-xl font-bold">{timeLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(game.start_time).toLocaleDateString("he-IL")}
                  </p>
                </div>
              )}
            </div>
            <div className="flex flex-col items-center gap-2 flex-1">
              <span className="text-3xl">⚽</span>
              <span className="text-sm font-bold text-center">{game.away_team}</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Live penalty notice */}
      {isLive && game.minute != null && (
        <div className="px-5">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2 text-xs text-yellow-800">
            {game.minute <= 45 && "הימור ללא קנס"}
            {game.minute > 45 && game.minute <= 60 && "⚠️ קנס 10% על תשלום (דקה 46-60)"}
            {game.minute > 60 && game.minute <= 70 && "⚠️ קנס 25% על תשלום (דקה 61-70)"}
            {game.minute > 70 && game.minute <= 75 && "⚠️ קנס 40% על תשלום (דקה 71-75)"}
            {game.minute > 75 && <span className="flex items-center gap-1"><Lock size={12} /> הימור נעול לאחר דקה 75</span>}
          </div>
        </div>
      )}

      {/* Bet Questions */}
      {isFinished ? (
        <div className="px-5 text-sm text-muted-foreground">המשחק הסתיים — לא ניתן להמר</div>
      ) : (
        <div className="flex flex-col gap-6 px-5">
          {bet_questions.map((q: any, i: number) => {
            const isLocked = q.is_locked || (isLive && game.minute != null && game.minute > 75);
            return (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="flex flex-col gap-3"
              >
                <h3 className="font-bold text-base">{q.question_text}</h3>

                {isLocked ? (
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Lock size={12} /> הימור נעול</p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {(q.outcomes ?? []).map((o: any) => (
                        <button
                          key={o.label}
                          onClick={() => handleSelect(q.id, o.label)}
                          className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                            selections[q.id] === o.label
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-secondary border-border hover:border-primary/40"
                          }`}
                        >
                          {o.label}
                          <span className="ml-1 text-xs opacity-70">×{o.odds}</span>
                        </button>
                      ))}
                    </div>

                    {selections[q.id] && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={backendUser?.points_balance ?? 9999}
                          value={stakes[q.id] ?? ""}
                          onChange={(e) => setStakes((p) => ({ ...p, [q.id]: e.target.value }))}
                          placeholder="כמה נקודות?"
                          className="flex-1 bg-secondary rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <Button
                          variant="cta"
                          size="default"
                          onClick={() => handleAddToSlip(q.id)}
                          disabled={!stakes[q.id] || parseInt(stakes[q.id]) <= 0}
                        >
                          {inSlip(q.id) ? "עדכן תלוש" : "הוסף לתלוש"}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* AI Button */}
      {!isFinished && (
        <button
          onClick={() => setShowAi(true)}
          className="fixed bottom-24 left-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-elevated flex items-center justify-center hover:scale-110 active:scale-95 transition-transform z-40"
        >
          <Sparkles size={22} />
        </button>
      )}

      {showAi && (
        <AiAdvisor
          homeTeam={game.home_team}
          awayTeam={game.away_team}
          onClose={() => setShowAi(false)}
        />
      )}
    </div>
  );
};

export default GameDetailPage;
