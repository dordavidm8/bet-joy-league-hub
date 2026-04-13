import { useAuth } from "@/context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMyBets, getMyReferralCode, updateAvatar, deleteAccount, getMyAchievements, ACHIEVEMENTS } from "@/lib/api";
import AvatarUploader from "@/components/AvatarUploader";
import { motion } from "framer-motion";
import { LogOut, Copy, Check, Camera, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const ProfilePage = () => {
  const { backendUser, firebaseUser, signOut } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [showAvatarUploader, setShowAvatarUploader] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const { data: betsData } = useQuery({ queryKey: ["my-bets"], queryFn: () => getMyBets({ limit: 5 }) });
  const { data: referralData } = useQuery({ queryKey: ["my-referral"], queryFn: getMyReferralCode });
  const { data: achievementsData } = useQuery({ queryKey: ["my-achievements"], queryFn: getMyAchievements });

  const [avatarSaveError, setAvatarSaveError] = useState<string | null>(null);

  const avatarMutation = useMutation({
    mutationFn: (url: string) => updateAvatar(url),
    onSuccess: () => {
      setShowAvatarUploader(false);
      window.location.reload();
    },
    onError: (err: any) => {
      setAvatarSaveError(err?.message || 'שמירת התמונה נכשלה — נסה שוב');
    },
  });

  const bets = betsData?.bets ?? [];
  const recentBets = bets.slice(0, 5);
  const totalBets = backendUser?.total_bets ?? 0;
  const totalWins = backendUser?.total_wins ?? 0;
  const winRate = totalBets > 0 ? `${Math.round((totalWins / totalBets) * 100)}%` : "—";

  const copyReferral = () => {
    const code = referralData?.referral_code ?? backendUser?.referral_code;
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6 px-5 pt-4 pb-24">
      {/* Avatar + Info */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-kickoff flex flex-col items-center gap-3"
      >
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center text-3xl overflow-hidden">
            {backendUser?.avatar_url && !avatarError ? (
              <img src={backendUser.avatar_url} className="w-full h-full rounded-full object-cover" alt="" onError={() => setAvatarError(true)} />
            ) : <span>👤</span>}
          </div>
          <button
            onClick={() => { setShowAvatarUploader(true); setAvatarSaveError(null); }}
            className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow"
          >
            <Camera size={13} />
          </button>
        </div>
        {avatarSaveError && (
          <p className="text-xs text-destructive text-center">{avatarSaveError}</p>
        )}

        <h2 className="text-xl font-black">
          {firebaseUser?.displayName || backendUser?.username || firebaseUser?.email?.split("@")[0] || "משתמש"}
        </h2>
        {backendUser?.username && firebaseUser?.displayName && firebaseUser.displayName !== backendUser.username && (
          <p className="text-xs text-muted-foreground">@{backendUser.username}</p>
        )}
        <p className="text-xs font-mono bg-secondary px-2.5 py-1 rounded-full text-muted-foreground">
          #{(backendUser?.id ?? firebaseUser?.uid ?? "").replace(/-/g, "").substring(0, 8).toUpperCase()}
        </p>
        <p className="text-sm text-muted-foreground">
          {backendUser?.created_at
            ? `הצטרף ${new Date(backendUser.created_at).toLocaleDateString("he-IL", { month: "long", year: "numeric" })}`
            : ""}
        </p>
      </motion.div>

      {/* Stats */}
      <div className="flex gap-3">
        <div className="card-kickoff flex-1 flex flex-col items-center gap-1">
          <span className="text-xl font-black">{(backendUser?.points_balance ?? 0).toLocaleString()}</span>
          <span className="text-xs text-muted-foreground">נקודות</span>
        </div>
        <div className="card-kickoff flex-1 flex flex-col items-center gap-1">
          <span className="text-xl font-black">{totalWins}/{totalBets}</span>
          <span className="text-xs text-muted-foreground">ניצחונות/הימורים</span>
        </div>
        <div className="card-kickoff flex-1 flex flex-col items-center gap-1">
          <span className="text-xl font-black">{winRate}</span>
          <span className="text-xs text-muted-foreground">הצלחה</span>
        </div>
      </div>

      {/* Stats link */}
      <button
        onClick={() => navigate("/stats")}
        className="flex items-center justify-between bg-secondary rounded-xl px-4 py-3 font-bold text-sm hover:bg-secondary/80 transition-colors"
      >
        <span>הסטטיסטיקות שלי</span>
        <ChevronRight size={16} className="text-muted-foreground" />
      </button>

      {/* Referral */}
      {(referralData?.referral_code || backendUser?.referral_code) && (
        <div className="card-kickoff flex items-center justify-between">
          <div>
            <p className="text-sm font-bold">קוד הפניה שלי</p>
            <p className="text-xs text-muted-foreground">חבר שנרשם = +1,000 נקודות לך</p>
            <p className="font-mono text-base font-black tracking-widest mt-1">
              {referralData?.referral_code ?? backendUser?.referral_code}
            </p>
          </div>
          <button onClick={copyReferral} className="text-muted-foreground hover:text-primary transition-colors">
            {copied ? <Check size={18} className="text-primary" /> : <Copy size={18} />}
          </button>
        </div>
      )}

      {/* Achievements */}
      {achievementsData && achievementsData.achievements.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="section-label">הישגים</span>
            {achievementsData.streak > 0 && (
              <span className="text-xs font-bold text-primary">🔥 {achievementsData.streak} ברצף</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {achievementsData.achievements.map(a => {
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

      {/* Bet History */}
      {recentBets.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="section-label">הימורים אחרונים</span>
            <button
              onClick={() => navigate("/bets")}
              className="flex items-center gap-0.5 text-xs text-primary font-bold"
            >
              ראה הכל <ChevronRight size={14} />
            </button>
          </div>
          {recentBets.map((bet, i) => (
            <motion.div
              key={bet.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card-kickoff flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-bold">{bet.home_team} נגד {bet.away_team}</p>
                <p className="text-xs text-muted-foreground">{bet.selected_outcome}</p>
              </div>
              <div className="text-left">
                <p className={`text-sm font-bold ${bet.status === "won" ? "text-primary" : bet.status === "lost" ? "text-destructive" : "text-muted-foreground"}`}>
                  {bet.status === "won" ? `+${bet.actual_payout}` :
                   bet.status === "lost" ? `-${bet.stake}` : "ממתין"}
                </p>
              </div>
            </motion.div>
          ))}
        </section>
      )}

      {/* Settings */}
      <section className="flex flex-col gap-2">
        <span className="section-label">הגדרות</span>
        <button
          onClick={() => signOut()}
          className="card-kickoff flex items-center gap-3 text-right text-muted-foreground"
        >
          <LogOut size={18} />
          <span className="text-sm font-medium">התנתק</span>
        </button>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="card-kickoff flex items-center gap-3 text-right text-destructive"
        >
          <span className="text-sm font-medium">מחק חשבון</span>
        </button>
      </section>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-5" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-card rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-black text-destructive">מחיקת חשבון</h3>
            <p className="text-sm text-muted-foreground">כל הנתונים שלך, ההימורים, הנקודות והליגות יימחקו לצמיתות. אין דרך חזרה.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium">
                ביטול
              </button>
              <button
                onClick={async () => {
                  try { await deleteAccount(); } catch {}
                  await signOut();
                }}
                className="flex-1 py-2.5 bg-destructive text-white rounded-xl text-sm font-bold"
              >
                מחק לצמיתות
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Avatar uploader */}
      {showAvatarUploader && (
        <AvatarUploader
          onDone={(url) => avatarMutation.mutate(url)}
          onCancel={() => setShowAvatarUploader(false)}
        />
      )}
    </div>
  );
};

export default ProfilePage;
