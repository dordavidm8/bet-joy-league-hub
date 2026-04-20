import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getLeague, settleLeague, leaveLeague, getLeagueMatches, inviteToLeague, searchUsers, getWaLeagueSettings, createWaGroup, updateWaLeagueSettings, unlinkWaGroup, refreshWaInviteLink, setWaInviteLink, TournamentMatch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import { ArrowRight, Copy, Check, Trophy, Users, Coins, Crown, LogOut, Flag, CheckCircle2, Circle, Clock, Share2, UserPlus, Smartphone } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { translateTeam } from "@/lib/teamNames";

const FORMAT_LABEL: Record<string, string> = { pool: "קופה משותפת", per_game: "תשלום למשחק" };
const DURATION_LABEL: Record<string, string> = {
  full_season: "עונה מלאה",
  tournament: "טורניר",
};

const LeagueDetailPage = () => {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const { backendUser } = useAuth();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [showSettle, setShowSettle] = useState(false);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [waMsg, setWaMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [waGroupInput, setWaGroupInput] = useState("");
  const [waInviteLinkInput, setWaInviteLinkInput] = useState("");
  const [showWaLinkEdit, setShowWaLinkEdit] = useState(false);
  const [matchTab, setMatchTab] = useState<"upcoming" | "finished">("upcoming");
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteSearchQuery, setInviteSearchQuery] = useState("");
  const [showWaSettings, setShowWaSettings] = useState(false);
  const [editWaSettings, setEditWaSettings] = useState<{
    morning_message_time: string;
    leaderboard_frequency: 'never' | 'after_game' | 'daily' | 'weekly';
    leaderboard_time: string;
    leaderboard_day: number;
  }>({
    morning_message_time: '09:00',
    leaderboard_frequency: 'after_game',
    leaderboard_time: '10:00',
    leaderboard_day: 0,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["league", leagueId],
    queryFn: () => getLeague(leagueId!),
    enabled: !!leagueId,
  });

  const isTournament = !!data?.league.is_tournament;

  const { data: matchesData } = useQuery({
    queryKey: ["league-matches", leagueId],
    queryFn: () => getLeagueMatches(leagueId!),
    enabled: !!leagueId && isTournament,
  });

  const settleMutation = useMutation({
    mutationFn: () => settleLeague(leagueId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["league", leagueId] });
      queryClient.invalidateQueries({ queryKey: ["my-leagues"] });
      setShowSettle(false);
    },
  });

  const leaveMutation = useMutation({
    mutationFn: () => leaveLeague(leagueId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-leagues"] });
      navigate("/leagues");
    },
  });

  const { data: waSettingsData, refetch: refetchWaSettings } = useQuery({
    queryKey: ["wa-league-settings", leagueId],
    queryFn: () => getWaLeagueSettings(leagueId!),
    enabled: !!leagueId,
    staleTime: 60_000,
  });

  const waCreateGroupMutation = useMutation({
    mutationFn: () => createWaGroup(leagueId!),
    onSuccess: (d) => {
      setWaMsg({ ok: true, text: d.invite_link ? `קבוצה נוצרה! ${d.invite_link}` : (d.message || 'בקשה נשלחה') });
      refetchWaSettings();
    },
    onError: (e: any) => setWaMsg({ ok: false, text: e.message }),
  });

  const waUnlinkGroupMutation = useMutation({
    mutationFn: () => unlinkWaGroup(leagueId!),
    onSuccess: () => { setWaMsg({ ok: true, text: 'קבוצה נותקה' }); refetchWaSettings(); },
    onError: (e: any) => setWaMsg({ ok: false, text: e.message }),
  });

  const waUpdateLinkMutation = useMutation({
    mutationFn: () => setWaInviteLink(leagueId!, waInviteLinkInput.trim()),
    onSuccess: () => {
      setWaMsg({ ok: true, text: 'לינק עודכן ✅' });
      setShowWaLinkEdit(false);
      setWaInviteLinkInput("");
      refetchWaSettings();
    },
    onError: (e: any) => setWaMsg({ ok: false, text: e.message }),
  });

  const waRefreshLinkMutation = useMutation({
    mutationFn: () => refreshWaInviteLink(leagueId!),
    onSuccess: (d) => { setWaMsg({ ok: true, text: 'לינק עודכן ✅' }); refetchWaSettings(); },
    onError: (e: any) => setWaMsg({ ok: false, text: e.message }),
  });

  const waSaveSettingsMutation = useMutation({
    mutationFn: (vals: typeof editWaSettings) => updateWaLeagueSettings(leagueId!, vals),
    onSuccess: () => {
      setWaMsg({ ok: true, text: 'הגדרות נשמרו ✅' });
      setShowWaSettings(false);
      refetchWaSettings();
    },
    onError: (e: any) => setWaMsg({ ok: false, text: e.message }),
  });

  const { data: inviteSearchData, isLoading: inviteSearchLoading } = useQuery({
    queryKey: ["invite-search", inviteSearchQuery],
    queryFn: () => searchUsers(inviteSearchQuery),
    enabled: inviteSearchQuery.length >= 2,
    staleTime: 10_000,
  });

  const inviteMutation = useMutation({
    mutationFn: () => inviteToLeague(leagueId!, inviteUsername.trim()),
    onSuccess: (res) => {
      setInviteMsg({ ok: true, text: res.message });
      setInviteUsername("");
      setTimeout(() => setInviteMsg(null), 4000);
    },
    onError: (err: any) => {
      setInviteMsg({ ok: false, text: err.message });
      setTimeout(() => setInviteMsg(null), 4000);
    },
  });

  const copyCode = () => {
    if (!data?.league.invite_code) return;
    navigator.clipboard.writeText(data.league.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) return <div className="p-5 text-sm text-muted-foreground">טוען...</div>;
  if (!data) return <div className="p-5">ליגה לא נמצאה</div>;

  const { league, members } = data;
  const isCreator = backendUser?.id === league.creator_id;
  const isFinished = league.status === "finished";
  const myMember = members.find((m) => m.id === backendUser?.id);

  return (
    <div className="flex flex-col gap-5 pb-24">
      {/* Header */}
      <div className="px-5 pt-2">
        <button onClick={() => navigate("/leagues")} className="flex items-center gap-1 text-muted-foreground text-sm mb-4">
          <ArrowRight size={16} /> חזרה לליגות
        </button>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-kickoff">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <h1 className="font-black text-lg leading-tight">{league.name}</h1>
              {league.description && (
                <p className="text-sm text-muted-foreground mt-1 leading-snug">{league.description}</p>
              )}
            </div>
            <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full ${
              isFinished ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
            }`}>
              {isFinished ? "הסתיים" : "פעיל"}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="bg-secondary rounded-full px-2 py-0.5">{FORMAT_LABEL[league.format]}</span>
            <span className="bg-secondary rounded-full px-2 py-0.5">{DURATION_LABEL[league.duration_type] ?? league.duration_type}</span>
            {league.season_end_date && (
              <span className="bg-secondary rounded-full px-2 py-0.5">
                עד {new Date(league.season_end_date).toLocaleDateString("he-IL")}
              </span>
            )}
          </div>
        </motion.div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 px-5">
        {[
          { icon: <Users size={16} className="text-primary" />, label: "חברים", value: league.max_members ? `${members.filter(m => m.is_active).length}/${league.max_members}` : members.filter(m => m.is_active).length },
          { icon: <Coins size={16} className="text-primary" />, label: "קופה", value: `${league.pool_total.toLocaleString()} נק׳` },
          { icon: <Trophy size={16} className="text-primary" />, label: "דמי כניסה", value: league.entry_fee > 0 ? `${league.entry_fee} נק׳` : "חינם" },
        ].map((s, i) => (
          <div key={i} className="card-kickoff flex flex-col items-center gap-1 py-3">
            {s.icon}
            <span className="text-xs text-muted-foreground">{s.label}</span>
            <span className="font-black text-sm">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Invite code */}
      {league.access_type === "invite" && !isFinished && (
        <div className="px-5">
          <div className="card-kickoff">
            <p className="text-xs text-muted-foreground mb-2">קוד הזמנה — שתף עם חברים</p>
            <div className="flex items-center gap-2 mb-2">
              <span className="flex-1 bg-secondary rounded-xl px-4 py-2.5 font-mono font-bold tracking-widest text-center text-base">
                {league.invite_code}
              </span>
              <button
                onClick={copyCode}
                className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center transition-colors hover:bg-primary/20"
              >
                {copied ? <Check size={18} className="text-primary" /> : <Copy size={18} className="text-primary" />}
              </button>
            </div>
            <a
              href={`https://wa.me/?text=${encodeURIComponent("הצטרף לליגה שלי ב-Kickoff!\nשם: " + league.name + "\nקוד הזמנה: " + league.invite_code + "\nהצטרף ישירות: \u200B" + "https://kickoff-bet.app/leagues?join=" + league.invite_code)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-green-500 text-white text-sm font-bold hover:bg-green-600 transition-colors"
            >
              <Share2 size={15} />
              שתף בוואטסאפ
            </a>

            {/* Invite by username — live search */}
            <div className="mt-3">
              <p className="text-xs text-muted-foreground mb-1.5">הזמן לפי שם משתמש</p>
              <div className="relative">
                <input
                  placeholder="הקלד שם משתמש לחיפוש..."
                  value={inviteSearch}
                  onChange={(e) => {
                    setInviteSearch(e.target.value);
                    setInviteSearchQuery(e.target.value.trim());
                    setInviteUsername(e.target.value.trim());
                  }}
                  className="w-full bg-secondary rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
                {/* Search results dropdown */}
                {inviteSearchQuery.length >= 2 && (
                  <div className="absolute z-10 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                    {inviteSearchLoading ? (
                      <p className="text-xs text-muted-foreground px-3 py-2">מחפש...</p>
                    ) : (inviteSearchData?.users ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground px-3 py-2">לא נמצאו משתמשים</p>
                    ) : (
                      (inviteSearchData?.users ?? []).map((u) => (
                        <button
                          key={u.id}
                          onClick={() => {
                            setInviteUsername(u.username);
                            setInviteSearch(u.username);
                            setInviteSearchQuery("");
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary transition-colors text-right"
                        >
                          <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs shrink-0 overflow-hidden">
                            {u.avatar_url
                              ? <img src={u.avatar_url} className="w-full h-full object-cover" alt="" />
                              : "👤"}
                          </div>
                          <div className="flex-1 text-right">
                            <p className="text-sm font-bold">{u.display_name || u.username}</p>
                            <p className="text-[10px] text-muted-foreground">@{u.username}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {inviteUsername && (
                <button
                  onClick={() => inviteMutation.mutate()}
                  disabled={!inviteUsername.trim() || inviteMutation.isPending}
                  className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors disabled:opacity-40"
                >
                  <UserPlus size={13} />
                  {inviteMutation.isPending ? "שולח..." : `הזמן את @${inviteUsername}`}
                </button>
              )}
              {inviteMsg && (
                <p className={`text-xs mt-1.5 ${inviteMsg.ok ? "text-green-600" : "text-destructive"}`}>
                  {inviteMsg.text}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Distribution (pool leagues) */}
      {league.format === "pool" && league.distribution && league.distribution.length > 0 && (
        <div className="px-5">
          <div className="card-kickoff">
            <p className="text-xs font-bold mb-2 text-muted-foreground">חלוקת פרסים</p>
            <div className="flex flex-col gap-1">
              {league.distribution.map((d, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">מקום {d.place}</span>
                  <span className="font-bold">{d.pct}% · {Math.floor(d.pct / 100 * league.pool_total).toLocaleString()} נק׳</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="px-5">
        <h2 className="section-label mb-3">דירוג הליגה</h2>
        <div className="flex flex-col gap-2">
          {members
            .filter((m) => m.is_active)
            .sort((a, b) => b.points_in_league - a.points_in_league)
            .map((member, i) => {
              const isMe = member.id === backendUser?.id;
              return (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`card-kickoff flex items-center gap-3 ${isMe ? "border border-primary/30 bg-primary/5" : ""}`}
                >
                  <div className="w-7 text-center shrink-0">
                    {i === 0 ? <span className="text-lg">🥇</span>
                     : i === 1 ? <span className="text-lg">🥈</span>
                     : i === 2 ? <span className="text-lg">🥉</span>
                     : <span className="text-sm font-bold text-muted-foreground">#{i + 1}</span>}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm shrink-0">
                    {member.avatar_url
                      ? <img src={member.avatar_url} className="w-8 h-8 rounded-full object-cover" alt="" />
                      : "👤"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate flex items-center gap-1">
                      {isMe ? (
                        <span>{member.display_name || member.username.toLowerCase()}</span>
                      ) : (
                        <button
                          onClick={() => navigate(`/profile/${member.username.toLowerCase()}`)}
                          className="hover:text-primary transition-colors truncate"
                        >
                          {member.display_name || member.username.toLowerCase()}
                        </button>
                      )}
                      {member.id === league.creator_id && <Crown size={11} className="text-amber-500 shrink-0" />}
                      {isMe && <span className="text-[10px] text-primary font-normal">(אני)</span>}
                    </p>
                  </div>
                  <span className="text-sm font-black text-primary shrink-0">
                    {member.points_in_league.toLocaleString()} נק׳
                  </span>
                </motion.div>
              );
            })}
        </div>
      </div>

      {/* Tournament matches */}
      {isTournament && matchesData && (
        <div className="px-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-label">משחקי הטורניר</h2>
            <div className="flex flex-col items-end gap-0.5">
              {matchesData.stake_per_match > 0 && (
                <span className="text-xs text-muted-foreground">מינימום {matchesData.stake_per_match} נק׳ למשחק</span>
              )}
              {league.penalty_per_missed_bet != null && league.penalty_per_missed_bet > 0 && (
                <span className="text-xs text-destructive/70">קנס אי-הימור: {league.penalty_per_missed_bet} נק׳</span>
              )}
            </div>
          </div>

          {/* Summary bar */}
          {(() => {
            const started = matchesData.matches.filter(m => m.status !== 'scheduled');
            const bet = matchesData.matches.filter(m => m.bet_id);
            const missed = started.filter(m => !m.bet_id);
            return (
              <div className="flex gap-2 mb-3">
                <div className="flex-1 bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-center">
                  <p className="text-lg font-black text-green-600">{bet.length}</p>
                  <p className="text-[10px] text-green-600">הימרתי</p>
                </div>
                <div className="flex-1 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-center">
                  <p className="text-lg font-black text-red-500">{missed.length}</p>
                  <p className="text-[10px] text-red-500">פספסתי</p>
                </div>
                <div className="flex-1 bg-secondary rounded-xl px-3 py-2 text-center">
                  <p className="text-lg font-black">{matchesData.matches.filter(m => m.status === 'scheduled').length}</p>
                  <p className="text-[10px] text-muted-foreground">ממתין</p>
                </div>
              </div>
            );
          })()}

          {/* Tab toggle */}
          <div className="flex border border-border rounded-xl overflow-hidden mb-3">
            <button
              onClick={() => setMatchTab("upcoming")}
              className={`flex-1 py-2 text-xs font-bold transition-colors ${
                matchTab === "upcoming" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
              }`}
            >
              עתידיים
            </button>
            <button
              onClick={() => setMatchTab("finished")}
              className={`flex-1 py-2 text-xs font-bold transition-colors ${
                matchTab === "finished" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
              }`}
            >
              שהסתיימו
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {matchesData.matches
              .filter((m: TournamentMatch) =>
                matchTab === "upcoming"
                  ? m.status === "scheduled" || m.status === "live"
                  : m.status === "finished"
              )
              .map((match: TournamentMatch) => {
              const hasBet = !!match.bet_id;
              const isScheduled = match.status === 'scheduled';
              const isLive = match.status === 'live';
              const canBet = isScheduled || isLive;
              const isInitialBalanceLeague = league.bet_mode === 'initial_balance';
              return (
                <button
                  key={match.id}
                  onClick={() => canBet
                    ? navigate(`/game/${match.id}`, { state: { leagueId } })
                    : alert('לא ניתן להמר על משחק זה — חלון ההימורים נסגר')
                  }
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-right transition-colors ${
                    hasBet ? 'border-green-200 bg-green-50/50 active:bg-green-100/50'
                    : !canBet ? 'border-border bg-card opacity-60'
                    : 'border-border bg-card hover:bg-secondary/50 active:bg-secondary/80'
                  }`}
                >
                  {/* Status icon */}
                  <div className="shrink-0">
                    {hasBet
                      ? <CheckCircle2 size={18} className="text-green-500" />
                      : isScheduled
                        ? <Circle size={18} className="text-muted-foreground/40" />
                        : <Clock size={18} className="text-muted-foreground/40" />}
                  </div>

                  {/* Teams */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-semibold truncate">
                      {match.home_team_logo && <img src={match.home_team_logo} className="w-4 h-3 object-contain" alt="" />}
                      <span className="truncate">{translateTeam(match.home_team)}</span>
                      <span className="text-muted-foreground shrink-0">נגד</span>
                      {match.away_team_logo && <img src={match.away_team_logo} className="w-4 h-3 object-contain" alt="" />}
                      <span className="truncate">{translateTeam(match.away_team)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(match.start_time).toLocaleDateString("he-IL", { day: "numeric", month: "short" })}
                        {isLive && <span className="text-primary font-bold mr-1">· LIVE</span>}
                        {match.status === 'finished' && match.score_home != null && (
                          <span className="mr-1">{match.score_home}–{match.score_away}</span>
                        )}
                      </span>
                      {hasBet && (
                        <span className="text-[10px] font-bold text-green-600">
                          {match.selected_outcome} · {(match.stake ?? 0) > 0 ? `${match.stake} נק׳` : "ניקוד"}
                          {match.bet_status === "won" && !isInitialBalanceLeague && ` +${match.actual_payout} נק׳`}
                          {match.bet_status === "won" && isInitialBalanceLeague && match.bet_odds && ` +${match.bet_odds}× נק׳`}
                          {match.bet_status === "lost" && " ✗"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* CTA */}
                  {canBet && !hasBet && (
                    <span className="text-[10px] text-primary font-bold shrink-0">המר &larr;</span>
                  )}
                </button>
              );
            })}
            {matchesData.matches.filter((m: TournamentMatch) =>
              matchTab === "upcoming"
                ? m.status === "scheduled" || m.status === "live"
                : m.status === "finished"
            ).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                {matchTab === "upcoming" ? "אין משחקים עתידיים" : "אין משחקים שהסתיימו"}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      {!isFinished && (
        <div className="px-5 flex flex-col gap-3">
          {isCreator && league.pool_total > 0 && (
            <>
              {showSettle ? (
                <div className="card-kickoff flex flex-col gap-3 border border-destructive/30">
                  <p className="text-sm font-bold">סגירת הליגה תחלק את הקופה לפי הדירוג הנוכחי. לא ניתן לבטל.</p>
                  <div className="flex gap-2">
                    <Button variant="destructive" className="flex-1" onClick={() => settleMutation.mutate()} disabled={settleMutation.isPending}>
                      {settleMutation.isPending ? "מחלק..." : "אישור — סגור וחלק פרסים"}
                    </Button>
                    <Button variant="outline" onClick={() => setShowSettle(false)}>ביטול</Button>
                  </div>
                  {settleMutation.isError && <p className="text-xs text-destructive">{(settleMutation.error as any)?.message}</p>}
                </div>
              ) : (
                <Button variant="outline" className="flex items-center gap-2" onClick={() => setShowSettle(true)}>
                  <Flag size={16} /> סגור עונה וחלק פרסים
                </Button>
              )}
            </>
          )}

          {myMember?.is_active && (
            <button
              onClick={() => leaveMutation.mutate()}
              disabled={leaveMutation.isPending}
              className="text-sm text-destructive flex items-center justify-center gap-1 py-2 opacity-70 hover:opacity-100 transition-opacity"
            >
              <LogOut size={14} /> {leaveMutation.isPending ? "עוזב..." : "עזוב ליגה"}
            </button>
          )}
        </div>
      )}

      {/* WhatsApp Bot section — only for tournament leagues */}
      {!isFinished && isTournament && league.access_type !== 'public' && (
        <div className="px-5">
          <div className="card-kickoff flex flex-col gap-3">
            <p className="text-xs font-bold flex items-center gap-1.5">
              <Smartphone size={13} className="text-primary" />
              WhatsApp Bot
            </p>

            {waSettingsData?.settings?.group_active ? (
              <>
                <p className="text-xs text-green-600">קבוצה מחוברת ✅</p>

                {/* Invite link — show join button or prompt to add one */}
                {waSettingsData.settings.invite_link ? (
                  <a
                    href={waSettingsData.settings.invite_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm font-bold text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2 hover:bg-green-100 transition-colors self-start"
                  >
                    <Smartphone size={14} />
                    הצטרף לקבוצת WhatsApp
                  </a>
                ) : isCreator ? (
                  <div className="flex flex-col gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-xs font-bold text-amber-800">הוסף לינק הצטרפות לקבוצה</p>
                    <p className="text-[10px] text-amber-700">כדי שחברים יוכלו להצטרף, הוסף את הבוט כמנהל בקבוצה ולחץ ״קבל לינק אוטומטית״, או הדבק לינק ידנית.</p>
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => waRefreshLinkMutation.mutate()} disabled={waRefreshLinkMutation.isPending}>
                        {waRefreshLinkMutation.isPending ? "מנסה..." : "קבל לינק אוטומטית"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setWaInviteLinkInput(""); setShowWaLinkEdit(true); }}>
                        הזן לינק ידנית
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">מנהל הליגה טרם הוסיף לינק הצטרפות לקבוצה</p>
                )}

                {isCreator && (
                  <>
                    <button
                      onClick={() => waUnlinkGroupMutation.mutate()}
                      disabled={waUnlinkGroupMutation.isPending}
                      className="text-xs text-destructive hover:underline self-start"
                    >
                      {waUnlinkGroupMutation.isPending ? "מנתק..." : "נתק קבוצה"}
                    </button>

                    <button
                      onClick={() => {
                        if (waSettingsData?.settings) {
                          setEditWaSettings({
                            morning_message_time: waSettingsData.settings.morning_message_time || '09:00',
                            leaderboard_frequency: waSettingsData.settings.leaderboard_frequency || 'after_game',
                            leaderboard_time: waSettingsData.settings.leaderboard_time || '10:00',
                            leaderboard_day: waSettingsData.settings.leaderboard_day || 0,
                          });
                        }
                        setShowWaSettings(!showWaSettings);
                      }}
                      className="text-xs text-primary hover:underline self-start flex items-center gap-1"
                    >
                      ⚙️ הגדרות עדכונים
                    </button>

                    {showWaSettings && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="flex flex-col gap-3 bg-secondary/30 p-3 rounded-xl overflow-hidden">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-muted-foreground mr-1">שידור הודעת בוקר (שעה)</label>
                          <input type="time" value={editWaSettings.morning_message_time}
                            onChange={e => setEditWaSettings(prev => ({ ...prev, morning_message_time: e.target.value }))}
                            className="bg-secondary rounded-lg px-2 py-1 text-xs outline-none border border-border/50" />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-muted-foreground mr-1">תדירות שליחת טבלה</label>
                          <select value={editWaSettings.leaderboard_frequency}
                            onChange={e => setEditWaSettings(prev => ({ ...prev, leaderboard_frequency: e.target.value as any }))}
                            className="bg-secondary rounded-lg px-2 py-1 text-xs outline-none border border-border/50">
                            <option value="after_game">אחרי כל משחק</option>
                            <option value="daily">פעם ביום (בשעה קבועה)</option>
                            <option value="weekly">פעם בשבוע (ביום ושעה קבועים)</option>
                            <option value="never">לעולם לא</option>
                          </select>
                        </div>

                        {(editWaSettings.leaderboard_frequency === 'daily' || editWaSettings.leaderboard_frequency === 'weekly') && (
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-muted-foreground mr-1">שעת שליחת טבלה</label>
                            <input type="time" value={editWaSettings.leaderboard_time}
                              onChange={e => setEditWaSettings(prev => ({ ...prev, leaderboard_time: e.target.value }))}
                              className="bg-secondary rounded-lg px-2 py-1 text-xs outline-none border border-border/50" />
                          </div>
                        )}

                        {editWaSettings.leaderboard_frequency === 'weekly' && (
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-muted-foreground mr-1">יום בשבוע</label>
                            <select value={editWaSettings.leaderboard_day}
                              onChange={e => setEditWaSettings(prev => ({ ...prev, leaderboard_day: parseInt(e.target.value) }))}
                              className="bg-secondary rounded-lg px-2 py-1 text-xs outline-none border border-border/50">
                              <option value={0}>ראשון</option>
                              <option value={1}>שני</option>
                              <option value={2}>שלישי</option>
                              <option value={3}>רביעי</option>
                              <option value={4}>חמישי</option>
                              <option value={5}>שישי</option>
                              <option value={6}>שבת</option>
                            </select>
                          </div>
                        )}

                        <Button size="sm" onClick={() => waSaveSettingsMutation.mutate(editWaSettings)} disabled={waSaveSettingsMutation.isPending}>
                          {waSaveSettingsMutation.isPending ? "שומר..." : "שמור הגדרות"}
                        </Button>
                      </motion.div>
                    )}
                  </>
                )}
              </>
            ) : isCreator ? (
              <>
                <p className="text-[11px] text-muted-foreground">
                  חבר קבוצת וואטסאפ לליגה — חברים יקבלו הודעות על משחקים ויוכלו להמר ישירות
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setWaMsg(null); waCreateGroupMutation.mutate(); }}
                  disabled={waCreateGroupMutation.isPending}
                  className="self-start"
                >
                  <Smartphone size={14} /> {waCreateGroupMutation.isPending ? "יוצר..." : "צור קבוצת WhatsApp"}
                </Button>
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1">
                    או הוסף בוט לקבוצה קיימת — שלח בקבוצה:
                  </p>
                  <p className="font-mono text-xs bg-secondary rounded px-2 py-1 select-all">
                    /kickoff setup {league.invite_code}
                  </p>
                </div>
                {showWaLinkEdit ? (
                  <div className="flex flex-col gap-2">
                    <input
                      value={waInviteLinkInput}
                      onChange={e => setWaInviteLinkInput(e.target.value)}
                      placeholder="לינק הזמנה לקבוצת WA"
                      className="bg-secondary rounded-xl px-3 py-2 text-xs outline-none"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => waUpdateLinkMutation.mutate()} disabled={waUpdateLinkMutation.isPending}>
                        {waUpdateLinkMutation.isPending ? "שומר..." : "שמור לינק"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowWaLinkEdit(false)}>ביטול</Button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setWaInviteLinkInput(""); setShowWaLinkEdit(true); }}
                    className="text-xs text-primary hover:underline self-start">
                    הוסף לינק הזמנה ישיר לקבוצה
                  </button>
                )}
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                עדיין לא קושרה קבוצת וואטסאפ לליגה זו
              </p>
            )}
            {waMsg && (
              <p className={`text-xs ${waMsg.ok ? 'text-green-600' : 'text-destructive'}`}>
                {waMsg.text}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LeagueDetailPage;
