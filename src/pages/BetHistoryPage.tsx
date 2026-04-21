import { useQuery } from "@tanstack/react-query";
import { getMyBets } from "@/lib/api";
import { motion } from "framer-motion";
import { ArrowRight, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const STATUS_TABS = [
  { value: "",              label: "הכל" },
  { value: "pending",       label: "ממתין" },
  { value: "won",           label: "זכיתי" },
  { value: "lost",          label: "הפסדתי" },
  { value: "parlay_failed", label: "פרליי נכשל" },
  { value: "cancelled",     label: "בוטל" },
];

const STATUS_COLOR: Record<string, string> = {
  won:           "text-primary",
  lost:          "text-destructive",
  pending:       "text-muted-foreground",
  cancelled:     "text-muted-foreground",
  parlay_failed: "text-amber-600",
};

const STATUS_LABEL: Record<string, string> = {
  won:           "ניצחון",
  lost:          "הפסד",
  pending:       "ממתין",
  cancelled:     "בוטל",
  parlay_failed: "פרליי נכשל",
};

const PAGE_SIZE = 20;

const BetHistoryPage = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [offset, setOffset] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["my-bets-full", status, search, offset],
    queryFn: () => getMyBets({ status: status || undefined, search: search || undefined, limit: PAGE_SIZE, offset }),
  });

  const bets = data?.bets ?? [];
  const total = data?.total ?? 0;

  const handleSearch = () => {
    setSearch(searchInput);
    setOffset(0);
  };

  const handleStatusChange = (val: string) => {
    setStatus(val);
    setOffset(0);
  };

  return (
    <div className="flex flex-col gap-4 pb-24">
      {/* Header */}
      <div className="px-5 pt-2">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-muted-foreground text-sm mb-3">
          <ArrowRight size={16} /> חזרה
        </button>
        <h2 className="text-2xl font-black">היסטוריית הימורים</h2>
        {total > 0 && <p className="text-xs text-muted-foreground mt-0.5">{total.toLocaleString()} הימורים סה״כ</p>}
      </div>

      {/* Search */}
      <div className="px-5 flex gap-2">
        <input
          type="text"
          placeholder="חפש קבוצה..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSearch()}
          className="flex-1 bg-secondary rounded-xl px-4 py-2.5 text-sm outline-none"
          dir="rtl"
        />
        <button
          onClick={handleSearch}
          className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
        >
          <Search size={16} />
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 px-5 overflow-x-auto scrollbar-hide">
        {STATUS_TABS.map(t => (
          <button
            key={t.value}
            onClick={() => handleStatusChange(t.value)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
              status === t.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Bets list */}
      <div className="flex flex-col gap-2 px-5">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">טוען...</p>
        ) : bets.length === 0 ? (
          <p className="text-sm text-muted-foreground">אין הימורים תואמים</p>
        ) : (
          bets.map((bet, i) => (
            <motion.div
              key={bet.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="card-kickoff flex flex-col gap-2"
            >
              {/* Competition + date + parlay badge */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{bet.competition_name ?? "כדורגל"}</span>
                <div className="flex items-center gap-2">
                  {bet.parlay_number && (
                    <span className="text-[10px] font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                      🔗 פרליי #{bet.parlay_number}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(bet.placed_at).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "2-digit" })}
                  </span>
                </div>
              </div>

              {/* Teams */}
              <p className="text-sm font-bold">{bet.home_team} נגד {bet.away_team}</p>

              {/* Question + selection */}
              {bet.question_text && (
                <p className="text-xs text-muted-foreground">{bet.question_text}</p>
              )}
              <p className="text-xs font-semibold">
                הבחירה שלי: <span className="text-foreground">{bet.selected_outcome}</span>
                {bet.exact_score_prediction && <span className="text-foreground"> (תוצאה: {bet.exact_score_prediction})</span>}
                <span className="text-muted-foreground ml-2">×{parseFloat(String(bet.odds)).toFixed(2)}</span>
              </p>

              {/* Stake / payout row */}
              <div className="flex items-center justify-between pt-1 border-t border-border">
                <span className="text-xs text-muted-foreground">הימור: {bet.stake.toLocaleString()} נק׳</span>
                <div className="flex items-center gap-2">
                  {bet.status === "won" && bet.actual_payout != null && (
                    <span className="text-xs font-bold text-primary">+{bet.actual_payout.toLocaleString()} נק׳</span>
                  )}
                  {bet.status === "lost" && (
                    <span className="text-xs font-bold text-destructive">-{bet.stake.toLocaleString()} נק׳</span>
                  )}
                  {bet.status === "pending" && (
                    <span className="text-xs text-muted-foreground">אפשרי: {bet.potential_payout.toLocaleString()} נק׳</span>
                  )}
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-secondary ${STATUS_COLOR[bet.status]}`}>
                    {STATUS_LABEL[bet.status] ?? bet.status}
                  </span>
                </div>
              </div>

              {/* Final score if finished */}
              {bet.score_home != null && bet.score_away != null && (
                <p className="text-[11px] text-muted-foreground">
                  תוצאה סופית: {bet.home_team} {bet.score_home} - {bet.score_away} {bet.away_team}
                </p>
              )}

              {/* WhatsApp share on won bets */}
              {bet.status === "won" && bet.actual_payout != null && (
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`🏆 ניצחתי +${bet.actual_payout.toLocaleString()} נקודות על ${bet.home_team} נגד ${bet.away_team} (×${parseFloat(String(bet.odds)).toFixed(2)})! הצטרף ל-Kickoff 🎯`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="self-start text-xs font-bold text-green-600 hover:text-green-700 transition-colors"
                >
                  שתף ב-WhatsApp
                </a>
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex justify-center gap-3 px-5">
          <button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            className="px-4 py-2 rounded-xl bg-secondary text-sm font-medium disabled:opacity-40"
          >
            הקודם
          </button>
          <span className="flex items-center text-xs text-muted-foreground">
            {Math.floor(offset / PAGE_SIZE) + 1} / {Math.ceil(total / PAGE_SIZE)}
          </span>
          <button
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            className="px-4 py-2 rounded-xl bg-secondary text-sm font-medium disabled:opacity-40"
          >
            הבא
          </button>
        </div>
      )}
    </div>
  );
};

export default BetHistoryPage;
