import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getLeague, settleLeague, leaveLeague } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import { ArrowRight, Copy, Check, Trophy, Users, Coins, Crown, LogOut, Flag } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const FORMAT_LABEL = { pool: "קופה משותפת", per_game: "תשלום למשחק" };
const DURATION_LABEL: Record<string, string> = {
  full_season: "עונה מלאה",
  single_round: "סבב בודד",
  cup: "גביע",
};

const LeagueDetailPage = () => {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const { backendUser } = useAuth();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [showSettle, setShowSettle] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["league", leagueId],
    queryFn: () => getLeague(leagueId!),
    enabled: !!leagueId,
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
              {league.description && <p className="text-xs text-muted-foreground mt-0.5">{league.description}</p>}
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
          { icon: <Users size={16} className="text-primary" />, label: "חברים", value: members.filter(m => m.is_active).length },
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
            <div className="flex items-center gap-2">
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
                      {member.username}
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

      {/* Actions */}
      {!isFinished && (
        <div className="px-5 flex flex-col gap-3">
          {isCreator && league.format === "pool" && league.pool_total > 0 && (
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

          {!isCreator && (
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
    </div>
  );
};

export default LeagueDetailPage;
