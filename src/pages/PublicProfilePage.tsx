import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPublicProfile, followUser, unfollowUser, ACHIEVEMENTS } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import { ArrowRight, Trophy, Target, Users, TrendingUp, UserPlus, UserMinus } from "lucide-react";
import { useState } from "react";

const PublicProfilePage = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { backendUser } = useAuth();
  const queryClient = useQueryClient();
  const [avatarError, setAvatarError] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-profile", username],
    queryFn: () => getPublicProfile(username!),
    enabled: !!username,
  });

  const followMutation = useMutation({
    mutationFn: (isFollowing: boolean) =>
      isFollowing ? unfollowUser(username!) : followUser(username!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["public-profile", username] }),
  });

  if (isLoading) return <div className="p-5 text-sm text-muted-foreground">טוען פרופיל...</div>;
  if (error || !data?.user) return <div className="p-5 text-sm text-muted-foreground">משתמש לא נמצא</div>;

  const { user } = data;
  const winRate = user.total_bets > 0
    ? `${Math.round((user.total_wins / user.total_bets) * 100)}%`
    : "—";
  const memberSince = new Date(user.created_at).toLocaleDateString("he-IL", { month: "long", year: "numeric" });

  return (
    <div className="flex flex-col gap-6 px-5 pt-4 pb-24">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-muted-foreground text-sm self-start">
        <ArrowRight size={16} />
        חזרה
      </button>

      {/* Avatar + Info */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-kickoff flex flex-col items-center gap-3"
      >
        <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center text-3xl overflow-hidden">
          {user.avatar_url && !avatarError ? (
            <img
              src={user.avatar_url}
              className="w-full h-full rounded-full object-cover"
              alt=""
              onError={() => setAvatarError(true)}
            />
          ) : (
            <span>👤</span>
          )}
        </div>

        <div className="flex flex-col items-center gap-1">
          <h2 className="text-xl font-black">@{user.username}</h2>
          <p className="text-xs text-muted-foreground">הצטרף {memberSince}</p>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-1">
              <Trophy size={12} className="text-amber-500" />
              <span className="text-xs font-bold text-amber-500">מקום #{user.rank.toLocaleString()}</span>
            </div>
            {user.streak > 0 && (
              <span className="text-xs font-bold text-primary">🔥 {user.streak} ברצף</span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1">
            <div className="flex flex-col items-center">
              <span className="text-sm font-black">{user.followers_count}</span>
              <span className="text-[10px] text-muted-foreground">עוקבים</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-sm font-black">{user.following_count}</span>
              <span className="text-[10px] text-muted-foreground">עוקב אחרי</span>
            </div>
          </div>
        </div>

        {backendUser && backendUser.username !== user.username && (
          <button
            onClick={() => followMutation.mutate(user.is_following)}
            disabled={followMutation.isPending}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-colors ${
              user.is_following
                ? "bg-secondary text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {user.is_following
              ? <><UserMinus size={15} /> הפסק לעקוב</>
              : <><UserPlus size={15} /> עקוב</>}
          </button>
        )}
      </motion.div>

      {/* Achievements */}
      {user.achievements.length > 0 && (
        <section className="flex flex-col gap-2">
          <span className="section-label">הישגים</span>
          <div className="flex flex-wrap gap-2">
            {user.achievements.map(a => {
              const def = ACHIEVEMENTS[a.achievement_key];
              if (!def) return null;
              return (
                <div key={a.achievement_key} title={def.desc}
                  className="flex items-center gap-1.5 bg-secondary rounded-xl px-3 py-2">
                  <span className="text-base">{def.icon}</span>
                  <span className="text-xs font-bold">{def.title}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="card-kickoff flex flex-col items-center gap-1 py-4"
        >
          <TrendingUp size={18} className="text-primary mb-1" />
          <span className="text-2xl font-black">{user.points_balance.toLocaleString()}</span>
          <span className="text-xs text-muted-foreground">נקודות</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card-kickoff flex flex-col items-center gap-1 py-4"
        >
          <Target size={18} className="text-primary mb-1" />
          <span className="text-2xl font-black">{winRate}</span>
          <span className="text-xs text-muted-foreground">אחוז הצלחה</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="card-kickoff flex flex-col items-center gap-1 py-4"
        >
          <Trophy size={18} className="text-primary mb-1" />
          <span className="text-2xl font-black">{user.total_wins}/{user.total_bets}</span>
          <span className="text-xs text-muted-foreground">ניצחונות/הימורים</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card-kickoff flex flex-col items-center gap-1 py-4"
        >
          <Users size={18} className="text-primary mb-1" />
          <span className="text-2xl font-black">{user.league_count}</span>
          <span className="text-xs text-muted-foreground">ליגות פעילות</span>
        </motion.div>
      </div>
    </div>
  );
};

export default PublicProfilePage;
