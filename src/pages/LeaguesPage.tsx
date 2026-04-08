import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getMyLeagues, getLeaderboard, getMyRank, createLeague, joinLeague } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Plus, Users, Trophy, Lock, Globe, Medal, ChevronRight, Coins } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

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
  const [joinCode, setJoinCode] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Create form state
  const [name, setName] = useState("");
  const [access, setAccess] = useState<"invite" | "public">("invite");
  const [format, setFormat] = useState<"pool" | "per_game" | "tournament">("pool");
  const [duration, setDuration] = useState("full_season");
  const [entryFee, setEntryFee] = useState("0");
  const [distribution, setDistribution] = useState(DEFAULT_DISTRIBUTION);
  // Tournament-specific
  const [tournamentSlug, setTournamentSlug] = useState("fifa.world");
  const [stakePerMatch, setStakePerMatch] = useState("50");
  const [joinPolicy, setJoinPolicy] = useState<"before_start" | "anytime">("before_start");
  const [autoSettle, setAutoSettle] = useState(true);

  const { data: leaguesData, isLoading: leaguesLoading } = useQuery({
    queryKey: ["my-leagues"],
    queryFn: getMyLeagues,
  });

  const { data: leaderboardData, isLoading: lbLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => getLeaderboard(50),
    enabled: tab === "leaderboard",
  });

  const { data: myRankData } = useQuery({
    queryKey: ["my-rank"],
    queryFn: getMyRank,
    enabled: tab === "leaderboard",
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createLeague({
        name,
        format,
        duration_type: format === "tournament" ? "tournament" : duration,
        access_type: access,
        entry_fee: parseInt(entryFee) || 0,
        distribution: (format === "pool" || format === "tournament") && parseInt(entryFee) > 0 ? distribution : undefined,
        ...(format === "tournament" && {
          tournament_slug: tournamentSlug,
          stake_per_match: parseInt(stakePerMatch) || 0,
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
    mutationFn: () => joinLeague(joinCode),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["my-leagues"] });
      setShowJoin(false);
      setJoinCode("");
      navigate(`/leagues/${data.league.id}`);
    },
  });

  const resetForm = () => {
    setName(""); setAccess("invite"); setFormat("pool");
    setDuration("full_season"); setEntryFee("0");
    setDistribution(DEFAULT_DISTRIBUTION);
    setTournamentSlug("fifa.world"); setStakePerMatch("50");
    setJoinPolicy("before_start"); setAutoSettle(true);
  };

  const distTotal = distribution.reduce((s, d) => s + d.pct, 0);
  const leagues = leaguesData?.leagues ?? [];
  const leaderboard = leaderboardData?.leaderboard ?? [];

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
            <Button variant="default" size="sm" onClick={() => { setShowCreate(!showCreate); setShowJoin(false); }}>
              <Plus size={16} /> צור ליגה
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setShowJoin(!showJoin); setShowCreate(false); }}>
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

              {/* Access */}
              <div className="flex gap-2">
                {(["invite", "public"] as const).map((a) => (
                  <button key={a} onClick={() => setAccess(a)}
                    className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                      access === a ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"
                    }`}
                  >
                    {a === "invite" ? <><Lock size={13} /> הזמנה בלבד</> : <><Globe size={13} /> פתוחה</>}
                  </button>
                ))}
              </div>

              {/* Format */}
              <select value={format} onChange={(e) => setFormat(e.target.value as any)}
                className="bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none appearance-none">
                <option value="pool">קופה משותפת</option>
                <option value="per_game">תשלום למשחק</option>
                <option value="tournament">🏆 ליגת טורניר</option>
              </select>

              {/* Tournament fields */}
              {format === "tournament" && (
                <div className="flex flex-col gap-3 border border-primary/20 rounded-xl p-3 bg-primary/5">
                  <p className="text-xs font-bold text-primary">הגדרות טורניר</p>

                  <select value={tournamentSlug} onChange={(e) => setTournamentSlug(e.target.value)}
                    className="bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none appearance-none">
                    {KNOWN_COMPETITIONS.map(c => (
                      <option key={c.slug} value={c.slug}>{c.name}</option>
                    ))}
                  </select>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground shrink-0">stake מינימלי למשחק</span>
                    <input type="number" min={0} value={stakePerMatch}
                      onChange={(e) => setStakePerMatch(e.target.value)}
                      className="flex-1 bg-secondary rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                    <span className="text-sm text-muted-foreground shrink-0">נק׳</span>
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

              {/* Duration (non-tournament only) */}
              {format !== "tournament" && (
                <select value={duration} onChange={(e) => setDuration(e.target.value)}
                  className="bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none appearance-none">
                  <option value="full_season">עונה מלאה</option>
                  <option value="single_round">סבב בודד</option>
                  <option value="cup">גביע</option>
                </select>
              )}

              {/* Entry fee */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground shrink-0">דמי כניסה</span>
                <input type="number" min={0} value={entryFee} onChange={(e) => setEntryFee(e.target.value)}
                  placeholder="0"
                  className="flex-1 bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                <span className="text-sm text-muted-foreground shrink-0">נק׳</span>
              </div>

              {/* Distribution (pool + entry fee > 0) */}
              {format === "pool" && parseInt(entryFee) > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-bold text-muted-foreground">חלוקת פרסים (סה״כ: {distTotal}%)</p>
                  {distribution.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground w-16 shrink-0">מקום {d.place}</span>
                      <input type="number" min={0} max={100} value={d.pct}
                        onChange={(e) => setDistribution(prev => prev.map((x, j) => j === i ? { ...x, pct: parseInt(e.target.value) || 0 } : x))}
                        className="flex-1 bg-secondary rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                      <span className="text-sm text-muted-foreground shrink-0">%</span>
                    </div>
                  ))}
                  {distTotal !== 100 && (
                    <p className="text-xs text-destructive">סה״כ חייב להיות 100% (כרגע: {distTotal}%)</p>
                  )}
                </div>
              )}

              <Button variant="cta" size="lg" onClick={() => createMutation.mutate()}
                disabled={!name || createMutation.isPending || (format === "pool" && parseInt(entryFee) > 0 && distTotal !== 100)}>
                {createMutation.isPending ? "יוצר..." : "צור ליגה"}
              </Button>
              {createMutation.isError && (
                <p className="text-xs text-destructive">{(createMutation.error as any)?.message}</p>
              )}
            </motion.div>
          )}

          {/* Join Form */}
          {showJoin && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              className="card-kickoff flex flex-col gap-3 overflow-hidden"
            >
              <h3 className="font-bold">הצטרף לליגה</h3>
              <input placeholder="קוד הזמנה" value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 tracking-widest" />
              <Button variant="cta" size="lg" onClick={() => joinMutation.mutate()}
                disabled={!joinCode || joinMutation.isPending}>
                {joinMutation.isPending ? "מצטרף..." : "הצטרף"}
              </Button>
              {joinMutation.isError && (
                <p className="text-xs text-destructive">{(joinMutation.error as any)?.message}</p>
              )}
            </motion.div>
          )}

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
        </div>
      )}

      {/* Leaderboard Tab */}
      {tab === "leaderboard" && (
        <div className="flex flex-col gap-3 px-5">
          {myRankData?.rank && (
            <div className="card-kickoff flex items-center justify-between bg-primary/5 border border-primary/20">
              <span className="text-sm font-bold">הדירוג שלי</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-primary">#{myRankData.rank}</span>
                <span className="text-xs text-muted-foreground">{myRankData.points_balance?.toLocaleString()} נק׳</span>
              </div>
            </div>
          )}
          {lbLoading ? (
            <p className="text-sm text-muted-foreground">טוען...</p>
          ) : (
            leaderboard.map((entry, i) => (
              <motion.div key={entry.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }} className="card-kickoff flex items-center gap-3"
              >
                <div className="w-8 text-center">
                  {i === 0 ? <Medal size={18} className="text-yellow-500 mx-auto" /> :
                   i === 1 ? <Medal size={18} className="text-gray-400 mx-auto" /> :
                   i === 2 ? <Medal size={18} className="text-amber-600 mx-auto" /> :
                   <span className="text-sm font-bold text-muted-foreground">#{entry.rank}</span>}
                </div>
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm">👤</div>
                <div className="flex-1">
                  <p className="text-sm font-bold">{entry.username}</p>
                  <p className="text-xs text-muted-foreground">{entry.total_wins}/{entry.total_bets} ניצחונות</p>
                </div>
                <span className="text-sm font-black text-primary">{entry.points_balance?.toLocaleString()} נק׳</span>
              </motion.div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default LeaguesPage;
