import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMyLeagues, getLeaderboard, getMyRank, createLeague, joinLeague } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Plus, Users, Trophy, Lock, Globe, Medal } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

type Tab = "leagues" | "leaderboard";

const LeaguesPage = () => {
  const [tab, setTab] = useState<Tab>("leagues");
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState("");
  const [newLeagueAccess, setNewLeagueAccess] = useState<"invite" | "public">("invite");
  const [newLeagueFormat, setNewLeagueFormat] = useState<"pool" | "per_game">("pool");
  const [joinCode, setJoinCode] = useState("");
  const queryClient = useQueryClient();

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
        name: newLeagueName,
        format: newLeagueFormat,
        duration_type: "full_season",
        access_type: newLeagueAccess,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-leagues"] });
      setShowCreate(false);
      setNewLeagueName("");
    },
  });

  const joinMutation = useMutation({
    mutationFn: () => joinLeague(joinCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-leagues"] });
      setShowJoin(false);
      setJoinCode("");
    },
  });

  const leagues = leaguesData?.leagues ?? [];
  const leaderboard = leaderboardData?.leaderboard ?? [];

  return (
    <div className="flex flex-col gap-5 pb-24">
      {/* Tabs */}
      <div className="flex border-b border-border px-5 pt-4">
        {(["leagues", "leaderboard"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
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
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="card-kickoff flex flex-col gap-3 overflow-hidden"
            >
              <h3 className="font-bold">ליגה חדשה</h3>
              <input
                placeholder="שם הליגה"
                value={newLeagueName}
                onChange={(e) => setNewLeagueName(e.target.value)}
                className="bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setNewLeagueAccess("invite")}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    newLeagueAccess === "invite" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"
                  }`}
                >
                  <Lock size={14} /> הזמנה בלבד
                </button>
                <button
                  onClick={() => setNewLeagueAccess("public")}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    newLeagueAccess === "public" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"
                  }`}
                >
                  <Globe size={14} /> פתוחה
                </button>
              </div>
              <select
                value={newLeagueFormat}
                onChange={(e) => setNewLeagueFormat(e.target.value as any)}
                className="bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none appearance-none"
              >
                <option value="pool">פורמט: קופה משותפת</option>
                <option value="per_game">פורמט: תשלום למשחק</option>
              </select>
              <Button
                variant="cta"
                size="lg"
                onClick={() => createMutation.mutate()}
                disabled={!newLeagueName || createMutation.isPending}
              >
                {createMutation.isPending ? "יוצר..." : "צור ליגה"}
              </Button>
              {createMutation.isError && (
                <p className="text-xs text-destructive">{(createMutation.error as any)?.message}</p>
              )}
            </motion.div>
          )}

          {/* Join Form */}
          {showJoin && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="card-kickoff flex flex-col gap-3 overflow-hidden"
            >
              <h3 className="font-bold">הצטרף לליגה</h3>
              <input
                placeholder="קוד הזמנה"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 tracking-widest"
              />
              <Button
                variant="cta"
                size="lg"
                onClick={() => joinMutation.mutate()}
                disabled={!joinCode || joinMutation.isPending}
              >
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
            <p className="text-sm text-muted-foreground">עדיין לא חבר בליגות. צור ליגה או הצטרף לאחת!</p>
          ) : (
            <div className="flex flex-col gap-3">
              {leagues.map((league, i) => (
                <motion.div
                  key={league.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="card-kickoff flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                      <Trophy size={18} className="text-primary" />
                    </div>
                    <div>
                      <p className="font-bold text-sm flex items-center gap-1">
                        {league.name}
                        {league.access_type === "invite" && <Lock size={12} className="text-muted-foreground" />}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users size={12} /> {league.member_count ?? "?"} חברים
                        {league.invite_code && <span className="ml-2 font-mono text-[10px]">{league.invite_code}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-black text-primary">{(league.points_in_league ?? 0).toLocaleString()} נק׳</p>
                  </div>
                </motion.div>
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
            <p className="text-sm text-muted-foreground">טוען לידרבורד...</p>
          ) : (
            leaderboard.map((entry, i) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="card-kickoff flex items-center gap-3"
              >
                <div className="w-8 text-center">
                  {i === 0 ? <Medal size={18} className="text-yellow-500 mx-auto" /> :
                   i === 1 ? <Medal size={18} className="text-gray-400 mx-auto" /> :
                   i === 2 ? <Medal size={18} className="text-amber-600 mx-auto" /> :
                   <span className="text-sm font-bold text-muted-foreground">#{entry.rank}</span>}
                </div>
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm">
                  👤
                </div>
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
