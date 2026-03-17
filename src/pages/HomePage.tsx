import { useGames, useActiveBets } from "@/hooks/useApi";
import GameCard from "@/components/GameCard";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

const HomePage = () => {
  const { data: games = [], isLoading: gamesLoading } = useGames();
  const { data: activeBets } = useActiveBets();

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

      {/* Games Today */}
      <section className="flex flex-col gap-3">
        <div className="px-5">
          <span className="section-label">משחקי היום</span>
        </div>
        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory px-5 pb-2 scrollbar-hide">
          {gamesLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="min-w-[280px] h-[200px] rounded-[20px]" />
            ))
          ) : (
            games.map((game, i) => (
              <GameCard key={game.id} game={game} index={i} />
            ))
          )}
        </div>
      </section>

      {/* Active Bets */}
      <section className="flex flex-col gap-3 px-5">
        <span className="section-label">הימורים פעילים</span>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease: [0.32, 0.72, 0, 1] }}
          className="card-kickoff flex flex-col gap-3"
        >
          {activeBets && activeBets.length > 0 ? (
            activeBets.map((bet) => (
              <div key={bet.id} className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm">{bet.game.homeTeam.name} נגד {bet.game.awayTeam.name}</p>
                  <p className="text-xs text-muted-foreground">{bet.selectedOption} · {bet.points} נקודות</p>
                </div>
                <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                  {bet.status === "active" ? "פעיל" : "ממתין"}
                </span>
              </div>
            ))
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm">מכבי ת״א נגד הפועל ב״ש</p>
                  <p className="text-xs text-muted-foreground">ניצחון מכבי ת״א · 250 נקודות</p>
                </div>
                <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">פעיל</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm">מכבי חיפה נגד הפועל ת״א</p>
                  <p className="text-xs text-muted-foreground">תיקו · 100 נקודות</p>
                </div>
                <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">ממתין</span>
              </div>
            </>
          )}
        </motion.div>
      </section>

      {/* Quick Stats */}
      <section className="flex gap-3 px-5">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="card-kickoff flex-1 flex flex-col items-center gap-1"
        >
          <span className="text-2xl font-black">12</span>
          <span className="text-xs text-muted-foreground">הימורים שנוצחו</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="card-kickoff flex-1 flex flex-col items-center gap-1"
        >
          <span className="text-2xl font-black">68%</span>
          <span className="text-xs text-muted-foreground">אחוז הצלחה</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="card-kickoff flex-1 flex flex-col items-center gap-1"
        >
          <span className="text-2xl font-black">#4</span>
          <span className="text-xs text-muted-foreground">דירוג כללי</span>
        </motion.div>
      </section>
    </div>
  );
};

export default HomePage;
