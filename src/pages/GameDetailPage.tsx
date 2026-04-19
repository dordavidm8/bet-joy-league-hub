import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getGame, getMyLeagues } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { ArrowRight, Sparkles, Lock, Clock } from "lucide-react";
import { motion } from "framer-motion";
import AiAdvisor from "@/components/AiAdvisor";
import { translateTeam } from "@/lib/teamNames";

function useBettingCountdown(startTime: string) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const start = new Date(startTime).getTime();
      const closesAt = start - 60 * 60 * 1000;
      const diff = closesAt - now;
      if (diff <= 0) { setLabel(null); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      if (h > 0) setLabel(`הימורים ייסגרו בעוד ${h}ש׳ ${m}ד׳`);
      else if (m > 0) setLabel(`הימורים ייסגרו בעוד ${m}:${String(s).padStart(2, "0")} דק׳`);
      else setLabel(`הימורים ייסגרו בעוד ${s} שנ׳`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startTime]);

  return label;
}

const GameDetailPage = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const preselectedLeagueId: string | null = (location.state as any)?.leagueId ?? null;
  const { addToBetSlip, betSlip } = useApp();
  const { backendUser } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ["game", gameId],
    queryFn: () => getGame(gameId!),
    enabled: !!gameId,
    refetchInterval: (query) => query.state.data?.game.status === "live" ? 30_000 : false,
  });

  const { data: myLeaguesData } = useQuery({
    queryKey: ["my-leagues"],
    queryFn: getMyLeagues,
    staleTime: 60_000,
  });

  // Exclude tournament leagues whose slug doesn't match the game's competition
  const activeLeagues = (myLeaguesData?.leagues ?? []).filter(
    (l) =>
      l.is_active &&
      l.status === "active" &&
      (!l.tournament_slug || l.tournament_slug === data?.game?.competition_slug)
  );

  const [stakes, setStakes] = useState<Record<string, string>>({});
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [exactScores, setExactScores] = useState<Record<string, string>>({});
  // betContexts: questionId → Set of context keys ('global' | leagueId)
  const [betContexts, setBetContexts] = useState<Record<string, Set<string>>>({});
  const [showAi, setShowAi] = useState(false);
  const bettingCountdown = useBettingCountdown(data?.game?.start_time ?? "");

  if (isLoading) return <div className="p-5 text-sm text-muted-foreground">טוען משחק...</div>;
  if (error || !data?.game) return <div className="p-5">משחק לא נמצא</div>;

  const { game, bet_questions } = data;
  const isLive = game.status === "live";
  const isFinished = game.status === "finished";
  const gameLabel = `${translateTeam(game.home_team)} נגד ${translateTeam(game.away_team)}`;

  const timeLabel = isLive
    ? game.minute ? `${game.minute}′` : "LIVE"
    : new Date(game.start_time).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });

  const getContexts = (questionId: string): Set<string> =>
    betContexts[questionId] ?? new Set(["global"]);

  const toggleContext = (questionId: string, ctx: string) => {
    setBetContexts((prev) => {
      const current = new Set(prev[questionId] ?? ["global"]);
      if (current.has(ctx)) {
        current.delete(ctx);
      } else {
        current.add(ctx);
      }
      return { ...prev, [questionId]: new Set(current) };
    });
  };

  const handleSelect = (questionId: string, label: string) => {
    setSelections((prev) => ({ ...prev, [questionId]: label }));
    // On first selection: pre-select originating league (if came from league page) or global
    if (!betContexts[questionId]) {
      const initial = new Set<string>(
        preselectedLeagueId ? [preselectedLeagueId] : ["global"]
      );
      setBetContexts((prev) => ({ ...prev, [questionId]: initial }));
    }
  };

  const getExactScoreError = (score: string, selectedOutcome: string): string | null => {
    if (!score) return null;
    if (!/^\d+-\d+$/.test(score)) return "פורמט: 0-0";
    const [h, a] = score.split("-").map(Number);
    if (selectedOutcome === game.home_team && h <= a) return `${game.home_team} חייבת לנצח`;
    if (selectedOutcome === game.away_team && a <= h) return `${game.away_team} חייבת לנצח`;
    if (selectedOutcome === "Draw" && h !== a) return "תיקו = מספרים שווים";
    return null;
  };

  const handleAddToSlip = (questionId: string) => {
    const selectedLabel = selections[questionId];
    const contexts = getContexts(questionId);
    if (!selectedLabel || contexts.size === 0) return;

    const question = bet_questions.find((q: any) => q.id === questionId);
    if (!question) return;

    const outcome = question.outcomes?.find((o: any) => o.label === selectedLabel);
    const odds = outcome?.odds ?? 1;
    const stakeVal = parseInt(stakes[questionId] || "0");

    const rawScore = exactScores[questionId]?.trim() ?? "";
    const scoreError = getExactScoreError(rawScore, selectedLabel);
    const validScore = rawScore && !scoreError ? rawScore : undefined;

    for (const ctx of contexts) {
      if (ctx === "global") {
        if (stakeVal <= 0) continue;
        addToBetSlip({
          game_id: game.id,
          gameLabel,
          bet_question_id: questionId,
          question: question.question_text,
          selectedOption: selectedLabel,
          odds,
          points: stakeVal,
          league_id: null,
          league_name: null,
          bet_mode: "global",
          exact_score_prediction: validScore,
        });
      } else {
        const league = activeLeagues.find((l) => l.id === ctx);
        if (!league) continue;
        const isInitialBalance = league.bet_mode === "initial_balance";
        if (!isInitialBalance && stakeVal <= 0) continue;
        addToBetSlip({
          game_id: game.id,
          gameLabel,
          bet_question_id: questionId,
          question: question.question_text,
          selectedOption: selectedLabel,
          odds,
          points: isInitialBalance ? 0 : stakeVal,
          league_id: league.id,
          league_name: league.name,
          bet_mode: isInitialBalance ? "initial_balance" : "minimum_stake",
          exact_score_prediction: validScore,
        });
      }
    }
  };

  // Checks if the selected context requires a stake input
  const needsStakeInput = (questionId: string): boolean => {
    const contexts = getContexts(questionId);
    if (contexts.has("global")) return true;
    for (const ctx of contexts) {
      if (ctx === "global") continue;
      const league = activeLeagues.find((l) => l.id === ctx);
      if (league && league.bet_mode !== "initial_balance") return true;
    }
    return false;
  };

  const slipForQuestion = (questionId: string) =>
    betSlip.filter((b) => b.bet_question_id === questionId);

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
              {game.home_team_logo
                ? <img src={game.home_team_logo} className="w-10 h-10 object-contain" alt="" />
                : <span className="text-3xl">⚽</span>}
              <span className="text-sm font-bold text-center">{translateTeam(game.home_team)}</span>
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
              {game.away_team_logo
                ? <img src={game.away_team_logo} className="w-10 h-10 object-contain" alt="" />
                : <span className="text-3xl">⚽</span>}
              <span className="text-sm font-bold text-center">{translateTeam(game.away_team)}</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Betting countdown */}
      {!isLive && !isFinished && bettingCountdown && (
        <div className="px-5 flex items-center gap-2 text-xs text-amber-500 font-medium">
          <Clock size={13} />
          {bettingCountdown}
        </div>
      )}

      {/* Bet Questions */}
      {(isFinished || isLive) ? (
        <div className="px-5 text-sm text-muted-foreground">
          {isFinished ? "המשחק הסתיים — לא ניתן להמר" : "המשחק מתקיים כרגע — לא ניתן להמר"}
        </div>
      ) : (
        <div className="flex flex-col gap-6 px-5">
          {bet_questions.map((q: any, i: number) => {
            const isLocked = q.is_locked;
            const inSlipItems = slipForQuestion(q.id);
            const contexts = getContexts(q.id);

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
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Lock size={12} /> הימור נעול
                  </p>
                ) : (
                  <>
                    {/* Outcome buttons */}
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
                          {translateTeam(o.label)}
                          <span className="ml-1 text-xs opacity-70">×{o.odds}</span>
                        </button>
                      ))}
                    </div>

                    {selections[q.id] && (
                      <div className="flex flex-col gap-3">
                        {/* Exact score prediction — optional bonus ×3 */}
                        {(() => {
                          const raw = exactScores[q.id] ?? "";
                          const scoreErr = raw ? getExactScoreError(raw, selections[q.id]) : null;
                          const isValid = raw && !scoreErr;
                          return (
                            <div className="flex flex-col gap-1">
                              <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                                🎯 תוצאה מדויקת
                                <span className="text-amber-500 font-bold">· בונוס ×3</span>
                                <span className="text-muted-foreground font-normal">(אופציונלי)</span>
                              </p>
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={raw}
                                  onChange={(e) => setExactScores((p) => ({ ...p, [q.id]: e.target.value }))}
                                  placeholder="לדוגמה: 2-1"
                                  maxLength={5}
                                  className={`w-28 bg-secondary rounded-xl px-3 py-2 text-sm font-mono outline-none focus:ring-2 ${
                                    isValid ? "focus:ring-amber-400/40 border border-amber-400/50" : "focus:ring-primary/20"
                                  }`}
                                />
                                {isValid && (
                                  <span className="text-xs font-bold text-amber-500">✓ ×3 אפשרי!</span>
                                )}
                                {scoreErr && (
                                  <span className="text-xs text-destructive">{scoreErr}</span>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* League context selector */}
                        {activeLeagues.length > 0 && (
                          <div className="flex flex-col gap-2">
                            <p className="text-xs text-muted-foreground font-medium">היכן להמר:</p>
                            <div className="flex flex-wrap gap-2">
                              {/* Global chip */}
                              <button
                                onClick={() => toggleContext(q.id, "global")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                                  contexts.has("global")
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-secondary border-border"
                                }`}
                              >
                                גלובלי
                              </button>

                              {/* League chips */}
                              {activeLeagues.map((league) => (
                                <button
                                  key={league.id}
                                  onClick={() => toggleContext(q.id, league.id)}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                                    contexts.has(league.id)
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-secondary border-border"
                                  }`}
                                >
                                  {league.name}
                                  {league.bet_mode === "initial_balance" && (
                                    <span className="mr-1 opacity-60">· ניקוד</span>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Stake input (only when global or minimum_stake leagues selected) */}
                        {needsStakeInput(q.id) && (() => {
                          const contexts = getContexts(q.id);
                          const minRequired = Math.max(
                            0,
                            ...Array.from(contexts)
                              .filter(ctx => ctx !== "global")
                              .map(ctx => activeLeagues.find(l => l.id === ctx))
                              .filter((l): l is NonNullable<typeof l> => !!l && l.bet_mode !== "initial_balance")
                              .map(l => l.min_bet ?? 0)
                          );
                          return (
                            <div className="flex flex-col gap-1">
                              <input
                                type="number"
                                min={minRequired || 1}
                                max={backendUser?.points_balance ?? 9999}
                                value={stakes[q.id] ?? ""}
                                onChange={(e) => setStakes((p) => ({ ...p, [q.id]: e.target.value }))}
                                placeholder={minRequired > 0 ? `מינימום ${minRequired} נק׳` : "כמה נקודות?"}
                                className="flex-1 bg-secondary rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                              />
                              {minRequired > 0 && (
                                <p className="text-[11px] text-muted-foreground">מינימום: {minRequired} נק׳</p>
                              )}
                            </div>
                          );
                        })()}

                        {/* Add to slip button */}
                        <div className="flex items-center gap-2">
                          <Button
                            variant="cta"
                            size="default"
                            className="flex-1"
                            onClick={() => handleAddToSlip(q.id)}
                            disabled={
                              contexts.size === 0 ||
                              (needsStakeInput(q.id) && (!stakes[q.id] || parseInt(stakes[q.id]) <= 0))
                            }
                          >
                            {inSlipItems.length > 0
                              ? `עדכן תלוש (${inSlipItems.length})`
                              : "הוסף לתלוש"}
                          </Button>
                        </div>

                        {/* Show existing slip items for this question */}
                        {inSlipItems.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {inSlipItems.map((item) => (
                              <span
                                key={item.id}
                                className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full"
                              >
                                {item.league_name ?? "גלובלי"}
                                {item.bet_mode === "initial_balance" ? " · ניקוד" : ` · ${item.points} נק׳`}
                              </span>
                            ))}
                          </div>
                        )}
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
      {!isFinished && !isLive && (
        <button
          onClick={() => setShowAi(true)}
          className="fixed bottom-24 left-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-elevated flex items-center justify-center hover:scale-110 active:scale-95 transition-transform z-40"
        >
          <Sparkles size={22} />
        </button>
      )}

      {showAi && (
        <AiAdvisor
          gameId={game.id}
          homeTeam={game.home_team}
          awayTeam={game.away_team}
          onClose={() => setShowAi(false)}
        />
      )}
    </div>
  );
};

export default GameDetailPage;
