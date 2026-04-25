// LeaguesPage.tsx – דף ליגות
// מציג: ליגות שהמשתמש חבר בהן, ליגות ציבוריות לחיפוש.
// אפשרויות: יצירת ליגה חדשה, הצטרפות לליגה קיימת דרך קוד הזמנה.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getMyLeagues, getLeaderboard, getMyRank, createLeague, joinLeague, searchUsers, getPublicLeagues, joinPublicLeague, getLeagueByInviteCode, League } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Plus, Users, Trophy, Lock, Globe, Medal, ChevronRight, Coins, Flag, Info, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Tab = "leagues" | "leaderboard";

const DEFAULT_DISTRIBUTION = [
  { place: 1, pct: 60 },
  { place: 2, pct: 30 },
  { place: 3, pct: 10 },
];

const KNOWN_COMPETITIONS = [
  { slug: 'fifa.world',      name: 'גביע העולם 2026' },
  { slug: 'uefa.champions',  name: 'ליגת האלופות' },
  { slug: 'eng.1',           name: 'פרמייר ליג' },
  { slug: 'esp.1',           name: 'לה ליגה' },
  { slug: 'ger.1',           name: 'בונדסליגה' },
  { slug: 'ita.1',           name: 'סריה א' },
  { slug: 'fra.1',           name: 'ליג 1' },
];

const LeaguesPage = () => {
  const [tab, setTab] = useState<Tab>("leagues");
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [previewLeague, setPreviewLeague] = useState<League | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [userSearchInput, setUserSearchInput] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { isGuest, exitGuest } = useAuth();
  const hasAttemptedPreview = useRef(false);

  const joinParam = searchParams.get("join");

  useEffect(() => {
    if (joinParam && !hasAttemptedPreview.current && !isGuest) {
      const code = joinParam.toUpperCase();
      setJoinCode(code);
      hasAttemptedPreview.current = true;
      getLeagueByInviteCode(code)
        .then(data => setPreviewLeague(data.league))
        .catch(() => toast.error('קוד הזמנה לא תקין'));
    }
  }, [joinParam, isGuest]);

  // Create form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [format, setFormat] = useState<"pool" | "per_game">("pool");
  const [entryFee, setEntryFee] = useState("0");
  const [minStake, setMinStake] = useState("10");
  const [maxMembers, setMaxMembers] = useState("");
  const [distribution, setDistribution] = useState(DEFAULT_DISTRIBUTION);
  // Tournament modifier
  const [isTournament, setIsTournament] = useState(false);
  const [tournamentSlug, setTournamentSlug] = useState("");
  const [stakePerMatch, setStakePerMatch] = useState("50");
  const [seasonEndDate, setSeasonEndDate] = useState("");
  const [joinPolicy, setJoinPolicy] = useState<"before_start" | "anytime">("before_start");
  const [autoSettle, setAutoSettle] = useState(true);

  const { data: leaguesData, isLoading: leaguesLoading } = useQuery({
    queryKey: ["my-leagues"],
    queryFn: getMyLeagues,
  });

  const { data: previewData, isError: previewIsError, error: previewError } = useQuery({
    queryKey: ["league-preview", joinCode],
    queryFn: () => getLeagueByInviteCode(joinCode),
    enabled: joinCode.length >= 4 && showJoin,
  });

  useEffect(() => {
    if (previewData) {
      setPreviewLeague(previewData.league);
      setShowJoin(false);
    }
  }, [previewData]);

  const { data: leaderboardData, isLoading: lbLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => getLeaderboard(50),
    enabled: tab === "leaderboard",
  });

  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ["user-search", userSearchQuery],
    queryFn: () => searchUsers(userSearchQuery),
    enabled: userSearchQuery.length >= 2,
  });

  const { data: myRankData } = useQuery({
    queryKey: ["my-rank"],
    queryFn: getMyRank,
    enabled: tab === "leaderboard",
  });

  const { data: publicLeaguesData } = useQuery({
    queryKey: ["public-leagues"],
    queryFn: getPublicLeagues,
    staleTime: 60_000,
  });

  const joinPublicMutation = useMutation({
    mutationFn: (id: string) => joinPublicLeague(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["my-leagues"] });
      queryClient.invalidateQueries({ queryKey: ["public-leagues"] });
      navigate(`/leagues/${data.league.id}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createLeague({
        name,
        description: description.trim() || undefined,
        format,
        duration_type: isTournament ? "tournament" : "full_season",
        access_type: 'invite',
        min_bet: format === "per_game" ? (parseInt(minStake) || 10) : 0,
        entry_fee: parseInt(entryFee) || 0,
        max_members: parseInt(maxMembers) > 0 ? parseInt(maxMembers) : undefined,
        distribution: parseInt(entryFee) > 0 ? distribution : undefined,
        is_tournament: isTournament || undefined,
        ...(isTournament && {
          tournament_slug: tournamentSlug === "none" ? undefined : (tournamentSlug || undefined),
          stake_per_match: format === "per_game" ? (parseInt(stakePerMatch) || 0) : 0,
          season_end_date: seasonEndDate || undefined,
          join_policy: joinPolicy,
          auto_settle: autoSettle,
        }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["my-leagues"] });
      setShowCreate(false);
      resetForm();
      navigate(`/leagues/${data.league.id}`);
    },
  });

  const joinMutation = useMutation({
    mutationFn: (overrideCode?: string) => joinLeague(overrideCode || joinCode),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["my-leagues"] });
      setShowJoin(false);
      setPreviewLeague(null);
      setJoinCode("");
      navigate(`/leagues/${data.league.id}`);
    },
  });

  const resetForm = () => {
    setName(""); setDescription(""); setFormat("pool");
    setEntryFee("0"); setMinStake("10"); setMaxMembers("");
    setDistribution(DEFAULT_DISTRIBUTION);
    setIsTournament(false); setTournamentSlug(""); setStakePerMatch("50");
    setSeasonEndDate("");
    setJoinPolicy("before_start"); setAutoSettle(true);
  };

  const distTotal = distribution.reduce((s, d) => s + d.pct, 0);
  const leagues = leaguesData?.leagues ?? [];
  const leaderboard = leaderboardData?.leaderboard ?? [];
  const publicLeagues = (publicLeaguesData?.leagues ?? []).filter(
    pl => !leagues.some(l => l.id === pl.id)
  );

  return (
    <div className="flex flex-col gap-5 pb-24">
      {/* Tabs */}
      <div className="flex border-b border-border px-5 pt-4">
        {(["leagues", "leaderboard"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 pb-2.5 text-sm font-bold transition-colors ${
              tab === t ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
            }`}
          >
            {t === "leagues" ? "🏆 הליגות שלי" : "📊 לידרבורד"}
          </button>
        ))}
      </div>

      {/* Leagues Tab */}
      {tab === "leagues" && (
        <div className="flex flex-col gap-4 px-5">
          <div className="flex items-center gap-2">
            <Button variant="default" size="sm" onClick={() => { if (isGuest) { exitGuest(); return; } setShowCreate(!showCreate); setShowJoin(false); }}>
              <Plus size={16} /> צור ליגה
            </Button>
            <Button variant="outline" size="sm" onClick={() => { if (isGuest) { exitGuest(); return; } setShowJoin(!showJoin); setShowCreate(false); }}>
              הצטרף לליגה
            </Button>
          </div>

          {/* Create Form */}
          {showCreate && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              className="card-kickoff flex flex-col gap-3 overflow-hidden"
            >
              <h3 className="font-bold">ליגה חדשה</h3>

              <input placeholder="שם הליגה" value={name} onChange={(e) => setName(e.target.value)}
                className="bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20" />

              <textarea placeholder="תיאור הליגה (אופציונלי)" value={description} onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none" />

              {/* Format */}
              <div className="flex flex-col gap-1.5">
                <p className="text-xs text-muted-foreground font-medium">פורמט ליגה</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFormat("pool")}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-medium border transition-colors ${
                      format === "pool" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"
                    }`}
                  >
                    <span className="block font-bold">קופה משותפת</span>
                    <span className="opacity-70">ניקוד · חלוקה לפי מקום</span>
                  </button>
                  <button
                    onClick={() => setFormat("per_game")}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-medium border transition-colors ${
                      format === "per_game" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"
                    }`}
                  >
                    <span className="block font-bold">תשלום למשחק</span>
                    <span className="opacity-70">הימור מהמאזן · זוכה שומר</span>
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {format === "pool"
                    ? "ניקוד צבירה — אין ניכוי נקודות. ניצחת → מקבל את יחס הזכייה. הקופה תחולק בסוף לפי הדירוג."
                    : "חברים מהמרים מיתרת הנקודות החופשית שלהם. כל משתתף שומר את מה שזכה."}
                </p>
              </div>

              {/* Tournament modifier */}
              <label className="flex items-center gap-2.5 cursor-pointer bg-secondary rounded-xl px-4 py-3">
                <input type="checkbox" checked={isTournament} onChange={(e) => setIsTournament(e.target.checked)}
                  className="w-4 h-4 accent-primary shrink-0" />
                <div>
                  <span className="text-sm font-bold flex items-center gap-1"><Flag size={13} className="text-primary" /> ליגת טורניר</span>
                  <span className="text-[11px] text-muted-foreground">כל חברי הליגה מהמרים על אותו טורניר</span>
                </div>
              </label>

              {/* Tournament settings */}
              {isTournament && (
                <div className="flex flex-col gap-3 border border-primary/20 rounded-xl p-3 bg-primary/5">
                  <p className="text-xs font-bold text-primary">הגדרות טורניר</p>

                  {/* Competition selector (optional) */}
                  <div className="flex flex-col gap-1">
                    <p className="text-xs text-muted-foreground">תחרות (אופציונלי)</p>
                    <Select value={tournamentSlug || "none"} onValueChange={setTournamentSlug} dir="rtl">
                      <SelectTrigger className="bg-secondary rounded-xl px-4 py-2 text-sm outline-none border-none h-11">
                        <SelectValue placeholder="ללא — ידני" />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="none">ללא — ידני</SelectItem>
                        {KNOWN_COMPETITIONS.map(c => (
                          <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Stake per match — only for per_game */}
                  {format === "per_game" && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground shrink-0">הימור מינימלי למשחק</span>
                      <input type="number" min={0} value={stakePerMatch}
                        onChange={(e) => setStakePerMatch(e.target.value)}
                        className="flex-1 bg-secondary rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                      <span className="text-sm text-muted-foreground shrink-0">נק׳</span>
                    </div>
                  )}



                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground shrink-0">תאריך סיום</span>
                    <input type="date" value={seasonEndDate} onChange={(e) => setSeasonEndDate(e.target.value)}
                      className="flex-1 bg-secondary rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>

                  <div className="flex flex-col gap-1">
                    <p className="text-xs text-muted-foreground">הצטרפות לליגה</p>
                    <div className="flex gap-2">
                      {(["before_start", "anytime"] as const).map(p => (
                        <button key={p} onClick={() => setJoinPolicy(p)}
                          className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${
                            joinPolicy === p ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"
                          }`}>
                          {p === "before_start" ? "לפני תחילת הטורניר בלבד" : "בכל שלב"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={autoSettle} onChange={(e) => setAutoSettle(e.target.checked)}
                      className="w-4 h-4 accent-primary" />
                    <span className="text-sm">סיום וחלוקה אוטומטיים עם סיום הטורניר</span>
                  </label>
                </div>
              )}


              {/* Min stake per game (per_game format, non-tournament) */}
              {format === "per_game" && !isTournament && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground shrink-0">הימור מינימלי למשחק</span>
                  <input type="number" min={1} value={minStake} onChange={(e) => setMinStake(e.target.value)}
                    className="flex-1 bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                  <span className="text-sm text-muted-foreground shrink-0">נק׳</span>
                </div>
              )}

              {/* Max members */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground shrink-0">מקסימום חברים</span>
                <input type="number" min={2} value={maxMembers} onChange={(e) => setMaxMembers(e.target.value)}
                  placeholder="ללא הגבלה"
                  className="flex-1 bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
              </div>

              {/* Entry fee */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground shrink-0">
                  {format === "pool" ? "דמי כניסה (לקופה)" : "דמי כניסה (אופציונלי)"}
                </span>
                <input type="number" min={0} value={entryFee} onChange={(e) => setEntryFee(e.target.value)}
                  placeholder="0"
                  className="flex-1 bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                <span className="text-sm text-muted-foreground shrink-0">נק׳</span>
              </div>

              {/* Distribution — always for pool, for per_game when entry fee > 0 */}
              {(format === "pool" || parseInt(entryFee) > 0) && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-bold text-muted-foreground">חלוקת פרסים (סה״כ: {distTotal}%)</p>
                  {distribution.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground w-16 shrink-0">מקום {d.place}</span>
                      <input type="number" min={0} max={100} value={d.pct}
                        onChange={(e) => setDistribution(prev => prev.map((x, j) => j === i ? { ...x, pct: parseInt(e.target.value) || 0 } : x))}
                        className="flex-1 bg-secondary rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                      <span className="text-sm text-muted-foreground shrink-0">%</span>
                      {i > 0 && (
                        <button onClick={() => setDistribution(prev => prev.filter((_, j) => j !== i))}
                          className="text-muted-foreground hover:text-destructive text-xs px-1">×</button>
                      )}
                    </div>
                  ))}
                  {distribution.length < 5 && (
                    <button
                      onClick={() => setDistribution(prev => [...prev, { place: prev.length + 1, pct: 0 }])}
                      className="text-xs text-primary self-start hover:underline"
                    >
                      + הוסף מקום
                    </button>
                  )}
                  {distTotal !== 100 && (
                    <p className="text-xs text-destructive">סה״כ חייב להיות 100% (כרגע: {distTotal}%)</p>
                  )}
                </div>
              )}

              <Button variant="cta" size="lg" onClick={() => createMutation.mutate()}
                disabled={!name || createMutation.isPending || (parseInt(entryFee) > 0 && distTotal !== 100) || (format === "pool" && distTotal !== 100)}>
                {createMutation.isPending ? "יוצר..." : "צור ליגה"}
              </Button>
              {createMutation.isError && (
                <p className="text-xs text-destructive">{(createMutation.error as any)?.message}</p>
              )}
            </motion.div>
          )}

          {/* Join Form */}
          {showJoin && !previewLeague && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              className="card-kickoff flex flex-col gap-3 overflow-hidden"
            >
              <h3 className="font-bold">הצטרף לליגה</h3>
              <input placeholder="קוד הזמנה" value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 tracking-widest" />
              <Button 
                variant="cta" 
                size="lg" 
                onClick={() => {
                  getLeagueByInviteCode(joinCode)
                    .then(data => setPreviewLeague(data.league))
                    .catch((err) => toast.error(err.message || 'קוד לא תקין'));
                }}
                disabled={!joinCode}>
                המשך לבדיקת ליגה
              </Button>
            </motion.div>
          )}

          {/* League Preview Card */}
          <AnimatePresence>
            {previewLeague && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="card-kickoff border-2 border-primary/30 bg-primary/5 flex flex-col gap-4 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                  <Trophy size={120} />
                </div>

                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-primary font-black uppercase text-[10px] tracking-wider">
                      <Lock size={10} /> הצטרפות לליגה פרטית
                    </div>
                    <h3 className="text-xl font-bold">{previewLeague.name}</h3>
                    <p className="text-xs text-muted-foreground">מאת: @{previewLeague.creator_username}</p>
                  </div>
                  <button onClick={() => setPreviewLeague(null)} className="p-2 hover:bg-secondary rounded-full transition-colors">
                    <X size={20} className="text-muted-foreground" />
                  </button>
                </div>

                {previewLeague.description && (
                  <p className="text-sm text-muted-foreground border-r-2 border-primary/20 pr-3">
                    {previewLeague.description}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-secondary/50 rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase">פורמט</span>
                    <span className="text-sm font-bold flex items-center gap-1.5">
                      {previewLeague.format === 'pool' ? '🏆 קופה משותפת' : '🎯 תשלום למשחק'}
                    </span>
                  </div>
                  <div className="bg-secondary/50 rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase">דמי כניסה</span>
                    <span className="text-sm font-black text-primary flex items-center gap-1">
                      <Coins size={14} /> {previewLeague.entry_fee.toLocaleString()} נק׳
                    </span>
                  </div>
                  <div className="bg-secondary/50 rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase">משתתפים</span>
                    <span className="text-sm font-bold flex items-center gap-1.5">
                      <Users size={14} /> {previewLeague.member_count} {previewLeague.max_members ? `/ ${previewLeague.max_members}` : ''}
                    </span>
                  </div>
                  <div className="bg-secondary/50 rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase">סוג</span>
                    <span className="text-sm font-bold flex items-center gap-1.5">
                      {previewLeague.is_tournament ? (
                        <>🚩 {previewLeague.tournament_name || 'טורניר'}</>
                      ) : '📅 עונה מלאה'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 mt-2">
                  <div className="bg-primary/10 rounded-lg p-2.5 flex items-start gap-2.5">
                    <Info size={16} className="text-primary shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      {previewLeague.is_member ? (
                        <span className="text-primary font-bold">אתה כבר חבר בליגה זו! תוכל להיכנס ולראות את המצב הנוכחי.</span>
                      ) : previewLeague.format === 'pool' 
                        ? 'בליגה זו צוברים ניקוד לאורך זמן. בסוף העונה הקופה תחולק בין המקומות הראשונים.'
                        : `בליגה זו מהמרים מהמאזן האישי. הימור מינימלי: ${previewLeague.min_bet} נק׳.`}
                    </p>
                  </div>
                  
                  <div className="flex gap-2.5">
                    {previewLeague.is_member ? (
                      <Button 
                        variant="default" 
                        className="flex-1 h-12 text-base"
                        onClick={() => navigate(`/leagues/${previewLeague.id}`)}
                      >
                        <span className="flex items-center gap-2">
                          <ChevronRight size={18} /> כנס לליגה שלי
                        </span>
                      </Button>
                    ) : (
                      <Button 
                        variant="cta" 
                        className="flex-1 h-12 text-base shadow-lg shadow-primary/20"
                        onClick={() => joinMutation.mutate(joinCode)}
                        disabled={joinMutation.isPending}
                      >
                        {joinMutation.isPending ? 'מצטרף...' : (
                          <span className="flex items-center gap-2">
                            <Check size={18} /> תאשר לי, אני מצטרף
                          </span>
                        )}
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      className="h-12 w-12 p-0"
                      onClick={() => setPreviewLeague(null)}
                      disabled={joinMutation.isPending}
                    >
                      <X size={20} />
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* League List */}
          {leaguesLoading ? (
            <p className="text-sm text-muted-foreground">טוען ליגות...</p>
          ) : leagues.length === 0 ? (
            <div className="card-kickoff flex flex-col items-center gap-3 py-8 text-center">
              <Trophy size={32} className="text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">עדיין לא חבר בליגות.<br />צור ליגה או הצטרף לאחת!</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {leagues.map((league, i) => (
                <motion.button key={league.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => navigate(`/leagues/${league.id}`)}
                  className="card-kickoff flex items-center gap-3 w-full text-right hover:border-primary/30 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <Trophy size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm flex items-center gap-1">
                      {league.name}
                      {league.access_type === "invite" && <Lock size={11} className="text-muted-foreground" />}
                      {league.status === "finished" && <span className="text-[10px] text-muted-foreground font-normal">· הסתיים</span>}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className="flex items-center gap-0.5"><Users size={11} /> {league.member_count ?? "?"}</span>
                      {league.entry_fee > 0 && <span className="flex items-center gap-0.5"><Coins size={11} /> {league.entry_fee} נק׳</span>}
                      {league.pool_total > 0 && <span>קופה: {league.pool_total.toLocaleString()}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="text-sm font-black text-primary">{(league.points_in_league ?? 0).toLocaleString()} נק׳</p>
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </div>
                </motion.button>
              ))}
            </div>
          )}

          {/* Public Leagues Discovery */}
          {publicLeagues.length > 0 && (
            <div className="flex flex-col gap-3 mt-2">
              <div className="flex items-center gap-2">
                <Globe size={15} className="text-primary" />
                <h3 className="text-sm font-bold">ליגות ציבוריות</h3>
              </div>
              {publicLeagues.map((league, i) => (
                <motion.div key={league.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="card-kickoff flex items-center gap-3 border border-primary/10 bg-primary/2"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Globe size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{league.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className="flex items-center gap-0.5"><Users size={11} /> {league.member_count ?? "?"}</span>
                      {league.entry_fee > 0 && <span className="flex items-center gap-0.5"><Coins size={11} /> {league.entry_fee} נק׳</span>}
                    </p>
                    {league.description && (
                      <p className="text-[11px] text-muted-foreground truncate">{league.description}</p>
                    )}
                  </div>
                  <Button size="sm" variant="outline"
                    className="shrink-0 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
                    disabled={joinPublicMutation.isPending}
                    onClick={() => { if (isGuest) { exitGuest(); return; } joinPublicMutation.mutate(league.id); }}
                  >
                    הצטרף
                  </Button>
                </motion.div>
              ))}
              {joinPublicMutation.isError && (
                <p className="text-xs text-destructive">{(joinPublicMutation.error as any)?.message}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Leaderboard Tab */}
      {tab === "leaderboard" && (
        <div className="flex flex-col gap-3 px-5">
          {/* User search */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="חפש משתמש..."
              value={userSearchInput}
              onChange={e => setUserSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") setUserSearchQuery(userSearchInput); }}
              className="flex-1 bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none"
              dir="rtl"
            />
            <button
              onClick={() => setUserSearchQuery(userSearchInput)}
              className="px-4 py-2.5 bg-secondary rounded-xl text-sm font-bold hover:bg-secondary/80 transition-colors"
            >
              חפש
            </button>
          </div>

          {/* Search results */}
          {userSearchQuery.length >= 2 && (
            <div className="flex flex-col gap-2">
              {searchLoading ? (
                <p className="text-xs text-muted-foreground">מחפש...</p>
              ) : (searchData?.users ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">לא נמצאו משתמשים</p>
              ) : (
                (searchData?.users ?? []).map(u => (
                  <div key={u.id}
                    className="card-kickoff flex items-center gap-3 cursor-pointer hover:bg-secondary/60 transition-colors"
                    onClick={() => navigate(`/profile/${u.username}`)}
                  >
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm shrink-0 overflow-hidden">
                      {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" alt="" /> : <span>👤</span>}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold">{u.display_name || u.username}</p>
                    <p className="text-[10px] text-muted-foreground">@{u.username}</p>
                      <p className="text-xs text-muted-foreground">{u.total_wins}/{u.total_bets} ניצחונות</p>
                    </div>
                    <span className="text-sm font-black text-primary">{Math.floor(u.points_balance).toLocaleString()} נק׳</span>
                  </div>
                ))
              )}
              <button onClick={() => { setUserSearchQuery(""); setUserSearchInput(""); }}
                className="text-xs text-muted-foreground self-start">
                נקה חיפוש ×
              </button>
            </div>
          )}

          {myRankData?.rank && (
            <div className="card-kickoff flex items-center justify-between bg-primary/5 border border-primary/20">
              <span className="text-sm font-bold">הדירוג שלי</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-primary">#{myRankData.rank}</span>
                <span className="text-xs text-muted-foreground">{Math.floor(myRankData.points_balance || 0).toLocaleString()} נק׳</span>
              </div>
            </div>
          )}
          {lbLoading ? (
            <p className="text-sm text-muted-foreground">טוען...</p>
          ) : (
            leaderboard.map((entry, i) => (
              <motion.div key={entry.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="card-kickoff flex items-center gap-3 cursor-pointer hover:bg-secondary/60 transition-colors"
                onClick={() => navigate(`/profile/${entry.username}`)}
              >
                <div className="w-8 text-center">
                  {i === 0 ? <Medal size={18} className="text-yellow-500 mx-auto" /> :
                   i === 1 ? <Medal size={18} className="text-gray-400 mx-auto" /> :
                   i === 2 ? <Medal size={18} className="text-amber-600 mx-auto" /> :
                   <span className="text-sm font-bold text-muted-foreground">#{entry.rank}</span>}
                </div>
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm overflow-hidden shrink-0">
                  {entry.avatar_url ? <img src={entry.avatar_url} className="w-full h-full object-cover" alt="" /> : <span>👤</span>}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold">{entry.display_name || entry.username}</p>
                  <p className="text-[11px] text-muted-foreground/70">@{entry.username}</p>
                  <p className="text-xs text-muted-foreground">{entry.total_wins}/{entry.total_bets} ניצחונות</p>
                </div>
                <span className="text-sm font-black text-primary">{Math.floor(entry.points_balance || 0).toLocaleString()} נק׳</span>
              </motion.div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default LeaguesPage;
