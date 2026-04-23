// StatsPage.tsx – סטטיסטיקות הימורים
// מציג: ROI, win rate, הימורים לפי תחרות, מגמות חודשיות.
// ויזואליזציה עם Recharts (charts וגרפים).
import { useQuery } from "@tanstack/react-query";
import { getDetailedStats } from "@/lib/api";
import { motion } from "framer-motion";
import { ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { useNavigate } from "react-router-dom";

const StatCard = ({ label, value, sub, highlight }: { label: string; value: string | number; sub?: string; highlight?: boolean }) => (
  <div className={`card-kickoff flex flex-col items-center gap-1 py-4 ${highlight ? "border border-primary/30 bg-primary/5" : ""}`}>
    <span className={`text-2xl font-black ${highlight ? "text-primary" : ""}`}>{value}</span>
    <span className="text-xs text-muted-foreground text-center">{label}</span>
    {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
  </div>
);

const MONTH_LABELS: Record<string, string> = {
  "01": "ינואר", "02": "פברואר", "03": "מרץ", "04": "אפריל",
  "05": "מאי",   "06": "יוני",   "07": "יולי", "08": "אוגוסט",
  "09": "ספטמבר","10": "אוקטובר","11": "נובמבר","12": "דצמבר",
};

function monthLabel(yyyyMM: string) {
  const [year, month] = yyyyMM.split("-");
  return `${MONTH_LABELS[month] ?? month} ${year}`;
}

const StatsPage = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["detailed-stats"], queryFn: getDetailedStats });

  if (isLoading) return <div className="p-5 text-sm text-muted-foreground">טוען סטטיסטיקות...</div>;
  if (!data) return null;

  const { summary: s, by_competition, monthly } = data;
  const netPositive = s.net_profit >= 0;

  return (
    <div className="flex flex-col gap-6 px-5 pt-4 pb-24">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-muted-foreground text-sm self-start">
        <ArrowRight size={16} /> חזרה
      </button>
      <h2 className="text-2xl font-black">הסטטיסטיקות שלי</h2>

      {/* Main grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="אחוז הצלחה" value={`${s.win_rate}%`} sub={`${s.total_wins}/${s.total_settled}`} highlight />
        <StatCard label="רצף נוכחי" value={s.current_streak > 0 ? `🔥 ${s.current_streak}` : "—"} sub="ניצחונות ברצף" />
        <StatCard label="הרוויח סה״כ" value={`${netPositive ? "+" : ""}${s.net_profit.toLocaleString()} נק׳`}
          sub={netPositive ? "רווח" : "הפסד"} highlight={netPositive} />
        <StatCard label="הימור ממתין" value={s.total_pending} />
        <StatCard label="הגדול ביותר" value={`+${s.biggest_win.toLocaleString()}`} sub="ניצחון בודד" />
        <StatCard label="מכפיל מקסימלי" value={s.best_odds_won > 0 ? `×${s.best_odds_won.toFixed(2)}` : "—"} sub="בניצחון" />
        <StatCard label="ניצחונות פרלאי" value={s.parlay_wins} />
        <StatCard label="הוצאה סה״כ" value={`${s.total_staked.toLocaleString()} נק׳`} sub="הושקע" />
      </div>

      {/* By competition */}
      {by_competition.length > 0 && (
        <section className="flex flex-col gap-3">
          <span className="section-label">ביצועים לפי תחרות</span>
          <div className="flex flex-col gap-2">
            {by_competition.map((c, i) => (
              <motion.div key={c.competition_name}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="card-kickoff flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-bold">{c.competition_name}</p>
                  <p className="text-xs text-muted-foreground">{c.wins}/{c.total} ניצחונות</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${c.win_rate}%` }} />
                  </div>
                  <span className="text-sm font-black text-primary w-10 text-left">{c.win_rate}%</span>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Monthly breakdown */}
      {monthly.length > 0 && (
        <section className="flex flex-col gap-3">
          <span className="section-label">חודש אחר חודש</span>
          <div className="flex flex-col gap-2">
            {monthly.map((m, i) => {
              const pos = parseInt(String(m.net)) >= 0;
              return (
                <motion.div key={m.month}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="card-kickoff flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-bold">{monthLabel(m.month)}</p>
                    <p className="text-xs text-muted-foreground">{m.wins} ניצחונות · {m.losses} הפסדות</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {pos ? <TrendingUp size={14} className="text-primary" /> : <TrendingDown size={14} className="text-destructive" />}
                    <span className={`text-sm font-black ${pos ? "text-primary" : "text-destructive"}`}>
                      {pos ? "+" : ""}{parseInt(String(m.net)).toLocaleString()}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {s.total_settled === 0 && (
        <p className="text-sm text-muted-foreground text-center pt-8">עוד אין הימורים מוגמרים</p>
      )}
    </div>
  );
};

export default StatsPage;
