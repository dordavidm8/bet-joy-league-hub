import { useQuery } from "@tanstack/react-query";
import { getGames } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import GameCard from "@/components/GameCard";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Trophy } from "lucide-react";

const HomePage = () => {
  const { backendUser } = useAuth();
  const navigate = useNavigate();

  const { data: gamesData, isLoading } = useQuery({
    queryKey: ["games", "featured"],
    queryFn: () => getGames({ featured: true, status: "scheduled" }),
  });

  const games = gamesData?.games ?? [];

  return (
    <div className="flex flex-col gap-8 pb-24">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        className="px-5 pt-4"
      >
        <h2 className="text-3xl font-black tracking-tight leading-tight">המשחק מתחיל כאן.</h2>
        <p className="text-muted-foreground mt-1">הימרו על המשחקים הגדולים וצברו נקודות</p>
      </motion.div>

      {/* Nav buttons */}
      <div className="flex gap-3 px-5">
        <button
          onClick={() => navigate("/games")}
          className="flex-1 flex items-center justify-between bg-secondary rounded-xl px-4 py-3 font-bold text-sm hover:bg-secondary/80 transition-colors"
        >
          כל המשחקים
          <ChevronLeft size={16} className="text-muted-foreground" />
        </button>
        <button
          onClick={() => navigate("/games/finished")}
          className="flex-1 flex items-center justify-between bg-secondary rounded-xl px-4 py-3 font-bold text-sm hover:bg-secondary/80 transition-colors"
        >
          תוצאות
          <Trophy size={16} className="text-muted-foreground" />
        </button>
      </div>

      {/* Featured Games */}
      <section className="flex flex-col gap-3">
        <div className="px-5">
          <span className="section-label">משחקים מומלצים</span>
        </div>
        {isLoading ? (
          <div className="px-5 text-sm text-muted-foreground">טוען משחקים...</div>
        ) : games.length === 0 ? (
          <div className="px-5 text-sm text-muted-foreground">אין משחקים מומלצים כרגע</div>
        ) : (
          <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory px-5 pb-2 scrollbar-hide">
            {games.map((game, i) => (
              <GameCard key={game.id} game={game} index={i} />
            ))}
          </div>
        )}
      </section>

      {/* Quick Stats */}
      <section className="flex gap-3 px-5">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="card-kickoff flex-1 flex flex-col items-center gap-1">
          <span className="text-2xl font-black">{backendUser?.total_wins ?? 0}</span>
          <span className="text-xs text-muted-foreground">ניצחונות</span>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="card-kickoff flex-1 flex flex-col items-center gap-1">
          <span className="text-2xl font-black">
            {(backendUser?.total_bets ?? 0) > 0
              ? `${Math.round(((backendUser?.total_wins ?? 0) / (backendUser?.total_bets ?? 1)) * 100)}%`
              : "—"}
          </span>
          <span className="text-xs text-muted-foreground">אחוז הצלחה</span>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="card-kickoff flex-1 flex flex-col items-center gap-1">
          <span className="text-2xl font-black">{backendUser?.total_bets ?? 0}</span>
          <span className="text-xs text-muted-foreground">הימורים</span>
        </motion.div>
      </section>
    </div>
  );
};

export default HomePage;
