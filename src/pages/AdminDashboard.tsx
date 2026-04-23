// AdminDashboard.tsx – לוח ניהול
// גישה: admin בלבד (AdminRoute ב-App.tsx).
// 8 לשוניות: סקירה, משתמשים, הימורים, משחקים, ליגות, התראות, אתגרים, מתקדם.
// כולל: AdvisorTab (הגדרות AI), SocialAgentTab (pipeline מדיה חברתית).
import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  BarChart2, Users, Target, Trophy, Bell, HelpCircle, Settings,
  Search, Plus, Trash2, Send, Star, StarOff, ChevronDown, ChevronUp,
  LogOut, XCircle, ToggleLeft, ToggleRight, Activity, X, Check, Bot, Flag
} from "lucide-react";
import { AdvisorTab } from "@/components/admin/AdvisorTab";
import { SocialAgentTab } from "@/components/admin/SocialAgentTab";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const KNOWN_COMPETITIONS = [
  { slug: 'fifa.world',      name: 'גביע העולם 2026' },
  { slug: 'uefa.champions',  name: 'ליגת האלופות' },
  { slug: 'eng.1',           name: 'פרמייר ליג' },
  { slug: 'esp.1',           name: 'לה ליגה' },
  { slug: 'ger.1',           name: 'בונדסליגה' },
  { slug: 'ita.1',           name: 'סריה א' },
  { slug: 'fra.1',           name: 'ליג 1' },
];
import {
  adminGetStats, adminGetUsers, adminGetBets, adminGetGames, adminGetLeagues,
  adminGetCompetitions, adminGetLog,
  adminAdjustPoints, adminSendNotification, adminGetMiniGameDraft, adminSaveMiniGameDraft,
  adminFeatureGame, adminUnfeatureGame, adminGetGameAnalytics,
  adminLockGame, adminUnlockGame, adminPauseLeague, adminStopLeague, adminUpdateGameOdds, adminUpdateUser, adminDeleteUser,
  adminRemoveWaGroup, adminSetWaInviteLink, adminUnlinkPhone,
  adminGetUserBets, adminCancelBet, adminToggleCompetition,
  adminGetMiniGameQueue, adminUpdateMiniGameQueueDate, adminDeleteMiniGameQueue,
  adminGetAdmins, adminAddAdmin, adminRemoveAdmin,
  adminGetTeamTranslations, adminApproveTeamTranslation, adminDismissTeamTranslation, adminRegenerateBetQuestions, adminOddsDebug, adminRunSettlement,
  adminGetSupportInquiries, adminUpdateSupportStatus, adminReplyToSupport,
  createLeague,
  AdminUser, AdminBet, AdminGame, AdminLeague, AdminQuizQuestion,
  AdminCompetition, AdminLogEntry, AdminGameAnalyticsQuestion, AdminUserEntry, getGames,
} from "@/lib/api";

export const ADMIN_EMAILS = [
  "nir.dahan2001@gmail.com",
  "dordavidm8@gmail.com",
  "kickoffsportsapp@gmail.com",
];

type Tab = "stats" | "users" | "bets" | "games" | "leagues" | "notifications" | "minigames" | "support" | "advanced" | "advisor" | "social";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "stats",         label: "סקירה",      icon: <BarChart2 size={14} /> },
  { id: "users",        label: "משתמשים",    icon: <Users size={14} /> },
  { id: "bets",         label: "הימורים",    icon: <Target size={14} /> },
  { id: "games",        label: "משחקים",     icon: <Trophy size={14} /> },
  { id: "leagues",      label: "ליגות",      icon: <Trophy size={14} /> },
  { id: "notifications",label: "התראות",     icon: <Bell size={14} /> },
  { id: "support",      label: "פניות",      icon: <HelpCircle size={14} /> },
  { id: "minigames",    label: "אתגרים",     icon: <Target size={14} /> },
  { id: "advanced",     label: "מתקדם",      icon: <Settings size={14} /> },
  { id: "advisor",      label: "יועץ AI",        icon: <Bot size={14} /> },
  { id: "social",       label: "סוכני סושיאל 🤖", icon: <Bot size={14} /> },
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
    postponed: "bg-orange-100 text-orange-700", paused: "bg-amber-100 text-amber-700",
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
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editMsg, setEditMsg] = useState("");
  const [deleteUserConfirm, setDeleteUserConfirm] = useState<AdminUser | null>(null);
  const [deleteUserMsg, setDeleteUserMsg] = useState("");

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

  const editUserMutation = useMutation({
    mutationFn: () => adminUpdateUser(editUser!.id, {
      username: editUsername.trim() || undefined,
      display_name: editDisplayName,
    }),
    onSuccess: () => {
      setEditMsg("✅ פרטים עודכנו");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setTimeout(() => { setEditUser(null); setEditMsg(""); }, 1500);
    },
    onError: (e: any) => setEditMsg(`❌ ${e.message}`),
  });

  const deleteUserMutation = useMutation({
    mutationFn: () => adminDeleteUser(deleteUserConfirm!.id),
    onSuccess: () => {
      setDeleteUserMsg("✅ המשתמש נמחק");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setTimeout(() => { setDeleteUserConfirm(null); setDeleteUserMsg(""); }, 1500);
    },
    onError: (e: any) => setDeleteUserMsg(`❌ ${e.message}`),
  });

  const unlinkPhoneMutation = useMutation({
    mutationFn: (userId: string) => adminUnlinkPhone(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
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
          <table className="w-full text-xs min-w-[650px]">
            <thead className="bg-muted/50"><tr>
              {["משתמש", "שם מלא", "טלפון", "נקודות", "הימורים", "ניצחון%", "הצטרף", "פעולות"].map(h => (
                <th key={h} className="text-right px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-t border-border/50 hover:bg-muted/30">
                  <td className="px-3 py-2"><p className="font-bold">@{u.username.toLowerCase()}</p><p className="text-muted-foreground text-[10px]">{u.email}</p></td>
                  <td className="px-3 py-2 text-muted-foreground">{u.display_name || "—"}</td>
                  <td className="px-3 py-2">
                    {u.phone_number ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] font-mono text-green-700">{u.phone_number} {u.phone_verified ? '✅' : '⚠️'}</span>
                        <span className={`text-[9px] font-bold ${u.wa_opt_in ? 'text-green-500' : 'text-muted-foreground'}`}>
                          {u.wa_opt_in ? 'WhatsApp: ✅' : 'WhatsApp: 🔕'}
                        </span>
                      </div>
                    ) : <span className="text-[11px] text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 font-bold text-primary">{fmt(u.points_balance)}</td>
                  <td className="px-3 py-2">{u.total_bets}</td>
                  <td className="px-3 py-2">{u.total_bets ? `${Math.round(u.total_wins / u.total_bets * 100)}%` : "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(u.created_at)}</td>
                  <td className="px-3 py-2 flex gap-2 flex-wrap">
                    <button onClick={() => { setEditUser(u); setEditUsername(u.username); setEditDisplayName(u.display_name || ""); setEditMsg(""); }}
                      className="text-[11px] text-blue-600 underline whitespace-nowrap">ערוך</button>
                    <button onClick={() => { setAdjustUser(u); setAdjustAmount(""); setAdjustReason(""); setAdjustMsg(""); }}
                      className="text-[11px] text-primary underline whitespace-nowrap">נקודות</button>
                    <button onClick={() => setViewBetsUser(u)}
                      className="text-[11px] text-muted-foreground underline whitespace-nowrap">הימורים</button>
                    <button onClick={() => { setDeleteUserConfirm(u); setDeleteUserMsg(""); }}
                      className="text-[11px] text-destructive underline whitespace-nowrap">מחק</button>
                    {u.phone_number && (
                      <button onClick={() => { if (confirm(`לנתק טלפון של ${u.username}?`)) unlinkPhoneMutation.mutate(u.id); }}
                        className="text-[11px] text-orange-600 underline whitespace-nowrap">נתק טלפון</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && !isLoading && <p className="text-center text-sm text-muted-foreground py-6">אין תוצאות</p>}
        </div>
      )}

      {/* Edit user modal */}
      {editUser && (
        <Modal onClose={() => setEditUser(null)} title={`עריכת פרטי משתמש — @${editUser.username}`}>
          <p className="text-xs text-muted-foreground mb-3">{editUser.email}</p>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">שם משתמש (username)</label>
              <input value={editUsername} onChange={e => setEditUsername(e.target.value.replace(/\s+/g, '').toLowerCase())}
                placeholder="username"
                className="bg-secondary rounded-xl px-3 py-2 text-sm outline-none" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground">שם מלא (display name)</label>
              <input value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)}
                placeholder="שם מלא"
                className="bg-secondary rounded-xl px-3 py-2 text-sm outline-none" />
            </div>
            {editMsg && <p className="text-xs">{editMsg}</p>}
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => editUserMutation.mutate()} disabled={editUserMutation.isPending}>
                {editUserMutation.isPending ? "שומר..." : "שמור שינויים"}
              </Button>
              <Button variant="outline" onClick={() => setEditUser(null)}>ביטול</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete user modal */}
      {deleteUserConfirm && (
        <Modal onClose={() => setDeleteUserConfirm(null)} title={`🗑️ מחיקת משתמש`}>
          <p className="text-sm font-bold mb-1">@{deleteUserConfirm.username}</p>
          <p className="text-xs text-muted-foreground mb-3">{deleteUserConfirm.email}</p>
          <p className="text-xs bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3 text-red-800">
            פעולה זו תאנונם את חשבון המשתמש ותבטל את כל חברויותיו בליגות. לא ניתן לבטל.
          </p>
          {deleteUserMsg && <p className="text-sm mb-2">{deleteUserMsg}</p>}
          <div className="flex gap-2">
            <Button variant="destructive" className="flex-1" onClick={() => deleteUserMutation.mutate()} disabled={deleteUserMutation.isPending}>
              {deleteUserMutation.isPending ? "מוחק..." : "מחק משתמש לצמיתות"}
            </Button>
            <Button variant="outline" onClick={() => setDeleteUserConfirm(null)}>ביטול</Button>
          </div>
        </Modal>
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
  const [oddsDebug, setOddsDebug] = useState<{ has_api_key: boolean; total_matches: number; sample_keys: string[] } | null>(null);
  const [oddsLoading, setOddsLoading] = useState(false);
  const [settlementMsg, setSettlementMsg] = useState<string | null>(null);
  const [settlementLoading, setSettlementLoading] = useState(false);

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
      {/* Odds cache diagnostics */}
      <div className="border rounded-2xl p-4 flex flex-col gap-3">
        <h3 className="text-sm font-bold">🔍 אבחון סיכויי הימורים (Odds API)</h3>
        <button
          onClick={async () => {
            setOddsLoading(true);
            try { setOddsDebug(await adminOddsDebug()); } catch {}
            setOddsLoading(false);
          }}
          disabled={oddsLoading}
          className="px-4 py-2 rounded-xl bg-secondary border text-sm font-bold disabled:opacity-50"
        >
          {oddsLoading ? "בודק..." : "בדוק מצב Odds API"}
        </button>
        {oddsDebug && (
          <div className="text-xs flex flex-col gap-1">
            <p>{oddsDebug.has_api_key ? "✅ API key מוגדר" : "❌ API key חסר (THE_ODDS_API_KEY)"}</p>
            <p>משחקים בקאש: <strong>{oddsDebug.total_matches}</strong></p>
            {oddsDebug.sample_keys.length > 0 && (
              <details className="mt-1">
                <summary className="cursor-pointer text-muted-foreground">הצג דוגמאות מהקאש</summary>
                <ul className="mt-1 space-y-0.5 font-mono text-[10px] text-muted-foreground">
                  {oddsDebug.sample_keys.map(k => <li key={k}>{k}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Manual bet settlement */}
      <div className="border rounded-2xl p-4 flex flex-col gap-3">
        <h3 className="text-sm font-bold">⚙️ עיבוד הימורים ידני</h3>
        <p className="text-xs text-muted-foreground">הרץ את עיבוד ההימורים ידנית — מועיל אם משחקים שהסתיימו לא עובדו אוטומטית.</p>
        <button
          onClick={async () => {
            setSettlementLoading(true);
            setSettlementMsg(null);
            try {
              const d = await adminRunSettlement();
              setSettlementMsg(`✅ עובדו ${d.settled} הימורים (${d.games} משחקים)`);
            } catch (e: any) {
              setSettlementMsg(`❌ ${e.message}`);
            }
            setSettlementLoading(false);
          }}
          disabled={settlementLoading}
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50"
        >
          {settlementLoading ? "מעבד..." : "הרץ עיבוד הימורים"}
        </button>
        {settlementMsg && <p className="text-xs font-medium">{settlementMsg}</p>}
      </div>
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
              {["משתמש", "מסגרת", "משחק", "סוג", "בחירה", "סכום", "odds", "פוטנציאל", "סטטוס", "זמן", ""].map(h => (
                <th key={h} className="text-right px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {bets.map(b => (
                <tr key={b.id} className="border-t border-border/50 hover:bg-muted/30">
                  <td className="px-3 py-2 font-bold">{b.username}</td>
                  <td className="px-3 py-2">
                    {!b.league_id ? (
                      <span className="text-[10px] bg-secondary px-2 py-0.5 rounded text-muted-foreground">חופשי</span>
                    ) : (
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-blue-600">
                          {b.league_access_type === 'public' ? 'ציבורית' : 'פרטית'}
                        </span>
                        <span className="text-[9px] text-muted-foreground leading-tight">{b.league_name}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-[11px]">{b.home_team} vs {b.away_team}</td>
                  <td className="px-3 py-2 text-[10px] text-muted-foreground">{b.question_text || b.bet_type}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{b.selected_outcome}</div>
                    {b.exact_score_prediction && <div className="text-[10px] text-muted-foreground">({b.exact_score_prediction})</div>}
                  </td>
                  <td className="px-3 py-2 font-bold italic">
                    {b.league_bet_mode === 'initial_balance' ? '-' : fmt(b.stake)}
                  </td>
                  <td className="px-3 py-2">{Number(b.odds).toFixed(2)}</td>
                  <td className="px-3 py-2">
                    {b.status === 'won' ? (
                      <span className="text-primary font-bold">{fmt(b.actual_payout)}</span>
                    ) : (
                      <span className="text-muted-foreground italic">
                        {b.league_bet_mode === 'initial_balance' 
                          ? `×${(parseFloat(String(b.odds)) * (b.exact_score_prediction ? 3 : 1)).toFixed(2)}`
                          : fmt(Number(b.potential_payout) * (b.exact_score_prediction ? 3 : 1))}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2"><StatusBadge status={b.status} /></td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtTime(b.placed_at)}</td>
                  <td className="px-3 py-2 text-right">
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
  const [oddsFilter, setOddsFilter] = useState<"" | "espn" | "api" | "default" | "admin">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showAllGames, setShowAllGames] = useState(false);
  const [gameTab, setGameTab] = useState<"upcoming" | "finished">("upcoming");
  const [sortField, setSortField] = useState<"time" | "bets" | "score" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [editOddsGame, setEditOddsGame] = useState<AdminGame | null>(null);
  const [editHomeOdds, setEditHomeOdds] = useState("");
  const [editDrawOdds, setEditDrawOdds] = useState("");
  const [editAwayOdds, setEditAwayOdds] = useState("");
  const [editOddsMsg, setEditOddsMsg] = useState("");

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

  const editOddsMutation = useMutation({
    mutationFn: () => adminUpdateGameOdds(
      editOddsGame!.id,
      parseFloat(editHomeOdds),
      parseFloat(editDrawOdds),
      parseFloat(editAwayOdds),
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-games"] });
      setEditOddsMsg("✅ odds עודכנו");
      setTimeout(() => { setEditOddsGame(null); setEditOddsMsg(""); }, 1500);
    },
    onError: (e: any) => setEditOddsMsg(`❌ ${e.message}`),
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
    if (oddsFilter && (g as any).odds_source !== oddsFilter) return false;
    if (dateFrom && new Date(g.start_time) < new Date(dateFrom)) return false;
    if (dateTo && new Date(g.start_time) > new Date(dateTo + "T23:59:59")) return false;
    // gameTab filter — upcoming: exclude finished + postponed past their date; finished: only finished
    const isPast = new Date(g.start_time) < new Date();
    if (gameTab === "upcoming" && (g.status === "finished" || (g.status === "postponed" && isPast))) return false;
    if (gameTab === "upcoming" && g.status !== "live" && g.status !== "scheduled" && g.status !== "postponed" && isPast) return false;
    if (gameTab === "finished" && g.status !== "finished") return false;
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
          <option value="postponed">נדחה</option>
        </select>
        <select value={blockedFilter} onChange={e => setBlockedFilter(e.target.value as any)}
          className="bg-background border rounded-lg px-2 py-1 text-xs outline-none">
          <option value="">הכל</option>
          <option value="blocked">חסום</option>
          <option value="open">פתוח</option>
        </select>
        <select value={oddsFilter} onChange={e => setOddsFilter(e.target.value as any)}
          className="bg-background border rounded-lg px-2 py-1 text-xs outline-none">
          <option value="">כל מקורות odds</option>
          <option value="espn">ESPN</option>
          <option value="api">API</option>
          <option value="default">default</option>
          <option value="admin">admin</option>
        </select>
        {(searchTeam || leagueFilter || statusFilter || blockedFilter || oddsFilter || dateFrom || dateTo) && (
          <button onClick={() => { setSearchTeam(""); setLeagueFilter(""); setStatusFilter(""); setBlockedFilter(""); setOddsFilter(""); setDateFrom(""); setDateTo(""); }}
            className="text-xs text-primary underline">נקה סננים</button>
        )}
      </div>

      {/* Game tab toggle */}
      <div className="flex gap-1 bg-secondary rounded-xl p-1 w-fit">
        {(["upcoming", "finished"] as const).map(t => (
          <button key={t} onClick={() => setGameTab(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${gameTab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {t === "upcoming" ? "עתידיים / חיים" : "הסתיימו"}
          </button>
        ))}
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
              <th className="text-right px-2 py-2 font-semibold text-muted-foreground">odds</th>
              <th className="text-right px-2 py-2 font-semibold text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort("bets")}>
                הימורים {sortField === "bets" ? (sortDir === "asc" ? "↑" : "↓") : "⇅"}
              </th>
              <th className="text-right px-2 py-2 font-semibold text-muted-foreground">featured</th>
              <th className="text-right px-2 py-2 font-semibold text-muted-foreground">נעילה</th>
              <th className="text-right px-2 py-2 font-semibold text-muted-foreground">אנליטיקות</th>
            </tr></thead>
            <tbody>
              {filteredGames.map(g => {
                const oddsSource: string = (g as any).odds_source ?? "default";
                const oddsSourceColor: Record<string, string> = {
                  espn: "bg-blue-100 text-blue-700",
                  api: "bg-green-100 text-green-700",
                  admin: "bg-purple-100 text-purple-700",
                  default: "bg-gray-100 text-gray-500",
                };
                const scoreDisplay = g.status === "finished" && g.score_home != null
                  ? `${g.score_home}–${g.score_away}`
                  : (g.status === "finished" ? "—" : "טרם הסתיים");
                return (
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
                      <td className="px-2 py-2 font-bold text-[11px]">{scoreDisplay}</td>
                      <td className="px-2 py-2">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${oddsSourceColor[oddsSource] ?? "bg-gray-100 text-gray-500"}`}>
                            {oddsSource}
                          </span>
                          {g.status !== "finished" && (
                            <button onClick={() => {
                              const outs: any[] = (g as any).match_winner_outcomes ?? [];
                              setEditOddsGame(g);
                              setEditHomeOdds(String(outs[0]?.odds ?? ""));
                              setEditDrawOdds(String(outs[1]?.odds ?? ""));
                              setEditAwayOdds(String(outs[2]?.odds ?? ""));
                              setEditOddsMsg("");
                            }} className="text-[10px] text-primary underline">ערוך</button>
                          )}
                        </div>
                      </td>
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
                        <td colSpan={11} className="px-4 py-3">
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
                );
              })}
            </tbody>
          </table>
          {filteredGames.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">אין משחקים</p>}
        </div>
      )}

      {/* Edit odds modal */}
      {editOddsGame && (
        <Modal onClose={() => setEditOddsGame(null)} title="עריכת odds">
          <p className="text-sm font-bold mb-3">{editOddsGame.home_team} נגד {editOddsGame.away_team}</p>
          <div className="flex flex-col gap-3">
            {[
              { label: editOddsGame.home_team, value: editHomeOdds, set: setEditHomeOdds },
              { label: "תיקו", value: editDrawOdds, set: setEditDrawOdds },
              { label: editOddsGame.away_team, value: editAwayOdds, set: setEditAwayOdds },
            ].map(({ label, value, set }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-28 shrink-0 text-right">{label}</span>
                <input type="number" step="0.01" min="1.01" value={value} onChange={e => set(e.target.value)}
                  className="flex-1 bg-secondary rounded-xl px-3 py-2 text-sm outline-none text-center" />
              </div>
            ))}
            {editOddsMsg && <p className="text-sm">{editOddsMsg}</p>}
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => editOddsMutation.mutate()}
                disabled={editOddsMutation.isPending || !editHomeOdds || !editDrawOdds || !editAwayOdds}>
                {editOddsMutation.isPending ? "שומר..." : "שמור odds"}
              </Button>
              <Button variant="outline" onClick={() => setEditOddsGame(null)}>ביטול</Button>
            </div>
          </div>
        </Modal>
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
  const [stopConfirm, setStopConfirm] = useState<AdminLeague | null>(null);
  const [stopMsg, setStopMsg] = useState("");
  const [statusFilter, setLeagueStatusFilter] = useState<"" | "active" | "paused" | "finished">("");
  const [waModal, setWaModal] = useState<{ league: AdminLeague; mode: 'view' | 'edit' } | null>(null);
  const [waLinkInput, setWaLinkInput] = useState("");
  const [waMsg, setWaMsg] = useState("");

  // Send message to league
  const [msgLeague, setMsgLeague] = useState<AdminLeague | null>(null);
  const [msgTitle, setMsgTitle] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [msgResult, setMsgResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [sendToDms, setSendToDms] = useState(true);
  const [sendToGroup, setSendToGroup] = useState(false);

  const sendMsgMutation = useMutation({
    mutationFn: () => adminSendNotification({ 
      type: 'admin_message', 
      title: msgTitle, 
      body: msgBody, 
      target: { league_id: msgLeague!.id } as any,
      send_to_dms: sendToDms,
      send_to_group: sendToGroup
    }),
    onSuccess: (res) => {
      setMsgResult({ ok: true, text: `✅ ההודעה נשלחה בהצלחה` });
      setMsgTitle(""); setMsgBody("");
      setTimeout(() => { setMsgLeague(null); setMsgResult(null); }, 2000);
    },
    onError: (e: any) => setMsgResult({ ok: false, text: `❌ ${e.message}` }),
  });

  // Public league creation
  const [showCreatePublic, setShowCreatePublic] = useState(false);
  const [pubName, setPubName] = useState("");
  const [pubDesc, setPubDesc] = useState("");
  const [pubFormat, setPubFormat] = useState<"pool" | "per_game">("pool");
  const [pubEntryFee, setPubEntryFee] = useState("0");
  const [pubMaxMembers, setPubMaxMembers] = useState("");
  const [pubIsTournament, setPubIsTournament] = useState(false);
  const [pubTournamentSlug, setPubTournamentSlug] = useState("");
  const [pubSeasonEnd, setPubSeasonEnd] = useState("");
  const [pubJoinPolicy, setPubJoinPolicy] = useState<"before_start" | "anytime">("anytime");
  const [pubAutoSettle, setPubAutoSettle] = useState(false);
  const [pubDistribution, setPubDistribution] = useState([{ place: 1, pct: 60 }, { place: 2, pct: 30 }, { place: 3, pct: 10 }]);
  const [pubMsg, setPubMsg] = useState("");

  const distTotal = pubDistribution.reduce((acc, curr) => acc + curr.pct, 0);

  const { data, isLoading, isError } = useQuery({ queryKey: ["admin-leagues"], queryFn: adminGetLeagues, staleTime: 30_000 });
  const leagues = (data?.leagues ?? []).filter((l: AdminLeague) => {
    if (leagueSearch) {
      const q = leagueSearch.toLowerCase();
      if (!l.name.toLowerCase().includes(q) && !l.creator_username?.toLowerCase().includes(q)) return false;
    }
    if (statusFilter && l.status !== statusFilter) return false;
    return true;
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

  const [customPool, setCustomPool] = useState("");
  const [customDist, setCustomDist] = useState("");

  const stopMutation = useMutation({
    mutationFn: ({ id, distribute, pool, dist }: { id: string; distribute: boolean; pool?: number; dist?: number[] }) => adminStopLeague(id, distribute, pool, dist),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["admin-leagues"] });
      setStopMsg(`✅ ${res.message}`);
      setTimeout(() => { setStopConfirm(null); setStopMsg(""); setCustomPool(""); setCustomDist(""); }, 2000);
    },
    onError: (e: any) => setStopMsg(`❌ ${e.message}`),
  });

  const removeWaMutation = useMutation({
    mutationFn: (id: string) => adminRemoveWaGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-leagues"] });
      setWaMsg("✅ קבוצת WA הוסרה");
      setTimeout(() => { setWaModal(null); setWaMsg(""); }, 1500);
    },
    onError: (e: any) => setWaMsg(`❌ ${e.message}`),
  });

  const setWaLinkMutation = useMutation({
    mutationFn: ({ id, link }: { id: string; link: string }) => adminSetWaInviteLink(id, link),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-leagues"] });
      setWaMsg("✅ לינק עודכן");
      setTimeout(() => { setWaModal(null); setWaMsg(""); setWaLinkInput(""); }, 1500);
    },
    onError: (e: any) => setWaMsg(`❌ ${e.message}`),
  });

  const createPublicMutation = useMutation({
    mutationFn: () => {
      return createLeague({
        name: pubName,
        description: pubDesc.trim() || undefined,
        format: pubFormat,
        duration_type: pubIsTournament ? 'tournament' : 'full_season',
        access_type: 'public',
        entry_fee: parseInt(pubEntryFee) || 0,
        max_members: parseInt(pubMaxMembers) || undefined,
        is_tournament: pubIsTournament,
        tournament_slug: pubIsTournament && pubTournamentSlug && pubTournamentSlug !== "none" ? pubTournamentSlug : undefined,
        season_end_date: pubIsTournament && pubSeasonEnd ? pubSeasonEnd : undefined,
        join_policy: pubIsTournament ? pubJoinPolicy : undefined,
        auto_settle: pubIsTournament ? pubAutoSettle : undefined,
        distribution: (pubFormat === "pool" || parseInt(pubEntryFee) > 0) ? pubDistribution : undefined,
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["admin-leagues"] });
      setPubMsg(`✅ ליגה ציבורית נוצרה: ${res.league.name}`);
      setPubName(""); setPubDesc(""); setPubFormat("pool"); setPubEntryFee("0"); setPubMaxMembers(""); 
      setPubIsTournament(false); setPubTournamentSlug("");
      setPubSeasonEnd(""); setPubJoinPolicy("anytime"); setPubAutoSettle(false);
      setPubDistribution([{ place: 1, pct: 60 }, { place: 2, pct: 30 }, { place: 3, pct: 10 }]);
      setTimeout(() => { setShowCreatePublic(false); setPubMsg(""); }, 2000);
    },
    onError: (e: any) => setPubMsg(`❌ ${e.message}`),
  });

  return (
    <div className="flex flex-col gap-3">
      {/* Create public league */}
      <div className="border rounded-xl p-3 bg-primary/5 border-primary/20">
        <button onClick={() => setShowCreatePublic(v => !v)}
          className="flex items-center gap-2 text-sm font-bold text-primary w-full text-right">
          <Plus size={15} /> צור ליגה ציבורית
        </button>
        {showCreatePublic && (
          <div className="flex flex-col gap-3 mt-4">
            <input placeholder="שם הליגה" value={pubName} onChange={(e) => setPubName(e.target.value)}
              className="bg-background rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 border" />

            <textarea placeholder="תיאור הליגה (אופציונלי)" value={pubDesc} onChange={(e) => setPubDesc(e.target.value)}
              rows={2}
              className="bg-background rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 border resize-none" />

            {/* Format */}
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-muted-foreground font-medium">פורמט ליגה</p>
              <div className="flex gap-2">
                <button onClick={() => setPubFormat("pool")}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-medium border transition-colors ${
                    pubFormat === "pool" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"
                  }`}>
                  <span className="block font-bold">קופה משותפת</span>
                  <span className="opacity-70">ניקוד · חלוקה לפי מקום</span>
                </button>
                <button onClick={() => setPubFormat("per_game")}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-medium border transition-colors ${
                    pubFormat === "per_game" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"
                  }`}>
                  <span className="block font-bold">תשלום למשחק</span>
                  <span className="opacity-70">הימור מהמאזן · זוכה שומר</span>
                </button>
              </div>
            </div>

            {/* Tournament modifier */}
            <label className="flex items-center gap-2.5 cursor-pointer bg-background border rounded-xl px-4 py-3">
              <input type="checkbox" checked={pubIsTournament} onChange={(e) => setPubIsTournament(e.target.checked)}
                className="w-4 h-4 accent-primary shrink-0 cursor-pointer" />
              <div>
                <span className="text-sm font-bold flex items-center gap-1"><Flag size={13} className="text-primary" /> ליגת טורניר</span>
                <span className="text-[11px] text-muted-foreground">כל חברי הליגה מהמרים על אותו טורניר</span>
              </div>
            </label>

            {/* Tournament settings */}
            {pubIsTournament && (
              <div className="flex flex-col gap-3 border border-primary/20 rounded-xl p-3 bg-white/50">
                <p className="text-xs font-bold text-primary">הגדרות טורניר</p>

                {/* Competition selector */}
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-muted-foreground">תחרות (אופציונלי)</p>
                  <Select value={pubTournamentSlug || "none"} onValueChange={setPubTournamentSlug} dir="rtl">
                    <SelectTrigger className="bg-background rounded-xl px-4 py-2 text-sm outline-none border h-11">
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



                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground shrink-0">תאריך סיום</span>
                  <input type="date" value={pubSeasonEnd} onChange={(e) => setPubSeasonEnd(e.target.value)}
                    className="flex-1 bg-background border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                </div>

                <div className="flex flex-col gap-1">
                  <p className="text-xs text-muted-foreground">הצטרפות לליגה</p>
                  <div className="flex gap-2">
                    {(["before_start", "anytime"] as const).map(p => (
                      <button key={p} onClick={() => setPubJoinPolicy(p)}
                        className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${
                          pubJoinPolicy === p ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"
                        }`}>
                        {p === "before_start" ? "לפני תחילת הטורניר בלבד" : "בכל שלב"}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={pubAutoSettle} onChange={(e) => setPubAutoSettle(e.target.checked)}
                    className="w-4 h-4 accent-primary cursor-pointer" />
                  <span className="text-sm font-medium">סיום וחלוקה אוטומטיים עם סיום הטורניר</span>
                </label>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground shrink-0">מקסימום חברים</span>
              <input type="number" min={2} value={pubMaxMembers} onChange={(e) => setPubMaxMembers(e.target.value)}
                placeholder="ללא הגבלה"
                className="flex-1 bg-background border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground shrink-0">דמי כניסה (לקופה)</span>
              <input type="number" min={0} value={pubEntryFee} onChange={(e) => setPubEntryFee(e.target.value)}
                placeholder="0"
                className="flex-1 bg-background border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
              <span className="text-sm text-muted-foreground shrink-0">נק׳</span>
            </div>

            {(pubFormat === "pool" || parseInt(pubEntryFee) > 0) && (
              <div className="flex flex-col gap-2 mt-2">
                <p className="text-xs font-bold text-muted-foreground">חלוקת פרסים (סה״כ: {distTotal}%)</p>
                {pubDistribution.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-16 shrink-0">מקום {d.place}</span>
                    <input type="number" min={0} max={100} value={d.pct}
                      onChange={(e) => setPubDistribution(prev => prev.map((x, j) => j === i ? { ...x, pct: parseInt(e.target.value) || 0 } : x))}
                      className="flex-1 bg-background border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                    <span className="text-sm text-muted-foreground shrink-0">%</span>
                    {i > 0 && (
                      <button onClick={() => setPubDistribution(prev => prev.filter((_, j) => j !== i))}
                        className="text-muted-foreground hover:text-destructive text-xs px-1">×</button>
                    )}
                  </div>
                ))}
                {pubDistribution.length < 5 && (
                  <button onClick={() => setPubDistribution(prev => [...prev, { place: prev.length + 1, pct: 0 }])}
                    className="text-xs text-primary self-start hover:underline font-medium">
                    + הוסף מקום
                  </button>
                )}
                {distTotal !== 100 && (
                  <p className="text-xs text-destructive">סה״כ חייב להיות 100% (כרגע: {distTotal}%)</p>
                )}
              </div>
            )}

            {pubMsg && <p className="text-xs font-bold">{pubMsg}</p>}
            <Button onClick={() => createPublicMutation.mutate()} 
              disabled={!pubName || createPublicMutation.isPending || ((pubFormat === "pool" || parseInt(pubEntryFee) > 0) && distTotal !== 100)} 
              className="bg-primary hover:bg-primary/90 mt-2">
              {createPublicMutation.isPending ? "יוצר..." : "צור ליגה ציבורית"}
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 bg-secondary rounded-xl px-3 py-2">
        <Search size={16} className="text-muted-foreground shrink-0" />
        <input value={leagueSearch} onChange={e => setLeagueSearch(e.target.value)}
          placeholder="חיפוש לפי שם ליגה / יוצר..."
          className="bg-transparent flex-1 text-sm outline-none" />
        <select value={statusFilter} onChange={e => setLeagueStatusFilter(e.target.value as any)}
          className="bg-background border rounded-lg px-2 py-1 text-xs outline-none">
          <option value="">כל הסטטוסים</option>
          <option value="active">פעיל</option>
          <option value="paused">מושהה</option>
          <option value="finished">נגמר</option>
        </select>
      </div>

      {isLoading ? <Loader /> : isError ? <ErrorMsg /> : (
        <div className="border rounded-xl overflow-auto">
          <table className="w-full text-xs min-w-[700px]">
            <thead className="bg-muted/50"><tr>
              {["שם", "סוג", "פורמט", "יוצר", "חברים", "קופה", "סטטוס", "נוצר", "WA", ""].map(h => (
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
                  <td className="px-3 py-2">
                    {l.access_type === 'public'
                      ? <span className="text-[11px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">ציבורית</span>
                      : <span className="text-[11px] text-muted-foreground">פרטית</span>
                    }
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{l.format}</td>
                  <td className="px-3 py-2">{l.creator_username}</td>
                  <td className="px-3 py-2 font-bold">{fmt(l.member_count)}</td>
                  <td className="px-3 py-2">{fmt(l.pool_total)}</td>
                  <td className="px-3 py-2"><StatusBadge status={l.status} /></td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(l.created_at)}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => { setWaModal({ league: l, mode: 'view' }); setWaMsg(""); setWaLinkInput(l.wa_invite_link || ""); }}
                      className={`text-[11px] px-2 py-0.5 rounded-full border ${l.wa_group_id ? 'bg-green-100 border-green-300 text-green-700' : 'bg-gray-100 border-gray-300 text-gray-500 hover:border-blue-300 hover:text-blue-600'}`}>
                      {l.wa_group_id ? '📱 מחובר' : '📱 הגדר'}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 flex-wrap">
                      <button onClick={() => { setMsgLeague(l); setMsgTitle(""); setMsgBody(""); setMsgResult(null); }}
                        className="text-[11px] text-blue-600 border border-blue-300 bg-blue-50 px-2 py-0.5 rounded-full hover:bg-blue-100 transition-colors flex items-center gap-0.5">
                        <Send size={10} /> שלח הודעה
                      </button>
                      {l.status === "active" && (
                        <button onClick={() => { setPauseConfirm(l); setPauseMsg(""); }}
                          className="text-[11px] text-amber-600 border border-amber-300 bg-amber-50 px-2 py-0.5 rounded-full hover:bg-amber-100 transition-colors">
                          השהה
                        </button>
                      )}
                      {(l.status === "active" || l.status === "paused") && (
                        <button onClick={() => { setStopConfirm(l); setStopMsg(""); }}
                          className="text-[11px] text-red-600 border border-red-300 bg-red-50 px-2 py-0.5 rounded-full hover:bg-red-100 transition-colors">
                          עצור
                        </button>
                      )}
                    </div>
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

      {stopConfirm && (
        <Modal onClose={() => { setStopConfirm(null); setCustomPool(""); setCustomDist(""); }} title={`⛔ עצירת ליגה: ${stopConfirm.name}`}>
          <p className="text-sm text-muted-foreground mb-1">
            פעולה זו תסגור את הליגה לצמיתות. לא ניתן לבטל.
          </p>
          <div className="text-xs bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3 text-amber-800 flex flex-col gap-1">
            <p>
              קופה נוכחית: <b>{fmt(stopConfirm.pool_total)} נק׳</b>
              {stopConfirm.distribution ? ` • חלוקה מוגדרת: ${stopConfirm.distribution.map(d => d.pct).join('/')}%` : " • אין חלוקת פרסים מוגדרת"}
            </p>
            {(!stopConfirm.distribution || stopConfirm.pool_total === 0) && (
              <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-amber-200">
                <p className="font-bold">חלוקת פרסים מותאמת אישית (אופציונלי):</p>
                <input placeholder="סך כל הקופה לפרסים (למשל 5000)" value={customPool} onChange={e => setCustomPool(e.target.value)}
                  className="bg-background rounded-md px-2 py-1 text-xs border" type="number" />
                <input placeholder="חלוקה באחוזים, למשל 50,30,20" value={customDist} onChange={e => setCustomDist(e.target.value)}
                  className="bg-background rounded-md px-2 py-1 text-xs border" />
              </div>
            )}
          </div>
          {stopMsg && <p className="text-sm mb-3">{stopMsg}</p>}
          <div className="flex flex-col gap-2">
            <Button variant="destructive" className="flex-1"
              onClick={() => {
                const distArray = customDist ? customDist.split(',').map(s => parseFloat(s.trim())) : undefined;
                stopMutation.mutate({ id: stopConfirm.id, distribute: true, pool: customPool ? parseFloat(customPool) : undefined, dist: distArray });
              }}
              disabled={stopMutation.isPending || (!stopConfirm.distribution && !customDist)}>
              {stopMutation.isPending ? "מעצור..." : "עצור וחלק פרסים לפי דירוג"}
            </Button>
            <Button className="flex-1 bg-gray-700 hover:bg-gray-800 text-white"
              onClick={() => stopMutation.mutate({ id: stopConfirm.id, distribute: false })}
              disabled={stopMutation.isPending}>
              {stopMutation.isPending ? "מעצור..." : "עצור ללא חלוקת פרסים"}
            </Button>
            <Button variant="outline" onClick={() => { setStopConfirm(null); setCustomPool(""); setCustomDist(""); }}>ביטול</Button>
          </div>
        </Modal>
      )}

      {msgLeague && (
        <Modal onClose={() => { setMsgLeague(null); setMsgResult(null); }} title={`שליחת הודעה — ${msgLeague.name}`}>
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">ההודעה תישלח לכל חברי הליגה הפעילים ({msgLeague.member_count} חברים)</p>
            <input value={msgTitle} onChange={e => setMsgTitle(e.target.value)} placeholder="כותרת"
              className="bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none" />
            <textarea value={msgBody} onChange={e => setMsgBody(e.target.value)} placeholder="תוכן ההודעה (אופציונלי)" rows={3}
              className="bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none resize-none" />
            
            <div className="flex flex-col gap-2 bg-muted/30 p-3 rounded-xl">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={sendToDms} onChange={e => setSendToDms(e.target.checked)} className="w-4 h-4 accent-primary" />
                <span className="text-xs font-medium text-muted-foreground">שלח הודעות אישיות בווטסאפ (לכל חבר בנפרד)</span>
              </label>
              {msgLeague.wa_group_id && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={sendToGroup} onChange={e => setSendToGroup(e.target.checked)} className="w-4 h-4 accent-primary" />
                  <span className="text-xs font-bold text-green-700">שלח הודעה לקבוצת הווטסאפ המחוברת</span>
                </label>
              )}
            </div>

            {msgResult && <p className={`text-sm ${msgResult.ok ? "text-green-600" : "text-destructive"}`}>{msgResult.text}</p>}
            <div className="flex gap-2">
              <Button onClick={() => { setMsgResult(null); sendMsgMutation.mutate(); }}
                disabled={!msgTitle || sendMsgMutation.isPending || (!sendToDms && !sendToGroup)} className="flex-1">
                <Send size={14} className="ml-1" />
                {sendMsgMutation.isPending ? "שולח..." : "שלח הודעה"}
              </Button>
              <Button variant="outline" onClick={() => { setMsgLeague(null); setMsgResult(null); }}>ביטול</Button>
            </div>
          </div>
        </Modal>
      )}

      {waModal && (
        <Modal onClose={() => { setWaModal(null); setWaMsg(""); }} title={`ניהול WA — ${waModal.league.name}`}>
          <div className="flex flex-col gap-4">
            {waModal.league.wa_group_id ? (
              <div className="flex flex-col gap-2 bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-xs font-bold text-green-700">קבוצת WA מחוברת ✓</p>
                <p className="text-xs text-muted-foreground font-mono break-all">{waModal.league.wa_group_id}</p>
                {waModal.league.wa_invite_link && (
                  <a href={waModal.league.wa_invite_link} target="_blank" rel="noreferrer"
                    className="text-xs text-blue-600 underline break-all">{waModal.league.wa_invite_link}</a>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">אין קבוצת WA מחוברת לליגה זו.</p>
            )}

            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold">עדכן לינק הזמנה לקבוצה:</p>
              <input value={waLinkInput} onChange={e => setWaLinkInput(e.target.value)}
                placeholder="https://chat.whatsapp.com/..."
                className="bg-secondary rounded-xl px-3 py-2 text-sm outline-none" />
              <Button onClick={() => setWaLinkMutation.mutate({ id: waModal.league.id, link: waLinkInput })}
                disabled={!waLinkInput || setWaLinkMutation.isPending}>
                {setWaLinkMutation.isPending ? "שומר..." : "עדכן לינק"}
              </Button>
            </div>

            {waModal.league.wa_group_id && (
              <Button variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={() => { if (confirm("להסיר את קבוצת ה-WA מהליגה?")) removeWaMutation.mutate(waModal.league.id); }}
                disabled={removeWaMutation.isPending}>
                {removeWaMutation.isPending ? "מסיר..." : "הסר קישור קבוצת WA"}
              </Button>
            )}

            {waMsg && <p className="text-sm">{waMsg}</p>}
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
  const [target, setTarget] = useState<string | string[]>("all");
  const [selectedLeagueIds, setSelectedLeagueIds] = useState<string[]>([]);
  const [leagueSearch, setLeagueSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const { data: userSearchData } = useQuery({
    queryKey: ["notif-user-search", userSearchQuery],
    queryFn: () => adminGetUsers(userSearchQuery),
    enabled: userSearchQuery.length >= 2,
    staleTime: 10_000,
  });

  const { data: leaguesData } = useQuery({
    queryKey: ["admin-leagues"],
    queryFn: adminGetLeagues,
    staleTime: 30_000,
  });

  // Compute the effective target for the API call
  const effectiveTarget: any = selectedLeagueIds.length > 0
    ? { league_ids: selectedLeagueIds }
    : target;

  const sendMutation = useMutation({
    mutationFn: () => adminSendNotification({ type, title, body, target: effectiveTarget }),
    onSuccess: (res) => {
      setResult({ ok: true, text: `✅ נשלח ל-${res.sent_to} משתמשים` });
      setTitle(""); setBody(""); setTarget("all");
      setSelectedLeagueIds([]); setUserSearch("");
    },
    onError: (e: any) => setResult({ ok: false, text: `❌ ${e.message}` }),
  });

  const toggleUserSelection = (username: string) => {
    setSelectedLeagueIds([]);
    setTarget(prev => {
      if (prev === "all") return [username];
      const list = [...(prev as string[])];
      if (list.includes(username)) {
        const filtered = list.filter(u => u !== username);
        return filtered.length === 0 ? "all" : filtered;
      }
      return [...list, username];
    });
    setUserSearch("");
    setUserSearchQuery("");
  };

  const toggleLeagueSelection = (id: string) => {
    setTarget("all");
    setSelectedLeagueIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    setLeagueSearch("");
  };

  const filteredLeagues = (leaguesData?.leagues ?? []).filter(l =>
    leagueSearch === '' ||
    l.name.toLowerCase().includes(leagueSearch.toLowerCase()) ||
    (l.creator_username ?? '').toLowerCase().includes(leagueSearch.toLowerCase())
  );

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

        {/* Target selector */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-bold text-muted-foreground mr-1">יעד:</p>

          {/* Row 1: כולם + league search */}
          <div className="flex flex-wrap gap-2 items-start">
            <button
              onClick={() => { setTarget("all"); setSelectedLeagueIds([]); setUserSearch(""); setUserSearchQuery(""); setLeagueSearch(""); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors shrink-0 ${target === "all" && selectedLeagueIds.length === 0 ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}
            >
              כולם
            </button>

            {/* League search */}
            <div className="relative flex-1 min-w-[200px]">
              <input
                value={leagueSearch}
                onChange={e => setLeagueSearch(e.target.value)}
                placeholder="חפש ליגה לפי שם..."
                className="w-full bg-secondary rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-amber-400/50 transition-all font-medium"
              />
              {leagueSearch.length >= 1 && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-background border rounded-xl shadow-lg z-20 max-h-52 overflow-y-auto">
                  {filteredLeagues.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">לא נמצאו ליגות פעילות</p>
                  ) : filteredLeagues.slice(0, 12).map(l => (
                    <button key={l.id} onClick={() => toggleLeagueSelection(l.id)}
                      className="w-full text-right px-3 py-2 text-xs hover:bg-secondary flex items-center gap-2 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate">{l.name}</p>
                        <p className="text-[10px] text-muted-foreground">{l.member_count} חברים · {l.access_type === 'public' ? 'ציבורית' : 'פרטית'} · {l.status === 'active' ? '🟢' : l.status === 'paused' ? '🟡' : '⚫'} {l.creator_username}</p>
                      </div>
                      {selectedLeagueIds.includes(l.id)
                        ? <Check size={14} className="text-primary shrink-0" />
                        : <Plus size={14} className="text-muted-foreground/50 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Selected league tags */}
          {selectedLeagueIds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedLeagueIds.map(id => {
                const l = leaguesData?.leagues?.find(x => x.id === id);
                return l ? (
                  <div key={id} className="flex items-center gap-1 bg-amber-100 text-amber-800 px-2.5 py-1.5 rounded-xl text-xs font-bold border border-amber-200">
                    🏆 {l.name}
                    <button onClick={() => toggleLeagueSelection(id)} className="hover:text-destructive transition-colors"><X size={13} /></button>
                  </div>
                ) : null;
              })}
            </div>
          )}

          {/* Selected user tags + user search */}
          <div className="flex flex-wrap gap-2 items-center">
            {Array.isArray(target) && target.map(u => (
              <div key={u} className="flex items-center gap-1 bg-primary/10 text-primary px-2.5 py-1.5 rounded-xl text-xs font-bold border border-primary/20">
                @{u}
                <button onClick={() => toggleUserSelection(u)} className="hover:text-destructive transition-colors">
                  <X size={14} />
                </button>
              </div>
            ))}

            <div className="flex-1 min-w-[150px] relative">
              <input
                value={userSearch}
                onChange={e => { setUserSearch(e.target.value); setUserSearchQuery(e.target.value); }}
                placeholder="הוסף משתמש..."
                className="w-full bg-secondary rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/30 transition-all font-medium"
              />
              {userSearchData?.users && userSearchQuery.length >= 2 && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-background border rounded-xl shadow-lg z-20 max-h-40 overflow-y-auto">
                  {userSearchData.users.slice(0, 8).map((u: AdminUser) => (
                    <button 
                      key={u.id} 
                      onClick={() => toggleUserSelection(u.username)}
                      className="w-full text-right px-3 py-2 text-xs hover:bg-secondary flex items-center justify-between gap-2"
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-bold text-foreground">@{u.username}</span>
                        <span className="text-[10px] text-muted-foreground">{u.display_name}</span>
                      </div>
                      {Array.isArray(target) && target.includes(u.username) && (
                        <Check size={14} className="text-primary" />
                      )}
                    </button>
                  ))}
                  {userSearchData.users.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">לא נמצאו משתמשים</p>}
                </div>
              )}
            </div>
          </div>
        </div>

        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="כותרת"
          className="bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none" />
        <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="תוכן (אופציונלי)" rows={3}
          className="bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none resize-none" />
        {result && <p className={`text-sm ${result.ok ? "text-green-600" : "text-destructive"}`}>{result.text}</p>}
        <Button onClick={() => { setResult(null); sendMutation.mutate(); }} disabled={!title || sendMutation.isPending}>
          <Send size={15} className="ml-2" />
          {sendMutation.isPending ? "שולח..." :
            selectedLeagueIds.length > 0
              ? `שלח לחברי ${selectedLeagueIds.length === 1 ? leaguesData?.leagues?.find(l => l.id === selectedLeagueIds[0])?.name ?? 'הליגה' : `${selectedLeagueIds.length} ליגות`}`
              : `שלח ${target === "all" ? "לכולם" : `ל-${Array.isArray(target) ? target.length : 1} משתמשים`}`}
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
                    {draft.puzzle_data.image_url
                      ? <img src={draft.puzzle_data.image_url} className="w-20 h-20 rounded-full object-cover border-2 shrink-0" onError={e => (e.currentTarget.style.display = 'none')} />
                      : <div className="w-20 h-20 rounded-full bg-secondary border-2 flex items-center justify-center text-muted-foreground text-xs shrink-0">אין תמונה</div>
                    }
                    <div className="flex flex-col gap-2 flex-1 w-full text-right">
                      <div className="flex gap-2 items-center">
                        <span className="text-xs font-bold w-14">תמונה:</span>
                        <input value={draft.puzzle_data.image_url ?? ''} onChange={e => setDraft({ ...draft, puzzle_data: { ...draft.puzzle_data, image_url: e.target.value || null }})} placeholder="URL לתמונת שחקן" className="flex-1 text-sm bg-background border px-2 py-1 rounded" />
                      </div>
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
                      placeholder="English Name"
                    />
                    <input
                      value={draft.solution.secret_he || ''}
                      onChange={(e) => setDraft({ ...draft, solution: { ...draft.solution, secret_he: e.target.value }})}
                      className="font-bold text-base bg-background border rounded-lg p-2 outline-indigo-500 transition-all text-blue-700 mt-1"
                      placeholder="שם בעברית"
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
                      placeholder="Club Name (EN)"
                    />
                    <input 
                      value={draft.solution.secret_he || ''}
                      onChange={(e) => setDraft({ ...draft, solution: { ...draft.solution, secret_he: e.target.value }})}
                      className="font-bold text-base bg-background border rounded-lg p-2 outline-indigo-500 transition-all text-blue-700 mt-1" 
                      placeholder="שם המועדון (HE)"
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
                      placeholder="Player Name (EN)"
                    />
                    <input 
                      value={draft.solution.secret_he || ''}
                      onChange={(e) => setDraft({ ...draft, solution: { ...draft.solution, secret_he: e.target.value }})}
                      className="font-bold text-base bg-background border rounded-lg p-2 outline-indigo-500 transition-all text-blue-700 mt-1" 
                      placeholder="שם השחקן (HE)"
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
                      placeholder="B2B Player (EN)"
                    />
                    <input 
                      value={draft.solution.secret_he || ''}
                      onChange={(e) => setDraft({ ...draft, solution: { ...draft.solution, secret_he: e.target.value }})}
                      className="font-bold text-base bg-background border rounded-lg p-2 outline-indigo-500 transition-all text-blue-700 mt-1" 
                      placeholder="שם השחקן (HE)"
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
                      placeholder="Missing Player (EN)"
                    />
                    <input 
                      value={draft.solution.secret_he || ''}
                      onChange={(e) => setDraft({ ...draft, solution: { ...draft.solution, secret_he: e.target.value }})}
                      className="font-bold text-base bg-background border rounded-lg p-2 outline-indigo-500 transition-all text-blue-700 mt-1" 
                      placeholder="השם בעברית"
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
                       <th className="px-3 py-2 text-center">הפתרון (EN / HE)</th>
                       <th className="px-3 py-2 w-32 border-r">תאריך שידור</th>
                       <th className="px-3 py-2 w-10"></th>
                     </tr>
                   </thead>
                   <tbody className="divide-y bg-background font-medium">
                     {filteredQueue.map((q: any) => {
                       const t = MINIGAMES.find(m => m.id === q.game_type)?.name || q.game_type;
                       const playDate = new Date(q.play_date).toISOString().split('T')[0];
                       const secretEn = typeof q.solution.secret === 'string' ? q.solution.secret : JSON.stringify(q.solution.secret);
                        const secretHe = q.answer_he || q.solution.secret_he;
                       return (
                         <tr key={q.id}>
                           <td className="px-3 py-2">{t}</td>
                           <td className="px-3 py-2 text-center text-indigo-700 max-w-[200px] truncate">
                              {secretEn} {secretHe ? `(${secretHe})` : ''}
                            </td>
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

// ── Support Tab ───────────────────────────────────────────────────────────────
const SupportTab = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [replyInquiry, setReplyInquiry] = useState<any | null>(null);
  const [replyMsg, setReplyMsg] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);
  const [replyError, setReplyError] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-support", statusFilter],
    queryFn: () => adminGetSupportInquiries(statusFilter || undefined),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => adminUpdateSupportStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-support"] }),
  });

  const replyMutation = useMutation({
    mutationFn: () => adminReplyToSupport(replyInquiry!.id, replyMsg),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-support"] });
      setReplyInquiry(null);
      setReplyMsg("");
      setReplyLoading(false);
    },
    onError: (e: any) => {
      setReplyError(e.message);
      setReplyLoading(false);
    }
  });

  if (isLoading) return <Loader />;
  if (isError) return <ErrorMsg />;

  const inquiries = data?.inquiries ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {(["", "unread", "read_unhandled", "handled"] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
            {s === "" ? "הכל" : 
             s === "unread" ? "טרם נקרא" : 
             s === "read_unhandled" ? "נקרא וטרם טופל" : 
             "טופל"}
          </button>
        ))}
      </div>

      <div className="border rounded-xl overflow-auto">
        <table className="w-full text-xs min-w-[600px]">
          <thead className="bg-muted/50"><tr>
            {["#", "משתמש", "תאריך ושעה", "תוכן הפנייה", "סטטוס", "פעולות"].map(h => (
              <th key={h} className="text-right px-3 py-2 font-semibold text-muted-foreground">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {inquiries.map(inq => (
              <tr key={inq.id} className="border-t border-border/50 hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2 font-mono font-bold text-muted-foreground">{inq.inquiry_number}</td>
                <td className="px-3 py-2">
                  <p className="font-bold">@{inq.username}</p>
                  <p className="text-[10px] text-muted-foreground">{inq.email}</p>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{fmtTime(inq.created_at)}</td>
                <td className="px-3 py-2 max-w-[300px]">
                  <p className="line-clamp-2" title={inq.message}>{inq.message}</p>
                </td>
                <td className="px-3 py-2">
                  <Select 
                    value={inq.status} 
                    onValueChange={(val) => updateStatusMutation.mutate({ id: inq.id, status: val })}
                  >
                    <SelectTrigger className="h-7 text-[11px] w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unread">🔴 טרם נקרא</SelectItem>
                      <SelectItem value="read_unhandled">🟡 נקרא וטרם טופל</SelectItem>
                      <SelectItem value="handled">🟢 טופל</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => { setReplyInquiry(inq); setReplyMsg(""); setReplyError(""); }}
                      className="text-primary font-bold hover:underline"
                    >
                      השב
                    </button>
                    {inq.reply_message && (
                      <span className="text-gray-400 cursor-help" title={`תשובה: ${inq.reply_message} (נשלח ב-${fmtTime(inq.replied_at)})`}>💬</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {inquiries.length === 0 && <p className="text-center text-sm text-muted-foreground py-10">אין פניות במצב זה</p>}
      </div>

      {replyInquiry && (
        <Modal 
          onClose={() => setReplyInquiry(null)} 
          title={"תשובה לפנייה מס׳ " + replyInquiry.inquiry_number + " (@" + replyInquiry.username + ")"}
        >
          <div className="flex flex-col gap-4">
            <div className="bg-secondary p-3 rounded-xl">
              <p className="text-[10px] text-muted-foreground mb-1 font-bold">הפנייה:</p>
              <p className="text-xs italic">"{replyInquiry.message}"</p>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-muted-foreground">הודעת תשובה</label>
              <textarea 
                value={replyMsg}
                onChange={e => setReplyMsg(e.target.value)}
                placeholder="כתוב תשובה..."
                className="w-full bg-secondary rounded-xl px-3 py-2 text-sm outline-none h-32 resize-none"
              />
              <p className="text-[10px] text-muted-foreground italic">ההודעה תשלח בהתראה פנימית ובוואטסאפ (במידה ומחובר).</p>
            </div>
            {replyError && <p className="text-xs text-destructive">{replyError}</p>}
            <div className="flex gap-2">
              <Button 
                className="flex-1" 
                onClick={() => { setReplyLoading(true); replyMutation.mutate(); }}
                disabled={!replyMsg.trim() || replyLoading}
              >
                {replyLoading ? "שולח..." : "שלח תשובה"}
              </Button>
              <Button variant="outline" onClick={() => setReplyInquiry(null)}>ביטול</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

const AdvancedTab = () => {
  const queryClient = useQueryClient();
  const [section, setSection] = useState<"competitions" | "log" | "admins" | "translations">("competitions");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [adminMsg, setAdminMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data: compsData, isLoading: compsLoading } = useQuery({
    queryKey: ["admin-competitions"], queryFn: adminGetCompetitions, enabled: section === "competitions",
  });
  const { data: translationsData, isLoading: translationsLoading } = useQuery({
    queryKey: ["admin-team-translations"], queryFn: adminGetTeamTranslations, enabled: section === "translations",
  });
  const [editingHe, setEditingHe] = useState<Record<string, string>>({});
  const [regenMsg, setRegenMsg] = useState<string | null>(null);
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

  const approveTranslationMutation = useMutation({
    mutationFn: ({ name_en, name_he }: { name_en: string; name_he: string }) =>
      adminApproveTeamTranslation(name_en, name_he),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-team-translations"] });
      queryClient.invalidateQueries({ queryKey: ["team-translations"] });
    },
  });
  const dismissTranslationMutation = useMutation({
    mutationFn: adminDismissTeamTranslation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-team-translations"] }),
  });
  const regenMutation = useMutation({
    mutationFn: adminRegenerateBetQuestions,
    onSuccess: (d) => { setRegenMsg(`✅ עודכנו ${d.updated} שאלות`); setTimeout(() => setRegenMsg(null), 4000); },
    onError: (e: any) => setRegenMsg(`❌ ${e.message}`),
  });

  const ACTION_LABELS: Record<string, string> = {
    feature_game: "📌 Featured משחק", unfeature_game: "⬜ הסרת Featured",
    cancel_bet: "❌ ביטול הימור", adjust_points: "💰 התאמת נקודות",
    toggle_competition: "🔄 שינוי תחרות",
    add_admin: "👤 הוספת מנהל", remove_admin: "🗑 הסרת מנהל",
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {(["competitions", "admins", "translations", "log"] as const).map(s => (
          <button key={s} onClick={() => setSection(s)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${section === s ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
            {s === "competitions" ? "⚽ תחרויות" : s === "admins" ? "🔑 מנהלים" : s === "translations" ? "🌐 תרגומי קבוצות" : "📋 לוג פעולות"}
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

      {section === "translations" && (
        <div className="flex flex-col gap-4">
          {/* Regenerate bet questions */}
          <div className="border rounded-2xl p-4 flex flex-col gap-3">
            <h3 className="text-sm font-bold">🔄 רענון שאלות הימור לעברית</h3>
            <p className="text-xs text-muted-foreground">מעדכן שאלות ותוצאות של משחקים עתידיים שטרם הימרו עליהם — לעברית.</p>
            <button onClick={() => regenMutation.mutate()}
              disabled={regenMutation.isPending}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50">
              {regenMutation.isPending ? "מעדכן..." : "עדכן שאלות לעברית"}
            </button>
            {regenMsg && <p className="text-xs font-medium">{regenMsg}</p>}
          </div>

          {/* Pending / approved team translations */}
          <div className="border rounded-2xl p-4 flex flex-col gap-3">
            <h3 className="text-sm font-bold">🌐 תרגומי קבוצות ממתינים לאישור</h3>
            <p className="text-xs text-muted-foreground">קבוצות חדשות שה-LLM תרגם — ערוך/אשר לפני שיוצגו באתר.</p>
            {translationsLoading ? <Loader /> : (
              <div className="flex flex-col gap-2">
                {(translationsData?.translations ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground">אין תרגומים ממתינים</p>
                )}
                {(translationsData?.translations ?? []).map((t) => (
                  <div key={t.name_en} className="border rounded-xl p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-muted-foreground">{t.name_en}</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={editingHe[t.name_en] ?? t.name_he ?? ""}
                        onChange={(e) => setEditingHe((p) => ({ ...p, [t.name_en]: e.target.value }))}
                        placeholder="שם בעברית..."
                        className="flex-1 bg-background border rounded-xl px-3 py-1.5 text-sm outline-none"
                      />
                      <button
                        onClick={() => approveTranslationMutation.mutate({
                          name_en: t.name_en,
                          name_he: editingHe[t.name_en] ?? t.name_he ?? "",
                        })}
                        disabled={!editingHe[t.name_en] && !t.name_he}
                        className="px-3 py-1.5 rounded-xl bg-green-600 text-white text-xs font-bold disabled:opacity-40">
                        אשר
                      </button>
                      <button
                        onClick={() => dismissTranslationMutation.mutate(t.name_en)}
                        className="px-3 py-1.5 rounded-xl bg-secondary border text-xs font-bold text-muted-foreground">
                        דחה
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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
    advisor: <AdvisorTab />,
    social:  <SocialAgentTab />,
    support: <SupportTab />,
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
