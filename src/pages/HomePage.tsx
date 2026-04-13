import { useQuery } from "@tanstack/react-query";
import { getGames, getLiveGames, getFeed, ACHIEVEMENTS } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import GameCard from "@/components/GameCard";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Trophy } from "lucide-react";
import { useState } from "react";

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "עכשיו";
  if (diff < 3600) return `לפני ${Math.floor(diff / 60)} דק׳`;
  if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} שע׳`;
  return `לפני ${Math.floor(diff / 86400)} ימים`;
}

const HomePage = () => {
  const { backendUser } = useAuth();
  const navigate = useNavigate();
  const [feedFilter, setFeedFilter] = useState<'all' | 'following'>('all');

  const { data: gamesData, isLoading } = useQuery({
    queryKey: ["games", "featured"],
    queryFn: () => getGames({ featured: true, status: "scheduled" }),
  });

  const { data: liveData } = useQuery({
    queryKey: ["games", "live"],
    queryFn: getLiveGames,
    refetchInterval: 30_000,
  });

  const { data: feedData } = useQuery({
    queryKey: ["feed", feedFilter],
    queryFn: () => getFeed(feedFilter === 'following' ? 'following' : undefined),
    staleTime: 60_000,
  });

  const games = gamesData?.games ?? [];
  const liveGames = liveData?.games ?? [];
  const feed = feedData?.feed ?? [];

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
      <div className="grid grid-cols-2 gap-3 px-5">
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
        <button
          onClick={() => navigate("/minigames")}
          className="col-span-2 flex items-center justify-center gap-2 bg-indigo-50/50 border border-indigo-100 rounded-xl px-4 py-3 font-bold text-sm text-indigo-700 hover:bg-indigo-100/50 transition-colors"
        >
          <span>🎁</span>
          שחק במיני-גיימס וטריוויה יומית
        </button>
      </div>

      {/* Live Games */}
      {liveGames.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="px-5 flex items-center gap-2">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span className="section-label">משחקים חיים עכשיו</span>
          </div>
          <div className="flex flex-col gap-2 px-5">
            {liveGames.map((game) => (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => navigate(`/game/${game.id}`)}
                className="card-kickoff flex items-center gap-3 py-3 cursor-pointer hover:bg-secondary/60 transition-colors border border-primary/20"
              >
                <div className="flex flex-col items-center min-w-[56px] text-center shrink-0">
                  <span className="text-xl font-black">
                    {game.score_home ?? 0} - {game.score_away ?? 0}
                  </span>
                  <span className="flex items-center gap-0.5 text-[10px] font-bold text-primary">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                    {game.minute ? `${game.minute}′` : "LIVE"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-muted-foreground mb-0.5 truncate">{game.competition_name ?? "כדורגל"}</p>
                  <div className="flex items-center gap-1.5">
                    {game.home_team_logo
                      ? <img src={game.home_team_logo} className="w-4 h-4 object-contain" alt="" />
                      : <span className="text-sm">⚽</span>}
                    <span className="text-sm font-bold truncate">{game.home_team}</span>
                    <span className="text-xs text-muted-foreground mx-1">נגד</span>
                    {game.away_team_logo
                      ? <img src={game.away_team_logo} className="w-4 h-4 object-contain" alt="" />
                      : <span className="text-sm">⚽</span>}
                    <span className="text-sm font-bold truncate">{game.away_team}</span>
                  </div>
                </div>
                <span className="text-xs font-bold text-primary shrink-0">לייב ›</span>
              </motion.div>
            ))}
          </div>
        </section>
      )}

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

      {/* Activity Feed */}
      {(feed.length > 0 || feedFilter === 'following') && (
        <section className="flex flex-col gap-3">
          <div className="px-5 flex items-center justify-between">
            <span className="section-label">מה קורה? 🔥</span>
            <div className="flex items-center bg-secondary rounded-lg p-0.5 text-xs font-bold">
              <button
                onClick={() => setFeedFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-colors ${feedFilter === 'all' ? 'bg-card text-foreground' : 'text-muted-foreground'}`}
              >הכל</button>
              <button
                onClick={() => setFeedFilter('following')}
                className={`px-2.5 py-1 rounded-md transition-colors ${feedFilter === 'following' ? 'bg-card text-foreground' : 'text-muted-foreground'}`}
              >עוקבים</button>
            </div>
          </div>
          {feed.length === 0 && feedFilter === 'following' && (
            <p className="px-5 text-sm text-muted-foreground">אין עדכונים מאנשים שאתה עוקב אחריהם</p>
          )}
          <div className="flex flex-col gap-2 px-5">
            {feed.slice(0, 8).map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3"
                onClick={() => navigate(`/profile/${item.user.username}`)}
              >
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm shrink-0 overflow-hidden cursor-pointer">
                  {item.user.avatar_url
                    ? <img src={item.user.avatar_url} className="w-full h-full object-cover" alt="" />
                    : "👤"}
                </div>
                <div className="flex-1 min-w-0">
                  {item.type === "win" ? (
                    <p className="text-sm">
                      <span className="font-bold cursor-pointer hover:text-primary" onClick={() => navigate(`/profile/${item.user.username}`)}>
                        {item.user.username}
                      </span>
                      {" "}ניצח{" "}
                      <span className="font-bold text-primary">+{item.amount?.toLocaleString()} נק׳</span>
                      {item.description?.includes(" vs ") && (
                        <span className="text-muted-foreground text-xs"> · {item.description.replace("Bet won: ", "").replace("League payout: ", "")}</span>
                      )}
                    </p>
                  ) : (
                    <p className="text-sm">
                      <span className="font-bold cursor-pointer hover:text-primary" onClick={() => navigate(`/profile/${item.user.username}`)}>
                        {item.user.username}
                      </span>
                      {" "}קיבל הישג{" "}
                      <span className="font-bold">
                        {ACHIEVEMENTS[item.achievement_key ?? ""]?.icon} {ACHIEVEMENTS[item.achievement_key ?? ""]?.title}
                      </span>
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground">{timeAgo(item.created_at)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

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
