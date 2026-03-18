import { useQuery } from "@tanstack/react-query";
import { getGames, getMyBets, getRecentResults } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import GameCard from "@/components/GameCard";
import { motion } from "framer-motion";

const HomePage = () => {
  const { backendUser } = useAuth();

  const { data: gamesData, isLoading: gamesLoading } = useQuery({
    queryKey: ["games"],
    queryFn: () => getGames(),
  });

  const { data: betsData } = useQuery({
    queryKey: ["my-bets"],
    queryFn: getMyBets,
  });

  const { data: resultsData } = useQuery({
    queryKey: ["recent-results"],
    queryFn: getRecentResults,
  });

  const games = gamesData?.games?.filter((g) => g.status !== "finished") ?? [];
  const recentResults = resultsData?.games ?? [];
  const activeBets = betsData?.bets?.filter((b) => b.status === "pending") ?? [];
  const totalBets = backendUser?.total_bets ?? 0;
  const totalWins = backendUser?.total_wins ?? 0;
  const winRate = totalBets > 0 ? `${Math.round((totalWins / totalBets) * 100)}%` : "—";

  return (
    <div className="flex flex-col gap-8 pb-24">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        className="px-5 pt-4"
      >
        <h2 className="text-3xl font-black tracking-tight leading-tight">
          המשחק מתחיל כאן.
        </h2>
        <p className="text-muted-foreground mt-1">הימרו על המשחקים של היום וצברו נקודות</p>
      </motion.div>

      {/* Games */}
      <section className="flex flex-col gap-3">
        <div className="px-5">
          <span className="section-label">משחקים</span>
        </div>
        {gamesLoading ? (
          <div className="px-5 text-sm text-muted-foreground">טוען משחקים...</div>
        ) : games.length === 0 ? (
          <div className="px-5 text-sm text-muted-foreground">אין משחקים כרגע</div>
        ) : (
          <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory px-5 pb-2 scrollbar-hide">
            {games.map((game, i) => (
              <GameCard key={game.id} game={game} index={i} />
            ))}
          </div>
        )}
      </section>

      {/* Active Bets */}
      {activeBets.length > 0 && (
        <section className="flex flex-col gap-3 px-5">
          <span className="section-label">הימורים פעילים</span>
          <div className="card-kickoff flex flex-col gap-3">
            {activeBets.slice(0, 3).map((bet) => (
              <motion.div
                key={bet.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between"
              >
                <div>
                  <p className="font-bold text-sm">{bet.home_team} נגד {bet.away_team}</p>
                  <p className="text-xs text-muted-foreground">{bet.selected_outcome} · {bet.stake} נקודות</p>
                </div>
                <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">פעיל</span>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Quick Stats */}
      <section className="flex gap-3 px-5">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="card-kickoff flex-1 flex flex-col items-center gap-1">
          <span className="text-2xl font-black">{totalWins}</span>
          <span className="text-xs text-muted-foreground">ניצחונות</span>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="card-kickoff flex-1 flex flex-col items-center gap-1">
          <span className="text-2xl font-black">{winRate}</span>
          <span className="text-xs text-muted-foreground">אחוז הצלחה</span>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="card-kickoff flex-1 flex flex-col items-center gap-1">
          <span className="text-2xl font-black">{totalBets}</span>
          <span className="text-xs text-muted-foreground">הימורים</span>
        </motion.div>
      </section>

      {/* Recent Results */}
      {recentResults.length > 0 && (
        <section className="flex flex-col gap-3 px-5">
          <span className="section-label">תוצאות 24 שעות אחרונות</span>
          <div className="flex flex-col gap-2">
            {recentResults.map((game, i) => (
              <motion.div key={game.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="card-kickoff flex items-center justify-between py-2.5">
                <div className="flex-1 text-right">
                  <p className="text-sm font-bold">{game.home_team}</p>
                  <p className="text-[10px] text-muted-foreground">{game.competition_name}</p>
                </div>
                <div className="px-4 text-center">
                  <p className="text-lg font-black">{game.score_home} - {game.score_away}</p>
                  <p className="text-[10px] text-muted-foreground">סיים</p>
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-bold">{game.away_team}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default HomePage;
