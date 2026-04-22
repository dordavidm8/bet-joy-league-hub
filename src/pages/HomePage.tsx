import { useQuery } from "@tanstack/react-query";
import { getGames, getLiveGames, getFeed, ACHIEVEMENTS } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import GameCard from "@/components/GameCard";
import GameListItem from "@/components/GameListItem";
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
  const { backendUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [feedFilter, setFeedFilter] = useState<'all' | 'following'>('all');

  const { data: gamesData, isLoading } = useQuery({
    queryKey: ["games", "scheduled"],
    queryFn: () => getGames({ status: "scheduled" }),
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

  const allScheduled = gamesData?.games ?? [];
  const featuredGames = allScheduled.filter(g => g.is_featured);
  const upcomingGames = allScheduled.filter(g => !g.is_featured).slice(0, 8);
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
        <p className="text-muted-foreground mt-1">המרו על המשחקים הגדולים וצברו נקודות</p>
      </motion.div>

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

      {/* WhatsApp Link Prompt */}
      {!authLoading && backendUser && !backendUser.phone_verified && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          onClick={() => navigate("/profile?section=whatsapp")}
          className="mx-5 p-4 rounded-2xl bg-gradient-to-br from-[#25D366]/10 to-transparent border border-[#25D366]/20 cursor-pointer hover:bg-[#25D366]/15 transition-all group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#25D366]/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-[#25D366]/10 transition-colors" />
          
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-[#25D366] flex items-center justify-center shrink-0 shadow-lg shadow-[#25D366]/20">
              <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.067 2.877 1.215 3.076.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.94 3.659 1.437 5.634 1.437h.005c6.558 0 11.858-5.335 11.861-11.893a11.821 11.821 0 00-3.41-8.411z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-lg leading-tight">חבר את הווטסאפ שלך</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mt-0.5">
                קבל עדכונים, המר ישירות מהצ׳אט וצפה בטבלה בזמן אמת.
              </p>
            </div>
            <ChevronLeft className="text-muted-foreground mt-auto mb-auto" size={20} />
          </div>
        </motion.div>
      )}

      {/* Editor's Pick — only shown when admin has featured games */}
      {!isLoading && featuredGames.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="px-5 flex items-center gap-2">
            <span className="text-base">⭐</span>
            <span className="section-label">בחירת העורך</span>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 pt-1 px-5 snap-x snap-mandatory scrollbar-hide items-stretch">
            {featuredGames.map((game, i) => (
              <GameCard key={game.id} game={game} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming Games */}
      <section className="flex flex-col gap-3">
        <div className="px-5 flex items-center gap-2">
          <span className="text-base">📅</span>
          <span className="section-label">משחקים קרובים</span>
        </div>
        {isLoading ? (
          <div className="px-5 text-sm text-muted-foreground">טוען משחקים...</div>
        ) : upcomingGames.length === 0 ? (
          <div className="px-5 text-sm text-muted-foreground">אין משחקים קרובים כרגע</div>
        ) : (
          <div className="flex flex-col gap-2 px-5">
            {upcomingGames.map((game) => (
              <GameListItem key={game.id} game={game} />
            ))}
          </div>
        )}
      </section>

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
      </div>

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
                      {" "}זכה ב-{" "}
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
