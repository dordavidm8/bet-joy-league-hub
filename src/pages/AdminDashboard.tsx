import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  BarChart2, Users, Target, Trophy, Bell, HelpCircle, Settings,
  Search, Plus, Trash2, Send, Star, StarOff, ChevronDown, ChevronUp,
  LogOut, XCircle, ToggleLeft, ToggleRight, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  adminGetStats, adminGetUsers, adminGetBets, adminGetGames, adminGetLeagues,
  adminGetCompetitions, adminGetLog,
  adminAdjustPoints, adminSendNotification, adminGetMiniGameDraft, adminSaveMiniGameDraft,
  adminFeatureGame, adminUnfeatureGame, adminGetGameAnalytics,
  adminLockGame, adminUnlockGame, adminPauseLeague,
  adminGetUserBets, adminCancelBet, adminToggleCompetition,
  adminGetMiniGameQueue, adminUpdateMiniGameQueueDate, adminDeleteMiniGameQueue,
  adminGetAdmins, adminAddAdmin, adminRemoveAdmin,
  AdminUser, AdminBet, AdminGame, AdminLeague, AdminQuizQuestion,
  AdminCompetition, AdminLogEntry, AdminGameAnalyticsQuestion, AdminUserEntry, getGames,
} from "@/lib/api";

export const ADMIN_EMAILS = [
  "nir.dahan2001@gmail.com",
  "dordavidm8@gmail.com",
  "kickoffsportsapp@gmail.com",
];

type Tab = "stats" | "users" | "bets" | "games" | "leagues" | "notifications" | "minigames" | "advanced";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "stats",         label: "סקירה",      icon: <BarChart2 size={14} /> },
  { id: "users",        label: "משתמשים",    icon: <Users size={14} /> },
  { id: "bets",         label: "הימורים",    icon: <Target size={14} /> },
  { id: "games",        label: "משחקים",     icon: <Trophy size={14} /> },
  { id: "leagues",      label: "ליגות",      icon: <Trophy size={14} /> },
  { id: "notifications",label: "התראות",     icon: <Bell size={14} /> },
  { id: "minigames",    label: "אתגרים", icon: <Target size={14} /> },
  { id: "advanced",     label: "מתקדם",      icon: <Settings size={14} /> },
];

const fmt = (n: string | number) => Number(n).toLocaleString("he-IL");
const fmtDate = (s: string) => new Date(s).toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" });
const fmtTime = (s: string) => new Date(s).toLocaleString("he-IL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700", won: "bg-green-100 text-green-700",
    lost: "bg-red-100 text-red-700", active: "bg-blue-100 text-blue-700",
    finished: "bg-gray-100 text-gray-500", scheduled: "bg-purple-100 text-purple-700",
    live: "bg-red-100 text-red-600 animate-pulse", cancelled: "bg-gray-100 text-gray-400",
  };
  return <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${map[status] ?? "bg-gray-100 text-gray-500"}`}>{status}</span>;
};

const Loader = () => <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">טוען...</div>;
const ErrorMsg = ({ msg }: { msg?: string }) => (
  <div className="flex flex-col items-center justify-center py-12 gap-2 text-sm text-destructive bg-destructive/5 rounded-xl border border-destructive/20">
    <span className="text-lg">⚠️</span>
    <p className="font-medium">{msg ?? "שגיאה בטעינת הנתונים"}</p>
    <p className="text-xs text-muted-foreground">בדוק חיבור לשרת ו-ADMIN_EMAILS בסביבה</p>
  </div>
);

// ── Stats Tab ─────────────────────────────────────────────────────────────────
const StatsTab = () => {
  const { data, isLoading, isError } = useQuery({ queryKey: ["admin-stats"], queryFn: adminGetStats });
  if (isLoading) return <Loader />;
  if (isError) return <ErrorMsg />;
  if (!data) return null;
  const { users, bets, leagues, transactions_by_type } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { label: "משתמשים", value: fmt(users.total_users), sub: `+${users.new_today} היום · +${users.new_this_month} החודש`, color: "bg-blue-50 border-blue-200" },
          { label: "הימורים", value: fmt(bets.total_bets), sub: `${bets.pending} ממתינים · ${bets.live_bets} live`, color: "bg-purple-50 border-purple-200" },
          { label: "ניצחונות / הפסדים", value: `${fmt(bets.won)} / ${fmt(bets.lost)}`, sub: `win rate: ${Math.round(Number(bets.won) / Math.max(Number(bets.total_bets), 1) * 100)}%`, color: "bg-green-50 border-green-200" },
          { label: "ליגות פעילות", value: fmt(leagues.active), sub: `סה״כ: ${fmt(leagues.total)}`, color: "bg-amber-50 border-amber-200" },
          { label: "סה״כ הוּמר", value: `${fmt(bets.total_staked)} נק׳`, sub: `שולם: ${fmt(bets.total_paid_out)} נק׳`, color: "bg-rose-50 border-rose-200" },
          { label: "רווח פלטפורמה", value: `${fmt(Number(bets.total_staked) - Number(bets.total_paid_out))} נק׳`, sub: "סטייק מינוס תשלומים", color: "bg-emerald-50 border-emerald-200" },
        ].map((k, i) => (
          <div key={i} className={`border rounded-xl p-3 ${k.color}`}>
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="text-lg font-black mt-0.5 leading-tight">{k.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>
      <div>
        <h3 className="text-sm font-bold mb-2 text-muted-foreground">עסקאות לפי סוג</h3>
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50"><tr>
              <th className="text-right px-3 py-2 font-semibold text-muted-foreground">סוג</th>
              <th className="text-right px-3 py-2 font-semibold text-muted-foreground">עסקאות</th>
              <th className="text-right px-3 py-2 font-semibold text-muted-foreground">נפח (נק׳)</th>
            </tr></thead>
            <tbody>
              {transactions_by_type.map((t, i) => (
                <tr key={i} className="border-t border-border/50">
                  <td className="px-3 py-2 font-mono">{t.type}</td>
                  <td className="px-3 py-2">{fmt(t.count)}</td>
                  <td className="px-3 py-2 font-bold">{fmt(t.volume)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ── Users Tab ─────────────────────────────────────────────────────────────────
const UsersTab = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [adjustUser, setAdjustUser] = useState<AdminUser | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustMsg, setAdjustMsg] = useState("");
  const [viewBetsUser, setViewBetsUser] = useState<AdminUser | null>(null);

  const { data, isLoading, isError } = useQuery({ queryKey: ["admin-users", search], queryFn: () => adminGetUsers(search || undefined) });
  const { data: userBetsData } = useQuery({
    queryKey: ["admin-user-bets", viewBetsUser?.id],
    queryFn: () => adminGetUserBets(viewBetsUser!.id),
    enabled: !!viewBetsUser,
  });

  const cancelBetMutation = useMutation({
    mutationFn: adminCancelBet,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-user-bets", viewBetsUser?.id] }),
  });

  const adjustMutation = useMutation({
    mutationFn: () => adminAdjustPoints(adjustUser!.id, parseInt(adjustAmount), adjustReason),
    onSuccess: (res) => {
      setAdjustMsg(`✅ יתרה חדשה: ${fmt(res.user.points_balance)}`);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setTimeout(() => { setAdjustUser(null); setAdjustMsg(""); setAdjustAmount(""); setAdjustReason(""); }, 2000);
    },
    onError: (e: any) => setAdjustMsg(`❌ ${e.message}`),
  });

  const users = data?.users ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 bg-secondary rounded-xl px-3 py-2">
        <Search size={16} className="text-muted-foreground shrink-0" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="חיפוש לפי שם / אימייל..."
          className="bg-transparent flex-1 text-sm outline-none" />
      </div>

      {isLoading ? <Loader /> : isError ? <ErrorMsg /> : (
        <div className="border rounded-xl overflow-auto">
          <table className="w-full text-xs min-w-[600px]">
            <thead className="bg-muted/50"><tr>
              {["משתמש", "נקודות", "הימורים", "ניצחון%", "הצטרף", "פעולות"].map(h => (
                <th key={h} className="text-right px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-t border-border/50 hover:bg-muted/30">
                  <td className="px-3 py-2"><p className="font-bold">{u.username}</p><p className="text-muted-foreground text-[10px]">{u.email}</p></td>
                  <td className="px-3 py-2 font-bold text-primary">{fmt(u.points_balance)}</td>
                  <td className="px-3 py-2">{u.total_bets}</td>
                  <td className="px-3 py-2">{u.total_bets ? `${Math.round(u.total_wins / u.total_bets * 100)}%` : "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(u.created_at)}</td>
                  <td className="px-3 py-2 flex gap-2 flex-wrap">
                    <button onClick={() => { setAdjustUser(u); setAdjustAmount(""); setAdjustReason(""); setAdjustMsg(""); }}
                      className="text-[11px] text-primary underline whitespace-nowrap">נקודות</button>
                    <button onClick={() => setViewBetsUser(u)}
                      className="text-[11px] text-muted-foreground underline whitespace-nowrap">הימורים</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && !isLoading && <p className="text-center text-sm text-muted-foreground py-6">אין תוצאות</p>}
        </div>
      )}

      {/* Adjust modal */}
      {adjustUser && (
        <Modal onClose={() => setAdjustUser(null)} title={`התאמת נקודות — ${adjustUser.username}`}>
          <p className="text-sm text-muted-foreground mb-3">יתרה נוכחית: {fmt(adjustUser.points_balance)} נק׳</p>
          <input type="number" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)}
            placeholder="סכום (שלילי להפחתה)" className="w-full bg-secondary rounded-xl px-3 py-2 text-sm outline-none mb-2" />
          <input value={adjustReason} onChange={e => setAdjustReason(e.target.value)}
            placeholder="סיבה" className="w-full bg-secondary rounded-xl px-3 py-2 text-sm outline-none mb-3" />
          {adjustMsg && <p className="text-xs mb-2">{adjustMsg}</p>}
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => adjustMutation.mutate()} disabled={!adjustAmount || !adjustReason || adjustMutation.isPending}>
              {adjustMutation.isPending ? "שומר..." : "אישור"}
            </Button>
            <Button variant="outline" onClick={() => setAdjustUser(null)}>ביטול</Button>
          </div>
        </Modal>
      )}

      {/* User bets modal */}
      {viewBetsUser && (
        <Modal onClose={() => setViewBetsUser(null)} title={`הימורים של ${viewBetsUser.username}`} wide>
          <div className="overflow-auto max-h-96">
            <table className="w-full text-xs min-w-[500px]">
              <thead className="bg-muted/50"><tr>
                {["משחק", "בחירה", "סכום", "תוצאה", "סטטוס", "תאריך", ""].map(h => (
                  <th key={h} className="text-right px-2 py-2 font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {(userBetsData?.bets ?? []).map(b => (
                  <tr key={b.id} className="border-t border-border/50">
                    <td className="px-2 py-1.5 text-[11px]">{b.home_team} vs {b.away_team}</td>
                    <td className="px-2 py-1.5 font-medium">{b.selected_outcome}</td>
                    <td className="px-2 py-1.5 font-bold">{fmt(b.stake)}</td>
                    <td className="px-2 py-1.5">{b.actual_payout != null ? fmt(b.actual_payout) : "—"}</td>
                    <td className="px-2 py-1.5"><StatusBadge status={b.status} /></td>
                    <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{fmtTime(b.placed_at)}</td>
                    <td className="px-2 py-1.5">
                      {b.status === "pending" && (
                        <button onClick={() => { if (confirm("לבטל הימור זה?")) cancelBetMutation.mutate(b.id); }}
                          className="text-destructive/60 hover:text-destructive">
                          <XCircle size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ── Bets Tab ──────────────────────────────────────────────────────────────────
const BetsTab = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-bets", statusFilter],
    queryFn: () => adminGetBets(statusFilter || undefined),
    staleTime: 15_000,
  });

  const cancelMutation = useMutation({
    mutationFn: adminCancelBet,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-bets"] }),
  });

  const bets = data?.bets ?? [];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 flex-wrap">
        {["", "pending", "won", "lost", "cancelled"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
            {s === "" ? "הכל" : s}
          </button>
        ))}
      </div>

      {isLoading ? <Loader /> : isError ? <ErrorMsg /> : (
        <div className="border rounded-xl overflow-auto">
          <table className="w-full text-xs min-w-[700px]">
            <thead className="bg-muted/50"><tr>
              {["משתמש", "משחק", "בחירה", "סכום", "odds", "תשלום", "סטטוס", "זמן", ""].map(h => (
                <th key={h} className="text-right px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {bets.map(b => (
                <tr key={b.id} className="border-t border-border/50 hover:bg-muted/30">
                  <td className="px-3 py-2 font-bold">{b.username}</td>
                  <td className="px-3 py-2 text-muted-foreground text-[11px]">{b.home_team} vs {b.away_team}</td>
                  <td className="px-3 py-2">{b.selected_outcome}</td>
                  <td className="px-3 py-2 font-bold">{fmt(b.stake)}</td>
                  <td className="px-3 py-2">{Number(b.odds).toFixed(2)}</td>
                  <td className="px-3 py-2">{b.actual_payout != null ? fmt(b.actual_payout) : fmt(b.potential_payout)}</td>
                  <td className="px-3 py-2"><StatusBadge status={b.status} /></td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtTime(b.placed_at)}</td>
                  <td className="px-3 py-2">
                    {b.status === "pending" && (
                      <button onClick={() => { if (confirm("לבטל הימור זה?")) cancelMutation.mutate(b.id); }}
                        className="text-destructive/60 hover:text-destructive"><XCircle size={14} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {bets.length === 0 && !isLoading && <p className="text-center text-sm text-muted-foreground py-6">אין הימורים</p>}
        </div>
      )}
    </div>
  );
};

// ── Games Tab ─────────────────────────────────────────────────────────────────
const GamesTab = () => {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [featuredGameId, setFeaturedGameId] = useState<string | null>(null);
  const [bonusPct, setBonusPct] = useState("20");
  const [hoursBefore, setHoursBefore] = useState("2");
  const [featMsg, setFeatMsg] = useState("");

  const [searchTeam, setSearchTeam] = useState("");
  const [leagueFilter, setLeagueFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [blockedFilter, setBlockedFilter] = useState<"" | "blocked" | "open">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showAllGames, setShowAllGames] = useState(false);
  const [sortField, setSortField] = useState<"time" | "bets" | "score" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (field: "time" | "bets" | "score") => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-games", showAllGames],
    queryFn: () => adminGetGames(showAllGames),
    staleTime: 30_000,
  });
  const { data: analyticsData } = useQuery({
    queryKey: ["admin-game-analytics", expandedId],
    queryFn: () => adminGetGameAnalytics(expandedId!),
    enabled: !!expandedId,
  });

  const featureMutation = useMutation({
    mutationFn: () => adminFeatureGame(featuredGameId!, parseInt(bonusPct), parseInt(hoursBefore)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-games"] });
      setFeatMsg("✅ המשחק סומן כ-Featured");
      setTimeout(() => { setFeaturedGameId(null); setFeatMsg(""); }, 1500);
    },
    onError: (e: any) => setFeatMsg(`❌ ${e.message}`),
  });

  const unfeatureMutation = useMutation({
    mutationFn: adminUnfeatureGame,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-games"] }),
  });

  const lockMutation = useMutation({
    mutationFn: (id: string) => adminLockGame(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-games"] }),
  });

  const unlockMutation = useMutation({
    mutationFn: (id: string) => adminUnlockGame(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-games"] }),
  });

  const games = data?.games ?? [];
  const featGame = games.find(g => g.id === featuredGameId);

  const uniqueLeagues = Array.from(new Set(games.map(g => g.competition_name).filter(Boolean)));

  let filteredGames = games.filter(g => {
    if (searchTeam) {
      const q = searchTeam.toLowerCase();
      if (!g.home_team.toLowerCase().includes(q) && !g.away_team.toLowerCase().includes(q)) return false;
    }
    if (leagueFilter && g.competition_name !== leagueFilter) return false;
    if (statusFilter && g.status !== statusFilter) return false;
    if (blockedFilter === "blocked" && !(g as any).is_fully_locked) return false;
    if (blockedFilter === "open" && (g as any).is_fully_locked) return false;
    if (dateFrom && new Date(g.start_time) < new Date(dateFrom)) return false;
    if (dateTo && new Date(g.start_time) > new Date(dateTo + "T23:59:59")) return false;
    return true;
  });

  if (sortField) {
    filteredGames.sort((a, b) => {
      let cmp = 0;
      if (sortField === "time") {
        cmp = new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
      } else if (sortField === "bets") {
        cmp = Number(a.total_bets) - Number(b.total_bets);
      } else if (sortField === "score") {
        const scoreA = a.score_home != null ? a.score_home + a.score_away : -1;
        const scoreB = b.score_home != null ? b.score_home + b.score_away : -1;
        cmp = scoreA - scoreB;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 items-center bg-secondary rounded-xl px-3 py-2">
        <div className="flex items-center gap-2 flex-1 min-w-[150px]">
          <Search size={16} className="text-muted-foreground shrink-0" />
          <input value={searchTeam} onChange={e => setSearchTeam(e.target.value)}
            placeholder="חיפוש קבוצה..." className="bg-transparent text-sm outline-none w-full" />
        </div>
        <select value={leagueFilter} onChange={e => setLeagueFilter(e.target.value)}
          className="bg-background border rounded-lg px-2 py-1 text-xs outline-none max-w-[150px]">
          <option value="">כל הליגות</option>
          {uniqueLeagues.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>מ:</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="bg-background border rounded-lg px-2 py-1 outline-none" />
          <span>עד:</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="bg-background border rounded-lg px-2 py-1 outline-none" />
        </div>
        <button
          onClick={() => setShowAllGames(v => !v)}
          className={`text-xs font-bold px-2 py-1 rounded-lg border transition-colors ${showAllGames ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-secondary'}`}
        >
          {showAllGames ? 'טווח רגיל' : 'הצג הכל'}
        </button>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-background border rounded-lg px-2 py-1 text-xs outline-none">
          <option value="">כל הסטטוסים</option>
          <option value="scheduled">scheduled</option>
          <option value="live">live</option>
          <option value="finished">finished</option>
        </select>
        <select value={blockedFilter} onChange={e => setBlockedFilter(e.target.value as any)}
          className="bg-background border rounded-lg px-2 py-1 text-xs outline-none">
          <option value="">הכל</option>
          <option value="blocked">חסום</option>
          <option value="open">פתוח</option>
        </select>
        {(searchTeam || leagueFilter || statusFilter || blockedFilter || dateFrom || dateTo) && (
          <button onClick={() => { setSearchTeam(""); setLeagueFilter(""); setStatusFilter(""); setBlockedFilter(""); setDateFrom(""); setDateTo(""); }}
            className="text-xs text-primary underline">נקה סננים</button>
        )}
      </div>

      {isLoading ? <Loader /> : isError ? <ErrorMsg /> : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50"><tr>
              <th className="px-2 py-2"></th>
              <th className="text-right px-2 py-2 font-semibold text-muted-foreground">משחק</th>
              <th className="text-right px-2 py-2 font-semibold text-muted-foreground">תחרות</th>
              <th className="text-right px-2 py-2 font-semibold text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort("time")}>
                זמן {sortField === "time" ? (sortDir === "asc" ? "↑" : "↓") : "⇅"}
              </th>
              <th className="text-right px-2 py-2 font-semibold text-muted-foreground">סטטוס</th>
              <th className="text-right px-2 py-2 font-semibold text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort("score")}>
                תוצאה {sortField === "score" ? (sortDir === "asc" ? "↑" : "↓") : "⇅"}
              </th>
              <th className="text-right px-2 py-2 font-semibold text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort("bets")}>
                הימורים {sortField === "bets" ? (sortDir === "asc" ? "↑" : "↓") : "⇅"}
              </th>
              <th className="text-right px-2 py-2 font-semibold text-muted-foreground">featured</th>
              <th className="text-right px-2 py-2 font-semibold text-muted-foreground">נעילה</th>
              <th className="text-right px-2 py-2 font-semibold text-muted-foreground">אנליטיקות</th>
            </tr></thead>
            <tbody>
              {filteredGames.map(g => (
                <>
                  <tr key={g.id} className={`border-t border-border/50 hover:bg-muted/30 ${(g as any).is_featured ? "bg-amber-50/50" : ""}`}>
                    <td className="px-2 py-2">
                      {(g as any).is_featured && <Star size={14} className="text-amber-500 fill-amber-500" />}
                    </td>
                    <td className="px-2 py-2 font-bold whitespace-nowrap">
                      {g.home_team} vs {g.away_team}
                      {(g as any).is_featured && (
                        <span className="mr-1 text-[10px] text-amber-600 font-bold">+{(g as any).featured_bonus_pct}%</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-muted-foreground text-[11px]">{g.competition_name ?? "—"}</td>
                    <td className="px-2 py-2 text-muted-foreground whitespace-nowrap">{fmtTime(g.start_time)}</td>
                    <td className="px-2 py-2"><StatusBadge status={g.status} /></td>
                    <td className="px-2 py-2 font-bold">{g.score_home != null ? `${g.score_home}–${g.score_away}` : "—"}</td>
                    <td className="px-2 py-2 font-bold text-primary">{fmt(g.total_bets)}</td>
                    <td className="px-2 py-2">
                      {(g as any).is_featured ? (
                        <button onClick={() => unfeatureMutation.mutate(g.id)}
                          className="text-amber-500 hover:text-amber-700 flex items-center gap-1">
                          <StarOff size={13} />
                        </button>
                      ) : (
                        g.status === "scheduled" && (
                          <button onClick={() => { setFeaturedGameId(g.id); setBonusPct("20"); setHoursBefore("2"); setFeatMsg(""); }}
                            className="text-muted-foreground hover:text-amber-500 flex items-center gap-1">
                            <Star size={13} />
                          </button>
                        )
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {(g as any).question_count > 0 && (
                        <button
                          onClick={() => { if ((g as any).is_fully_locked) unlockMutation.mutate(g.id); else lockMutation.mutate(g.id); }}
                          title={(g as any).is_fully_locked ? "בטל נעילת הימורים" : "נעל הימורים"}
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full border transition-colors ${(g as any).is_fully_locked ? 'bg-red-100 border-red-300 text-red-700' : 'bg-gray-100 border-gray-300 text-gray-500 hover:border-red-300 hover:text-red-700'}`}
                        >
                          {(g as any).is_fully_locked ? '🔒' : '🔓'}
                        </button>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {Number(g.total_bets) > 0 && (
                        <button onClick={() => setExpandedId(expandedId === g.id ? null : g.id)}
                          className="text-primary flex items-center gap-1 text-[11px]">
                          {expandedId === g.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedId === g.id && (
                    <tr key={`${g.id}-analytics`} className="bg-muted/20">
                      <td colSpan={10} className="px-4 py-3">
                        {!analyticsData ? <p className="text-xs text-muted-foreground">טוען...</p> : (
                          <div className="flex flex-col gap-3">
                            {(analyticsData.questions as AdminGameAnalyticsQuestion[]).map((q, qi) => (
                              <div key={qi}>
                                <p className="text-xs font-bold mb-1">{q.question_text}</p>
                                <div className="flex flex-wrap gap-2">
                                  {q.outcomes.map((o, oi) => (
                                    <div key={oi} className="bg-background border rounded-lg px-3 py-1.5 text-center min-w-[100px]">
                                      <p className="text-xs font-bold">{o.outcome}</p>
                                      <p className="text-[11px] text-muted-foreground">{o.bet_count} הימורים</p>
                                      <p className="text-[11px] font-bold text-primary">{fmt(o.total_staked)} נק׳</p>
                                      <p className="text-[10px] text-muted-foreground">{o.pct}%</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                            {analyticsData.questions.length === 0 && <p className="text-xs text-muted-foreground">אין נתונים</p>}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
          {filteredGames.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">אין משחקים</p>}
        </div>
      )}

      {/* Feature modal */}
      {featuredGameId && featGame && (
        <Modal onClose={() => setFeaturedGameId(null)} title="הגדרת משחק מומלץ">
          <p className="text-sm font-bold mb-3">{(featGame as any).home_team} נגד {(featGame as any).away_team}</p>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground shrink-0">בונוס על ה-odds</span>
              <input type="number" min={1} max={500} value={bonusPct} onChange={e => setBonusPct(e.target.value)}
                className="w-20 bg-secondary rounded-xl px-3 py-2 text-sm outline-none text-center" />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground shrink-0">שלח התראה</span>
              <input type="number" min={1} max={48} value={hoursBefore} onChange={e => setHoursBefore(e.target.value)}
                className="w-20 bg-secondary rounded-xl px-3 py-2 text-sm outline-none text-center" />
              <span className="text-sm text-muted-foreground">שעות לפני</span>
            </div>
            <p className="text-xs bg-amber-50 border border-amber-200 rounded-xl p-2 text-amber-700">
              הימור של 100 נק׳ על odds של 2.0 ישלם {Math.floor(100 * 2.0 * (1 + parseInt(bonusPct || "0") / 100))} נק׳ במקום 200
            </p>
            {featMsg && <p className="text-sm">{featMsg}</p>}
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => featureMutation.mutate()} disabled={featureMutation.isPending}>
                {featureMutation.isPending ? "שומר..." : "הגדר כמשחק מומלץ ושלח התראה"}
              </Button>
              <Button variant="outline" onClick={() => setFeaturedGameId(null)}>ביטול</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ── Leagues Tab ───────────────────────────────────────────────────────────────
const LeaguesTab = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [leagueSearch, setLeagueSearch] = useState("");
  const [pauseConfirm, setPauseConfirm] = useState<AdminLeague | null>(null);
  const [pauseMsg, setPauseMsg] = useState("");

  const { data, isLoading, isError } = useQuery({ queryKey: ["admin-leagues"], queryFn: adminGetLeagues, staleTime: 30_000 });
  const leagues = (data?.leagues ?? []).filter((l: AdminLeague) => {
    if (!leagueSearch) return true;
    const q = leagueSearch.toLowerCase();
    return l.name.toLowerCase().includes(q) || l.creator_username?.toLowerCase().includes(q);
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => adminPauseLeague(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-leagues"] });
      setPauseMsg("✅ הליגה הושהתה");
      setTimeout(() => { setPauseConfirm(null); setPauseMsg(""); }, 1500);
    },
    onError: (e: any) => setPauseMsg(`❌ ${e.message}`),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 bg-secondary rounded-xl px-3 py-2">
        <Search size={16} className="text-muted-foreground shrink-0" />
        <input value={leagueSearch} onChange={e => setLeagueSearch(e.target.value)}
          placeholder="חיפוש לפי שם ליגה / יוצר..."
          className="bg-transparent flex-1 text-sm outline-none" />
      </div>

      {isLoading ? <Loader /> : isError ? <ErrorMsg /> : (
        <div className="border rounded-xl overflow-auto">
          <table className="w-full text-xs min-w-[600px]">
            <thead className="bg-muted/50"><tr>
              {["שם", "פורמט", "יוצר", "חברים", "קופה", "סטטוס", "נוצר", ""].map(h => (
                <th key={h} className="text-right px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {leagues.map((l: AdminLeague) => (
                <tr key={l.id} className="border-t border-border/50 hover:bg-muted/30">
                  <td className="px-3 py-2 font-bold cursor-pointer hover:text-primary" onClick={() => navigate(`/leagues/${l.id}`)}>
                    {l.name}
                    {l.tournament_slug && <span className="mr-1 text-primary text-[10px]">🏆{l.tournament_slug}</span>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{l.format}</td>
                  <td className="px-3 py-2">{l.creator_username}</td>
                  <td className="px-3 py-2 font-bold">{fmt(l.member_count)}</td>
                  <td className="px-3 py-2">{fmt(l.pool_total)}</td>
                  <td className="px-3 py-2"><StatusBadge status={l.status} /></td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(l.created_at)}</td>
                  <td className="px-3 py-2">
                    {l.status === "active" && (
                      <button onClick={() => { setPauseConfirm(l); setPauseMsg(""); }}
                        className="text-[11px] text-amber-600 border border-amber-300 bg-amber-50 px-2 py-0.5 rounded-full hover:bg-amber-100 transition-colors">
                        השהה
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {leagues.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">אין ליגות</p>}
        </div>
      )}

      {pauseConfirm && (
        <Modal onClose={() => setPauseConfirm(null)} title={`השהיית ליגה: ${pauseConfirm.name}`}>
          <p className="text-sm text-muted-foreground mb-4">
            האם לשנות את סטטוס הליגה ל-"paused"? חברים לא יוכלו להמר עד שהליגה תחודש.
          </p>
          {pauseMsg && <p className="text-sm mb-3">{pauseMsg}</p>}
          <div className="flex gap-2">
            <Button className="flex-1 bg-amber-500 hover:bg-amber-600" onClick={() => pauseMutation.mutate(pauseConfirm.id)} disabled={pauseMutation.isPending}>
              {pauseMutation.isPending ? "משהה..." : "השהה ליגה"}
            </Button>
            <Button variant="outline" onClick={() => setPauseConfirm(null)}>ביטול</Button>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ── Notifications Tab ─────────────────────────────────────────────────────────
const NotificationsTab = () => {
  const [type, setType] = useState<"special_offer" | "admin_message">("admin_message");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState("all");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const sendMutation = useMutation({
    mutationFn: () => adminSendNotification({ type, title, body, target }),
    onSuccess: (res) => { setResult({ ok: true, text: `✅ נשלח ל-${res.sent_to} משתמשים` }); setTitle(""); setBody(""); setTarget("all"); },
    onError: (e: any) => setResult({ ok: false, text: `❌ ${e.message}` }),
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="border rounded-2xl p-4 flex flex-col gap-4">
        <h3 className="font-bold text-sm">שליחת התראה</h3>
        <div className="flex gap-2">
          {(["admin_message", "special_offer"] as const).map(t => (
            <button key={t} onClick={() => setType(t)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${type === t ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
              {t === "admin_message" ? "📢 הודעת מנהל" : "🎁 הצעה מיוחדת"}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={() => setTarget("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border shrink-0 transition-colors ${target === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
            כולם
          </button>
          <input value={target === "all" ? "" : target} onChange={e => setTarget(e.target.value || "all")}
            placeholder="שם משתמש ספציפי..."
            className="flex-1 bg-secondary rounded-xl px-3 py-1.5 text-sm outline-none" />
        </div>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="כותרת"
          className="bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none" />
        <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="תוכן (אופציונלי)" rows={3}
          className="bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none resize-none" />
        {result && <p className={`text-sm ${result.ok ? "text-green-600" : "text-destructive"}`}>{result.text}</p>}
        <Button onClick={() => { setResult(null); sendMutation.mutate(); }} disabled={!title || sendMutation.isPending}>
          <Send size={15} className="ml-2" />
          {sendMutation.isPending ? "שולח..." : `שלח${target === "all" ? " לכולם" : ` ל-${target}`}`}
        </Button>
      </div>
      <div className="bg-muted/30 rounded-xl p-3 text-xs text-muted-foreground">
        <b className="text-foreground">טיפ:</b> הצעה מיוחדת נשלחת אוטומטית כאשר מגדירים משחק Featured — כאן שלח הודעות ידניות בלבד.
      </div>
    </div>
  );
};

// ── MiniGames Tab (with Trivia) ────────────────────────────────────────────────
const MiniGamesTab = () => {
  const [msg, setMsg] = useState("");
  const [draft, setDraft] = useState<any | null>(null);
  const [selectedType, setSelectedType] = useState<string>("trivia");
  const [triviaCategory, setTriviaCategory] = useState<string>("general");
  const [customTopic, setCustomTopic] = useState<string>("");
  const [customType, setCustomType] = useState<string>("free");
  const [todayGames, setTodayGames] = useState<any[]>([]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    getGames({ from: today, to: today }).then(res => setTodayGames(res.games || []));
  }, []);

  const fetchDraftMutation = useMutation({
    mutationFn: () => adminGetMiniGameDraft(selectedType, selectedType === "trivia" ? { category: triviaCategory, customTopic, customType } : undefined),
    onMutate: () => { setDraft(null); setMsg(""); },
    onSuccess: (data) => { setDraft(data.draft); },
    onError: (e: any) => setMsg(`❌ שגיאה בטעינת החידה: ${e.message}`),
  });

  const queryClient = useQueryClient();

  const { data: queueData, isLoading: queueLoading } = useQuery({
    queryKey: ['admin-minigames-queue'],
    queryFn: adminGetMiniGameQueue,
  });

  const updateDateMutation = useMutation({
    mutationFn: (variables: { id: string, play_date: string }) => adminUpdateMiniGameQueueDate(variables.id, variables.play_date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-minigames-queue"] });
      setMsg("✅ שונה תאריך למשחק בתור.");
    }
  });

  const deleteQueueMutation = useMutation({
    mutationFn: adminDeleteMiniGameQueue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-minigames-queue"] });
      setMsg("🗑️ החידה הוסרה מהתור.");
    }
  });

  const saveMutation = useMutation({
    mutationFn: () => adminSaveMiniGameDraft(draft),
    onSuccess: () => {
      setDraft(null);
      setMsg("✅ המשחק אושר ונשמר בהצלחה למסד הנתונים!");
      queryClient.invalidateQueries({ queryKey: ["admin-minigames-queue"] });
    },
    onError: (e: any) => setMsg(`❌ שגיאה בשמירה: ${e.message}`),
  });

  const MINIGAMES = [
    { id: "trivia", name: "טריוויה יומית (AI)" },
    { id: "missing_xi", name: "Missing XI" },
    { id: "who_are_ya", name: "Who Are Ya?" },
    { id: "career_path", name: "Career Path" },
    { id: "box2box", name: "Box2Box" },
    { id: "guess_club", name: "Guess Club" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="border rounded-2xl p-4 flex flex-col gap-4">
        <div>
          <h3 className="font-bold text-sm">ניהול אתגרים (Challenges)</h3>
          <p className="text-xs text-muted-foreground mt-1">
            ניתן לחולל שאלות עבור המצבים ולהכניס אותן לתור. בכל יום, המשחק במערכת ישלוף את המשחק הראשון בתור עבור כל קטגוריה!
          </p>
        </div>

        {msg && <p className={`text-sm font-bold ${msg.includes("✅") ? "text-green-600" : "text-destructive"}`}>{msg}</p>}

        <div className="flex flex-col gap-2">
          <div className="flex gap-2 items-center">
            <select value={selectedType} onChange={e => { setSelectedType(e.target.value); setDraft(null); }}
              className="bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none appearance-none flex-1 font-bold">
              {MINIGAMES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>

            <Button onClick={() => fetchDraftMutation.mutate()} disabled={fetchDraftMutation.isPending} variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200">
              <Star size={16} className="ml-2 fill-indigo-600" />
              {fetchDraftMutation.isPending ? "טוען..." : "חולל משחק"}
            </Button>
          </div>
          
          {selectedType === "trivia" && (
            <div className="flex bg-secondary/50 rounded-xl px-3 py-2 text-xs items-center gap-2">
              <span className="text-muted-foreground">נושא (ל-AI):</span>
              <select value={triviaCategory} onChange={e => setTriviaCategory(e.target.value)} className="bg-transparent font-bold outline-none flex-1">
                <option value="general">⚽ כללי</option>
                <option value="history">📅 היסטוריה</option>
                <option value="players">🏃‍♂️ שחקנים</option>
                <option value="clubs">🛡️ קבוצות</option>
                <option value="world_cup">🌍 מונדיאל</option>
              </select>
            </div>
          )}
        </div>

        {draft && (
          <div className="flex flex-col gap-3 mt-4 border-t pt-4">
            <h4 className="text-sm font-bold">טיוטה נוכחית ממתינה לאישור:</h4>
            <div className="bg-secondary border rounded-xl p-4 text-sm flex flex-col gap-3">
              {draft.game_type === "trivia" ? (
                <div className="flex flex-col gap-3">
                  <span className="text-xs text-muted-foreground font-bold -mb-2">ערוך שאלה:</span>
                  <input 
                    value={draft.puzzle_data.question_text || ''}
                    onChange={(e) => setDraft({ ...draft, puzzle_data: { ...draft.puzzle_data, question_text: e.target.value }})}
                    className="font-bold text-base bg-background border rounded-lg p-2.5 w-full outline-indigo-500 transition-all"
                  />
                  
                  <span className="text-xs text-muted-foreground font-bold mt-1 -mb-2">ערוך תשובות וסמן את התשובה הנכונה בבחירה מימין:</span>
                  <div className="flex flex-col gap-2">
                    {draft.puzzle_data.options.map((opt: string, i: number) => {
                       const optionLetters = ['A', 'B', 'C', 'D'];
                       const letter = optionLetters[i] || 'A';
                       const isCorrect = draft.solution.secret === letter;
                       return (
                        <div key={i} className="flex gap-3 items-center">
                          <input 
                            type="radio"
                            name="correct_option"
                            checked={isCorrect}
                            onChange={() => setDraft({ ...draft, solution: { secret: letter } })}
                            title={`סמן את ${letter} כתשובה הנכונה`}
                            className="w-5 h-5 cursor-pointer accent-green-600"
                          />
                          <input 
                            value={opt}
                            onChange={(e) => {
                              const newOptions = [...draft.puzzle_data.options];
                              newOptions[i] = e.target.value;
                              setDraft({ ...draft, puzzle_data: { ...draft.puzzle_data, options: newOptions }});
                            }}
                            className={`flex-1 p-2 rounded-lg border text-sm transition-all focus:outline-indigo-500 ${isCorrect ? 'bg-green-50 border-green-400 font-bold text-green-900' : 'bg-background hover:bg-secondary/50'}`}
                          />
                        </div>
                       );
                    })}
                  </div>
                </div>
              ) : draft.game_type === "who_are_ya" ? (
                <div className="flex flex-col gap-3">
                  <div className="flex gap-4 items-center">
                    {draft.puzzle_data.image_url && <img src={draft.puzzle_data.image_url} className="w-20 h-20 rounded-full object-cover border-2" />}
                    <div className="flex flex-col gap-2 flex-1 w-full text-right">
                      <div className="flex gap-2 items-center">
                        <span className="text-xs font-bold w-14">לאומיות:</span>
                        <input value={draft.puzzle_data.nationality} onChange={e => setDraft({ ...draft, puzzle_data: { ...draft.puzzle_data, nationality: e.target.value }})} className="flex-1 text-sm bg-background border px-2 py-1 rounded" />
                      </div>
                      <div className="flex gap-2 items-center">
                        <span className="text-xs font-bold w-14">קבוצה:</span>
                        <input value={draft.puzzle_data.club} onChange={e => setDraft({ ...draft, puzzle_data: { ...draft.puzzle_data, club: e.target.value }})} className="flex-1 text-sm bg-background border px-2 py-1 rounded" />
                      </div>
                      <div className="flex gap-2 items-center">
                        <span className="text-xs font-bold w-14">עמדה:</span>
                        <input value={draft.puzzle_data.position} onChange={e => setDraft({ ...draft, puzzle_data: { ...draft.puzzle_data, position: e.target.value }})} className="flex-1 text-sm bg-background border px-2 py-1 rounded" />
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 border-t flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground font-bold">השחקן המסתתר (הפתרון):</span>
                    <input 
                      value={draft.solution.secret}
                      onChange={(e) => setDraft({ ...draft, solution: { ...draft.solution, secret: e.target.value }})}
                      className="font-bold text-base bg-background border rounded-lg p-2 outline-indigo-500 transition-all text-green-700" 
                    />
                    <span className="text-[10px] text-muted-foreground leading-tight mt-1">
                      * המערכת חכמה ויודעת לקבל כשגיאות כתיב קלות, אותיות קטנות/גדולות, חלק מהשם בלבד (מעל 3 אותיות), וכינויים נבחרים אוטומטית כפי שהם מקודדים במשחק. אין צורך להזין את כל הווריאציות.
                    </span>
                  </div>
                </div>
              ) : draft.game_type === "guess_club" ? (
                <div className="flex flex-col gap-3 items-center text-center">
                  <img src={draft.puzzle_data.logo_data || draft.puzzle_data.image_url} className="w-24 h-24 object-contain" />
                  <div className="pt-2 border-t flex flex-col gap-1 w-full text-right">
                    <span className="text-xs text-muted-foreground font-bold">שם המועדון (הפתרון):</span>
                    <input 
                      value={draft.solution.secret}
                      onChange={(e) => setDraft({ ...draft, solution: { ...draft.solution, secret: e.target.value }})}
                      className="font-bold text-base bg-background border rounded-lg p-2 outline-indigo-500 transition-all text-green-700" 
                    />
                    <span className="text-[10px] text-muted-foreground leading-tight mt-1">
                      * המערכת חכמה ויודעת לקבל מילות מפתח מתוך שם הקבוצה, השמטת United/City/FC ועוד.
                    </span>
                  </div>
                </div>
              ) : draft.game_type === "career_path" ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2 items-center">
                    {draft.puzzle_data.transfers?.map((t: any, i: number) => (
                       <div key={i} className="flex items-center gap-2">
                         <div className="flex flex-col items-center bg-background border rounded-lg p-2 min-w-[80px]">
                           <span className="text-[10px] text-muted-foreground">{t.season || ''}</span>
                           <span className="text-xs font-bold text-center leading-tight">{t.club}</span>
                         </div>
                         {i < draft.puzzle_data.transfers.length - 1 && <span className="text-muted-foreground text-xs">→</span>}
                       </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t flex flex-col gap-1 w-full text-right">
                    <span className="text-xs text-muted-foreground font-bold">השחקן המסתתר (הפתרון):</span>
                    <input 
                      value={draft.solution.secret}
                      onChange={(e) => setDraft({ ...draft, solution: { ...draft.solution, secret: e.target.value }})}
                      className="font-bold text-base bg-background border rounded-lg p-2 outline-indigo-500 transition-all text-green-700" 
                    />
                    <span className="text-[10px] text-muted-foreground leading-tight mt-1">
                      * השחקנים מוקלדים תמיד באנגלית. המערכת תזהה שם חלקי, שגיאות והחלפת תווים מיוחדים.
                    </span>
                  </div>
                </div>
              ) : draft.game_type === "box2box" ? (
                <div className="flex flex-col gap-3">
                  <div className="flex gap-4 items-center justify-center p-4 bg-secondary rounded-xl border border-indigo-100">
                    <div className="text-sm font-black text-center flex-1">{draft.puzzle_data.team1}</div>
                    <div className="text-lg font-bold text-indigo-500">X</div>
                    <div className="text-sm font-black text-center flex-1">{draft.puzzle_data.team2}</div>
                  </div>
                  <div className="pt-2 border-t flex flex-col gap-1 w-full text-right">
                    <span className="text-xs text-muted-foreground font-bold">השחקן המסתתר (הפתרון):</span>
                    <input 
                      value={draft.solution.secret}
                      onChange={(e) => setDraft({ ...draft, solution: { ...draft.solution, secret: e.target.value }})}
                      className="font-bold text-base bg-background border rounded-lg p-2 outline-indigo-500 transition-all text-green-700" 
                    />
                    <span className="text-[10px] text-muted-foreground leading-tight mt-1">
                      * המערכת חכמה ויודעת לקבל כשגיאות כתיב קלות, אותיות קטנות/גדולות, חלק מהשם בלבד (מעל 4 אותיות), וכינויים כמו רונאלדו. אין צורך להזין את כל הווריאציות.
                    </span>
                  </div>
                </div>
              ) : draft.game_type === "missing_xi" ? (
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2 items-center font-bold text-lg">
                    {draft.puzzle_data.teamLogo && <img src={draft.puzzle_data.teamLogo} className="w-8 h-8 object-contain" />}
                    <span>{draft.puzzle_data.teamName}</span>
                  </div>
                  <span className="text-xs text-muted-foreground -mt-2">{draft.puzzle_data.matchContext} • מערך: {draft.puzzle_data.formation}</span>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {draft.puzzle_data.players?.map((p: any, i: number) => (
                       <div key={i} className={`flex items-center gap-2 p-1.5 border rounded-md text-xs ${p.name === '???' ? 'bg-indigo-50 border-indigo-300' : 'bg-background'}`}>
                          <span className="font-mono bg-secondary px-1.5 py-0.5 rounded text-[10px]">{p.shirt}</span>
                          <span className={`${p.name === '???' ? 'font-black text-indigo-700' : ''}`}>{p.name}</span>
                       </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t flex flex-col gap-1 w-full text-right">
                    <span className="text-xs text-muted-foreground font-bold">השחקן החסר (הפתרון):</span>
                    <input 
                      value={draft.solution.secret}
                      onChange={(e) => setDraft({ ...draft, solution: { ...draft.solution, secret: e.target.value }})}
                      className="font-bold text-base bg-background border rounded-lg p-2 outline-indigo-500 transition-all text-green-700" 
                    />
                    <span className="text-[10px] text-muted-foreground leading-tight mt-1">
                      * המערכת חכמה ומזהה שחקנים גם אם התשובה לא מושלמת או קצרה מלקוחת משם המשפחה (למעלה מ-4 תווים).
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <pre className="overflow-x-auto text-[11px] w-full" style={{ maxHeight: "250px" }}>
                    {JSON.stringify(draft.puzzle_data, null, 2)}
                  </pre>
                  <div className="mt-auto pt-2 border-t font-bold flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground font-bold text-right">תשובה נכונה / פתרון:</span>
                    <input 
                      value={typeof draft.solution.secret === 'string' ? draft.solution.secret : JSON.stringify(draft.solution.secret)}
                      onChange={(e) => setDraft({ ...draft, solution: { ...draft.solution, secret: e.target.value }})}
                      className="font-bold text-base bg-background border rounded-lg p-2 outline-indigo-500 transition-all text-green-700"
                    />
                  </div>
                </>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="flex-1 bg-green-600 hover:bg-green-700 text-white shadow-lg">
                {saveMutation.isPending ? "שומר בתור..." : "✅ אשר משחק ושלח לתור (Queue)"}
              </Button>
              <Button onClick={() => setDraft(null)} variant="outline">
                בטל טיוטה מחיקה
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Queue Section */}
      <div className="border rounded-2xl p-4 flex flex-col gap-4 bg-muted/10">
        <div>
          <h3 className="font-bold text-sm">תור משחקים שאושרו (Upcoming Queue)</h3>
          <p className="text-xs text-muted-foreground mt-1">
            מציג רק את המשחקים העתידיים עבור המצב הנבחר כרגע.
          </p>
        </div>

        {queueLoading ? (
           <div className="text-muted-foreground text-xs font-bold animate-pulse">טוען תור...</div>
        ) : queueData?.queue ? (
          (() => {
            const todayStr = new Date().toISOString().split('T')[0];
            const filteredQueue = queueData.queue.filter((q: any) => {
              const playDate = new Date(q.play_date).toISOString().split('T')[0];
              const isPast = new Date(playDate) < new Date(todayStr);
              return q.game_type === selectedType && !isPast;
            });

            if (filteredQueue.length === 0) {
              return <div className="text-muted-foreground text-xs">אין משחקים בתור עבור קטגוריה זו.</div>;
            }

            return (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-right text-xs">
                   <thead className="bg-secondary text-[10px] uppercase font-bold text-muted-foreground">
                     <tr>
                       <th className="px-3 py-2">סוג משחק</th>
                       <th className="px-3 py-2 text-center">הפתרון (סוד)</th>
                       <th className="px-3 py-2 w-32 border-r">תאריך שידור</th>
                       <th className="px-3 py-2 w-10"></th>
                     </tr>
                   </thead>
                   <tbody className="divide-y bg-background font-medium">
                     {filteredQueue.map((q: any) => {
                       const t = MINIGAMES.find(m => m.id === q.game_type)?.name || q.game_type;
                       const playDate = new Date(q.play_date).toISOString().split('T')[0];
                       const secret = typeof q.solution.secret === 'string' ? q.solution.secret : JSON.stringify(q.solution.secret);
                       return (
                         <tr key={q.id}>
                           <td className="px-3 py-2">{t}</td>
                           <td className="px-3 py-2 text-center text-indigo-700 max-w-[150px] truncate">{secret}</td>
                           <td className="px-3 py-2 border-r">
                              <input 
                                type="date" 
                                disabled={updateDateMutation.isPending}
                                value={playDate}
                                onChange={(e) => updateDateMutation.mutate({ id: q.id, play_date: e.target.value })}
                                className="bg-transparent outline-none w-full cursor-pointer text-[11px]" 
                              />
                           </td>
                           <td className="px-3 py-1">
                              <button onClick={() => { if(confirm('למחוק עתידית?')) deleteQueueMutation.mutate(q.id); }} className="p-1.5 hover:bg-destructive/10 text-destructive rounded block mx-auto transition-colors">
                                <Trash2 size={12} />
                              </button>
                           </td>
                         </tr>
                       )
                     })}
                   </tbody>
                </table>
              </div>
            );
          })()
        ) : (
           <div className="text-muted-foreground text-xs">שגיאה בטעינת התור.</div>
        )}
      </div>
    </div>
  );
};

// ── Advanced Tab ──────────────────────────────────────────────────────────────
const AdvancedTab = () => {
  const queryClient = useQueryClient();
  const [section, setSection] = useState<"competitions" | "log" | "admins">("competitions");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [adminMsg, setAdminMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data: compsData, isLoading: compsLoading } = useQuery({
    queryKey: ["admin-competitions"], queryFn: adminGetCompetitions, enabled: section === "competitions",
  });
  const { data: logData, isLoading: logLoading } = useQuery({
    queryKey: ["admin-log"], queryFn: adminGetLog, enabled: section === "log", staleTime: 10_000,
  });
  const { data: adminsData, isLoading: adminsLoading } = useQuery({
    queryKey: ["admin-admins"], queryFn: adminGetAdmins, enabled: section === "admins",
  });

  const toggleMutation = useMutation({
    mutationFn: adminToggleCompetition,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-competitions"] }),
  });

  const addAdminMutation = useMutation({
    mutationFn: () => adminAddAdmin(newAdminEmail.trim()),
    onSuccess: () => {
      setAdminMsg({ ok: true, text: `✅ ${newAdminEmail} נוסף כמנהל` });
      setNewAdminEmail("");
      queryClient.invalidateQueries({ queryKey: ["admin-admins"] });
    },
    onError: (e: any) => setAdminMsg({ ok: false, text: `❌ ${e.message}` }),
  });

  const removeAdminMutation = useMutation({
    mutationFn: adminRemoveAdmin,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-admins"] }),
    onError: (e: any) => setAdminMsg({ ok: false, text: `❌ ${e.message}` }),
  });

  const ACTION_LABELS: Record<string, string> = {
    feature_game: "📌 Featured משחק", unfeature_game: "⬜ הסרת Featured",
    cancel_bet: "❌ ביטול הימור", adjust_points: "💰 התאמת נקודות",
    toggle_competition: "🔄 שינוי תחרות",
    add_admin: "👤 הוספת מנהל", remove_admin: "🗑 הסרת מנהל",
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {(["competitions", "admins", "log"] as const).map(s => (
          <button key={s} onClick={() => setSection(s)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${section === s ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
            {s === "competitions" ? "⚽ תחרויות" : s === "admins" ? "🔑 מנהלים" : "📋 לוג פעולות"}
          </button>
        ))}
      </div>

      {section === "competitions" && (
        compsLoading ? <Loader /> : (
          <div className="flex flex-col gap-2">
            {(compsData?.competitions ?? []).map(c => (
              <div key={c.id} className="border rounded-xl p-3 flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-bold">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.slug} · {c.game_count} משחקים · {c.upcoming} קרובים</p>
                </div>
                <button onClick={() => toggleMutation.mutate(c.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                    c.is_active ? "bg-green-100 border-green-300 text-green-700" : "bg-gray-100 border-gray-300 text-gray-500"
                  }`}>
                  {c.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  {c.is_active ? "פעיל" : "כבוי"}
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {section === "admins" && (
        <div className="flex flex-col gap-4">
          <div className="border rounded-2xl p-4 flex flex-col gap-3">
            <h3 className="text-sm font-bold">הוסף מנהל חדש</h3>
            <p className="text-xs text-muted-foreground">המנהל יוכל להיכנס ל-dashboard ולגשת לכל הנתונים.</p>
            <div className="flex gap-2">
              <input
                value={newAdminEmail}
                onChange={e => { setNewAdminEmail(e.target.value); setAdminMsg(null); }}
                placeholder="כתובת אימייל..."
                type="email"
                className="flex-1 bg-secondary rounded-xl px-3 py-2 text-sm outline-none"
              />
              <Button onClick={() => addAdminMutation.mutate()} disabled={!newAdminEmail.trim() || addAdminMutation.isPending}>
                <Plus size={14} className="ml-1" />
                {addAdminMutation.isPending ? "מוסיף..." : "הוסף"}
              </Button>
            </div>
            {adminMsg && <p className={`text-sm ${adminMsg.ok ? "text-green-600" : "text-destructive"}`}>{adminMsg.text}</p>}
          </div>

          <div className="border rounded-2xl p-4 flex flex-col gap-3">
            <h3 className="text-sm font-bold">מנהלים קיימים</h3>
            {adminsLoading ? <Loader /> : (
              <div className="flex flex-col gap-2">
                {(adminsData?.admins ?? []).map((a: AdminUserEntry) => (
                  <div key={a.email} className="flex items-center gap-3 border rounded-xl px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.email}</p>
                      <p className="text-[11px] text-muted-foreground">
                        נוסף על ידי {a.added_by === "system" ? "הגדרות סביבה" : a.added_by} · {fmtDate(a.added_at)}
                      </p>
                    </div>
                    {a.added_by !== "system" && (
                      <button
                        onClick={() => { if (confirm(`להסיר את ${a.email} מהמנהלים?`)) removeAdminMutation.mutate(a.email); }}
                        className="text-destructive/50 hover:text-destructive shrink-0"
                        disabled={removeAdminMutation.isPending}
                      >
                        <XCircle size={16} />
                      </button>
                    )}
                    {a.added_by === "system" && (
                      <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full shrink-0">ראשי</span>
                    )}
                  </div>
                ))}
                {(adminsData?.admins ?? []).length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-4">אין מנהלים</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {section === "log" && (
        logLoading ? <Loader /> : (
          <div className="flex flex-col gap-2">
            {(logData?.log ?? []).map(entry => (
              <div key={entry.id} className="border rounded-xl p-3 flex items-start gap-3">
                <Activity size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{ACTION_LABELS[entry.action] ?? entry.action}</p>
                  <p className="text-xs text-muted-foreground">{entry.admin_email}</p>
                  {entry.details && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 font-mono truncate">
                      {JSON.stringify(entry.details)}
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">{fmtTime(entry.created_at)}</span>
              </div>
            ))}
            {(logData?.log ?? []).length === 0 && <p className="text-center text-sm text-muted-foreground py-6">אין פעולות עדיין</p>}
          </div>
        )
      )}
    </div>
  );
};

// ── Shared Modal ──────────────────────────────────────────────────────────────
const Modal = ({ onClose, title, children, wide }: {
  onClose: () => void; title: string; children: React.ReactNode; wide?: boolean;
}) => (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
    <div className={`bg-background rounded-2xl p-5 w-full ${wide ? "max-w-2xl" : "max-w-sm"} max-h-[85vh] overflow-y-auto`}
      onClick={e => e.stopPropagation()}>
      <h3 className="font-bold mb-4">{title}</h3>
      {children}
    </div>
  </div>
);

// ── Main ──────────────────────────────────────────────────────────────────────
const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState<Tab>("stats");
  const navigate = useNavigate();

  const content: Record<Tab, React.ReactNode> = {
    stats: <StatsTab />, users: <UsersTab />, bets: <BetsTab />,
    games: <GamesTab />, leagues: <LeaguesTab />, notifications: <NotificationsTab />,
    minigames: <MiniGamesTab />, advanced: <AdvancedTab />,
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-black">Kickoff</span>
            <span className="text-xs bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">Admin</span>
          </div>
          <button onClick={() => navigate("/")} className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground">
            <LogOut size={14} /> חזור
          </button>
        </div>
        <div className="max-w-6xl mx-auto px-4 flex overflow-x-auto gap-1 pb-2 scrollbar-hide">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
              }`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 py-6">{content[activeTab]}</div>
    </div>
  );
};

export default AdminDashboard;
