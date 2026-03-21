import { useQuery } from "@tanstack/react-query";
import { getGames } from "@/lib/api";
import GameListItem from "@/components/GameListItem";
import { motion } from "framer-motion";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const LEAGUES = [
  { value: "", label: "כל הליגות" },
  { value: "Premier League", label: "Premier League" },
  { value: "La Liga", label: "La Liga" },
  { value: "Bundesliga", label: "Bundesliga" },
  { value: "Serie A", label: "Serie A" },
  { value: "Ligue 1", label: "Ligue 1" },
  { value: "UEFA Champions League", label: "Champions League" },
  { value: "Israeli Premier League", label: "ליגת העל" },
];

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

const AllGamesPage = () => {
  const navigate = useNavigate();
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [league, setLeague] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState(toDateStr(today));
  const [to, setTo] = useState(toDateStr(nextWeek));

  const { data, isLoading } = useQuery({
    queryKey: ["all-games", league, search, from, to],
    queryFn: () => getGames({
      status: "scheduled",
      ...(league ? { competition: league } : {}),
      ...(search ? { search } : {}),
      from,
      to,
    }),
  });

  const games = data?.games ?? [];

  return (
    <div className="flex flex-col gap-4 pb-24">
      {/* Header */}
      <div className="px-5 pt-2">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-muted-foreground text-sm mb-3">
          <ArrowRight size={16} /> חזרה
        </button>
        <h2 className="text-2xl font-black">כל המשחקים</h2>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 px-5">
        <select
          value={league}
          onChange={e => setLeague(e.target.value)}
          className="bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none w-full"
          dir="rtl"
        >
          {LEAGUES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>

        <input
          type="text"
          placeholder="חפש קבוצה..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none w-full"
          dir="rtl"
        />

        <div className="flex gap-2">
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">מתאריך</label>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="bg-secondary rounded-xl px-3 py-2 text-sm outline-none w-full"
            />
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">עד תאריך</label>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="bg-secondary rounded-xl px-3 py-2 text-sm outline-none w-full"
            />
          </div>
        </div>
      </div>

      {/* Games list */}
      <div className="flex flex-col gap-2 px-5">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">טוען משחקים...</p>
        ) : games.length === 0 ? (
          <p className="text-sm text-muted-foreground">לא נמצאו משחקים בטווח זה</p>
        ) : (
          games.map((game, i) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <GameListItem game={game} />
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default AllGamesPage;
