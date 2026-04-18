import { useAuth } from "@/context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMyBets, getMyReferralCode, updateAvatar, updateProfile, deleteAccount, getMyAchievements, getDetailedStats, ACHIEVEMENTS, getWaStatus, linkPhone, verifyPhone, unlinkPhone, setWaOptIn } from "@/lib/api";
import AvatarUploader from "@/components/AvatarUploader";
import { motion } from "framer-motion";
import { LogOut, Copy, Check, Camera, ChevronRight, Pencil, X, Smartphone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";

const ProfilePage = () => {
  const { backendUser, firebaseUser, signOut, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [showAvatarUploader, setShowAvatarUploader] = useState(false);

  // Settings edit state
  const [editField, setEditField] = useState<'username' | 'display_name' | 'password' | null>(null);
  const [fieldValue, setFieldValue] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [fieldSuccess, setFieldSuccess] = useState('');
  const [fieldLoading, setFieldLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const { data: betsData } = useQuery({ queryKey: ["my-bets"], queryFn: () => getMyBets({ limit: 5 }) });
  const { data: referralData } = useQuery({ queryKey: ["my-referral"], queryFn: getMyReferralCode });
  const { data: achievementsData } = useQuery({ queryKey: ["my-achievements"], queryFn: getMyAchievements });
  const { data: detailedStats } = useQuery({ queryKey: ["my-detailed-stats"], queryFn: getDetailedStats });

  const [avatarSaveError, setAvatarSaveError] = useState<string | null>(null);

  // WhatsApp state
  const [waPhone, setWaPhone] = useState("");
  const [waCode, setWaCode] = useState("");
  const [waStep, setWaStep] = useState<"idle" | "awaiting_code">("idle");
  const [waMsg, setWaMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data: waData, refetch: refetchWa } = useQuery({
    queryKey: ["wa-status"],
    queryFn: getWaStatus,
    staleTime: 60_000,
  });

  const waLinkMutation = useMutation({
    mutationFn: () => linkPhone(waPhone),
    onSuccess: (d) => {
      setWaStep("awaiting_code");
      setWaMsg({ ok: true, text: d.debug_code ? `[STUB] קוד: ${d.debug_code}` : 'קוד נשלח לוואטסאפ שלך' });
    },
    onError: (e: any) => setWaMsg({ ok: false, text: e.message }),
  });

  const waVerifyMutation = useMutation({
    mutationFn: () => verifyPhone(waCode),
    onSuccess: (d) => {
      setWaStep("idle"); setWaCode(""); setWaPhone("");
      setWaMsg({ ok: true, text: `✅ ${d.message}` });
      refetchWa();
    },
    onError: (e: any) => setWaMsg({ ok: false, text: e.message }),
  });

  const waUnlinkMutation = useMutation({
    mutationFn: unlinkPhone,
    onSuccess: () => { setWaMsg({ ok: true, text: 'מספר נותק' }); refetchWa(); },
  });

  const waOptInMutation = useMutation({
    mutationFn: (val: boolean) => setWaOptIn(val),
    onSuccess: () => refetchWa(),
  });

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
  // Use settled bets only (won + lost) — excludes pending
  const totalSettled = detailedStats?.summary.total_settled ?? 0;
  const totalWins = detailedStats?.summary.total_wins ?? backendUser?.total_wins ?? 0;
  const winRate = totalSettled > 0 ? `${detailedStats!.summary.win_rate}%` : "—";

  const openEdit = (field: 'username' | 'display_name' | 'password') => {
    setEditField(field);
    setFieldValue(field === 'username' ? (backendUser?.username ?? '') : field === 'display_name' ? (firebaseUser?.displayName ?? '') : '');
    setCurrentPassword('');
    setFieldError('');
    setFieldSuccess('');
  };

  const cancelEdit = () => { setEditField(null); setFieldError(''); setFieldSuccess(''); };

  const saveField = async () => {
    if (!fieldValue.trim()) return;
    setFieldLoading(true);
    setFieldError('');
    setFieldSuccess('');
    try {
      if (editField === 'username') {
        await updateProfile({ username: fieldValue.trim() });
        await refreshUser();
        setFieldSuccess('שם המשתמש עודכן');
      } else if (editField === 'display_name') {
        await updateProfile({ display_name: fieldValue.trim() });
        await refreshUser();
        setFieldSuccess('השם המלא עודכן');
      } else if (editField === 'password') {
        if (!firebaseUser?.email) throw new Error('לא ניתן לעדכן סיסמה');
        const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
        await reauthenticateWithCredential(firebaseUser, credential);
        await updatePassword(firebaseUser, fieldValue);
        setFieldSuccess('הסיסמה עודכנה בהצלחה');
      }
      setTimeout(() => { setEditField(null); setFieldSuccess(''); }, 1500);
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg.includes('wrong-password') || msg.includes('invalid-credential')) setFieldError('הסיסמה הנוכחית שגויה');
      else setFieldError(err?.message || 'שגיאה בעדכון');
    } finally {
      setFieldLoading(false);
    }
  };

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
          <span className="text-xl font-black">{totalWins}/{totalSettled}</span>
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

        {/* Display name */}
        {editField === 'display_name' ? (
          <div className="card-kickoff flex flex-col gap-2">
            <p className="text-xs font-bold text-muted-foreground">שם מלא</p>
            <input value={fieldValue} onChange={e => setFieldValue(e.target.value)}
              className="w-full bg-secondary rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="שם מלא" />
            {fieldError && <p className="text-xs text-destructive">{fieldError}</p>}
            {fieldSuccess && <p className="text-xs text-green-600">{fieldSuccess}</p>}
            <div className="flex gap-2">
              <button onClick={saveField} disabled={fieldLoading} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 text-sm font-bold disabled:opacity-60">{fieldLoading ? 'שומר...' : 'שמור'}</button>
              <button onClick={cancelEdit} className="px-3 py-2 rounded-lg bg-secondary text-sm"><X size={14} /></button>
            </div>
          </div>
        ) : (
          <button onClick={() => openEdit('display_name')} className="card-kickoff flex items-center justify-between">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">שם מלא</p>
              <p className="text-sm font-medium">{firebaseUser?.displayName || '—'}</p>
            </div>
            <Pencil size={15} className="text-muted-foreground" />
          </button>
        )}

        {/* Username */}
        {editField === 'username' ? (
          <div className="card-kickoff flex flex-col gap-2">
            <p className="text-xs font-bold text-muted-foreground">שם משתמש</p>
            <input value={fieldValue} onChange={e => setFieldValue(e.target.value)}
              className="w-full bg-secondary rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="שם משתמש" />
            {fieldError && <p className="text-xs text-destructive">{fieldError}</p>}
            {fieldSuccess && <p className="text-xs text-green-600">{fieldSuccess}</p>}
            <div className="flex gap-2">
              <button onClick={saveField} disabled={fieldLoading} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 text-sm font-bold disabled:opacity-60">{fieldLoading ? 'שומר...' : 'שמור'}</button>
              <button onClick={cancelEdit} className="px-3 py-2 rounded-lg bg-secondary text-sm"><X size={14} /></button>
            </div>
          </div>
        ) : (
          <button onClick={() => openEdit('username')} className="card-kickoff flex items-center justify-between">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">שם משתמש</p>
              <p className="text-sm font-medium">@{backendUser?.username || '—'}</p>
            </div>
            <Pencil size={15} className="text-muted-foreground" />
          </button>
        )}

        {/* Password — only for email/password accounts */}
        {firebaseUser?.providerData.some(p => p.providerId === 'password') && (
          editField === 'password' ? (
            <div className="card-kickoff flex flex-col gap-2">
              <p className="text-xs font-bold text-muted-foreground">שינוי סיסמה</p>
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                className="w-full bg-secondary rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="סיסמה נוכחית" />
              <input type="password" value={fieldValue} onChange={e => setFieldValue(e.target.value)}
                className="w-full bg-secondary rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="סיסמה חדשה (מינ׳ 6 תווים)" />
              {fieldError && <p className="text-xs text-destructive">{fieldError}</p>}
              {fieldSuccess && <p className="text-xs text-green-600">{fieldSuccess}</p>}
              <div className="flex gap-2">
                <button onClick={saveField} disabled={fieldLoading || fieldValue.length < 6} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 text-sm font-bold disabled:opacity-60">{fieldLoading ? 'שומר...' : 'שמור'}</button>
                <button onClick={cancelEdit} className="px-3 py-2 rounded-lg bg-secondary text-sm"><X size={14} /></button>
              </div>
            </div>
          ) : (
            <button onClick={() => openEdit('password')} className="card-kickoff flex items-center justify-between">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">סיסמה</p>
                <p className="text-sm font-medium">••••••••</p>
              </div>
              <Pencil size={15} className="text-muted-foreground" />
            </button>
          )
        )}

        <button
          onClick={() => signOut()}
          className="card-kickoff flex items-center gap-3 text-right text-muted-foreground"
        >
          <LogOut size={18} />
          <span className="text-sm font-medium">התנתק</span>
        </button>
      </section>

      {/* WhatsApp Section */}
      <section className="px-5 flex flex-col gap-3">
        <h2 className="section-label">📱 WhatsApp Bot</h2>
        <div className="card-kickoff flex flex-col gap-3">
          {waData?.phone_verified ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold flex items-center gap-1.5">
                    <Smartphone size={14} className="text-green-500" />
                    מספר מקושר
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{waData.phone_number}</p>
                </div>
                <button
                  onClick={() => waUnlinkMutation.mutate()}
                  disabled={waUnlinkMutation.isPending}
                  className="text-xs text-destructive hover:underline"
                >
                  {waUnlinkMutation.isPending ? "מנתק..." : "נתק"}
                </button>
              </div>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-muted-foreground">קבל הודעות ממשחקים</span>
                <button
                  onClick={() => waOptInMutation.mutate(!waData.wa_opt_in)}
                  className={`w-11 h-6 rounded-full relative transition-colors ${waData.wa_opt_in ? 'bg-primary' : 'bg-border'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-card rounded-full shadow-sm transition-transform ${waData.wa_opt_in ? 'left-0.5' : 'left-[calc(100%-1.375rem)]'}`} />
                </button>
              </label>
            </>
          ) : waStep === "awaiting_code" ? (
            <>
              <p className="text-sm text-muted-foreground">הזן את הקוד שנשלח אליך</p>
              <input
                type="text"
                placeholder="קוד 6 ספרות"
                value={waCode}
                onChange={e => setWaCode(e.target.value)}
                maxLength={6}
                className="bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 tracking-widest text-center"
              />
              <button
                onClick={() => waVerifyMutation.mutate()}
                disabled={waCode.length < 6 || waVerifyMutation.isPending}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold disabled:opacity-50"
              >
                {waVerifyMutation.isPending ? "מאמת..." : "אמת קוד"}
              </button>
              <button onClick={() => { setWaStep("idle"); setWaMsg(null); }} className="text-xs text-muted-foreground text-center">
                ← חזרה
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">קשר את מספר הוואטסאפ שלך כדי להמר ישירות מהקבוצה</p>
              <input
                type="tel"
                placeholder="מספר טלפון (050XXXXXXX)"
                value={waPhone}
                onChange={e => setWaPhone(e.target.value)}
                className="bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                dir="ltr"
              />
              <button
                onClick={() => { setWaMsg(null); waLinkMutation.mutate(); }}
                disabled={!waPhone || waLinkMutation.isPending}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold disabled:opacity-50"
              >
                {waLinkMutation.isPending ? "שולח..." : "שלח קוד אימות"}
              </button>
            </>
          )}
          {waMsg && (
            <p className={`text-xs text-center ${waMsg.ok ? 'text-green-600' : 'text-destructive'}`}>
              {waMsg.text}
            </p>
          )}
        </div>
      </section>

      <section className="px-5 flex flex-col gap-3">
        <h2 className="section-label">⚙️ הגדרות</h2>
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
