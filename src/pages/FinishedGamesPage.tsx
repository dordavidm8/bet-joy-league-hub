import { useQuery } from "@tanstack/react-query";
import { getFinishedGames, getMyBets, Game } from "@/lib/api";
import { motion } from "framer-motion";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const FinishedGamesPage = () => {
  const navigate = useNavigate();
  const [showMyBets, setShowMyBets] = useState(false);

  const { data: gamesData, isLoading } = useQuery({
    queryKey: ["finished-games"],
    queryFn: () => getFinishedGames(30),
  });

  const { data: betsData } = useQuery({
    queryKey: ["my-bets"],
    queryFn: getMyBets,
  });

  const allGames: Game[] = gamesData?.games ?? [];
  const myBets = betsData?.bets ?? [];

  // Games I have bets on
  const myBetGameIds = new Set(myBets.map(b => b.game_id));

  const displayedGames = showMyBets
    ? allGames.filter(g => myBetGameIds.has(g.id))
    : allGames;

  // Get bets for a specific game
  const betsForGame = (gameId: string) => myBets.filter(b => b.game_id === gameId);

  return (
    <div className="flex flex-col gap-4 pb-24">
      {/* Header */}
      <div className="px-5 pt-2">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-muted-foreground text-sm mb-3">
          <ArrowRight size={16} /> חזרה
        </button>
        <h2 className="text-2xl font-black">תוצאות</h2>
        <p className="text-xs text-muted-foreground mt-0.5">30 ימים אחרונים</p>
      </div>

      {/* Toggle */}
      <div className="flex gap-2 px-5">
        <button
          onClick={() => setShowMyBets(false)}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${
            !showMyBets ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
          }`}
        >
          כל המשחקים
        </button>
        <button
          onClick={() => setShowMyBets(true)}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${
            showMyBets ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
          }`}
        >
          ההימורים שלי
        </button>
      </div>

      {/* Games list */}
      <div className="flex flex-col gap-2 px-5">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">טוען תוצאות...</p>
        ) : displayedGames.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {showMyBets ? "לא הימרת על משחקים ב-7 הימים האחרונים" : "אין תוצאות ב-7 הימים האחרונים"}
          </p>
        ) : (
          displayedGames.map((game, i) => {
            const gameBets = betsForGame(game.id);

            return (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="card-kickoff flex flex-col gap-2"
              >
                {/* Game result */}
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-[11px] text-muted-foreground">{game.competition_name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-sm font-bold">{game.home_team}</span>
                      <span className="text-base font-black mx-2">
                        {game.score_home ?? "—"} - {game.score_away ?? "—"}
                      </span>
                      <span className="text-sm font-bold">{game.away_team}</span>
                    </div>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(game.start_time).toLocaleDateString("he-IL")}
                  </span>
                </div>

                {/* My bets on this game */}
                {gameBets.length > 0 && (
                  <div className="border-t border-border pt-2 flex flex-col gap-1.5">
                    {gameBets.map(bet => {
                      const profit = bet.status === "won"
                        ? (bet.actual_payout ?? bet.potential_payout) - bet.stake
                        : bet.status === "lost"
                        ? -bet.stake
                        : null;

                      return (
                        <div key={bet.id} className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{bet.selected_outcome} · {bet.stake} נק׳</span>
                          <div className="flex items-center gap-2">
                            {bet.status === "won" && (
                              <>
                                <span className="text-xs font-bold text-green-500">זכיתי</span>
                                {profit !== null && <span className="text-xs font-bold text-green-500">+{profit}</span>}
                              </>
                            )}
                            {bet.status === "lost" && (
                              <>
                                <span className="text-xs font-bold text-destructive">הפסדתי</span>
                                {profit !== null && <span className="text-xs font-bold text-destructive">{profit}</span>}
                              </>
                            )}
                            {bet.status === "pending" && (
                              <span className="text-xs text-muted-foreground">ממתין</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default FinishedGamesPage;
