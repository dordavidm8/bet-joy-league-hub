import { useApp } from "@/context/AppContext";
import { useUserProfile, useUserBetHistory } from "@/hooks/useApi";
import { motion } from "framer-motion";
import { Bell, Globe, LogOut } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const ProfilePage = () => {
  const { userPoints } = useApp();
  const { data: profile } = useUserProfile();
  const { data: history } = useUserBetHistory();

  const displayPoints = profile?.points ?? userPoints;
  const wins = profile?.wins ?? 12;
  const totalBets = profile?.totalBets ?? 18;
  const successRate = profile?.successRate ?? 68;

  const betHistory = history ?? [
    { match: "מכבי ת״א נגד הפועל ב״ש", bet: "ניצחון מכבי ת״א", result: "ניצחון", points: "+250" },
    { match: "מכבי חיפה נגד הפועל ת״א", bet: "תיקו", result: "הפסד", points: "-100" },
    { match: "בית״ר נגד בני סכנין", bet: "2-3 שערים", result: "ניצחון", points: "+180" },
  ];

  return (
    <div className="flex flex-col gap-6 px-5 pt-4 pb-24">
      {/* Avatar + Info */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-kickoff flex flex-col items-center gap-3"
      >
        <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center text-3xl">
          👤
        </div>
        <h2 className="text-xl font-black">שחקן אורח</h2>
        <p className="text-sm text-muted-foreground">הצטרף מרץ 2026</p>
      </motion.div>

      {/* Stats */}
      <div className="flex gap-3">
        <div className="card-kickoff flex-1 flex flex-col items-center gap-1">
          <span className="text-xl font-black">{displayPoints.toLocaleString()}</span>
          <span className="text-xs text-muted-foreground">נקודות</span>
        </div>
        <div className="card-kickoff flex-1 flex flex-col items-center gap-1">
          <span className="text-xl font-black">{wins}/{totalBets}</span>
          <span className="text-xs text-muted-foreground">ניצחונות/הימורים</span>
        </div>
        <div className="card-kickoff flex-1 flex flex-col items-center gap-1">
          <span className="text-xl font-black">{successRate}%</span>
          <span className="text-xs text-muted-foreground">הצלחה</span>
        </div>
      </div>

      {/* Bet History */}
      <section className="flex flex-col gap-3">
        <span className="section-label">היסטוריית הימורים</span>
        {betHistory.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card-kickoff flex items-center justify-between"
          >
            <div>
              <p className="text-sm font-bold">{item.match}</p>
              <p className="text-xs text-muted-foreground">{item.bet}</p>
            </div>
            <div className="text-left">
              <p className={`text-sm font-bold ${item.result === "ניצחון" ? "text-primary" : "text-muted-foreground"}`}>
                {item.points}
              </p>
            </div>
          </motion.div>
        ))}
      </section>

      {/* Settings */}
      <section className="flex flex-col gap-2">
        <span className="section-label">הגדרות</span>
        {[
          { icon: Bell, label: "התראות" },
          { icon: Globe, label: "שפה" },
          { icon: LogOut, label: "התנתק" },
        ].map((item, i) => (
          <button key={i} className="card-kickoff flex items-center gap-3 text-right">
            <item.icon size={18} className="text-muted-foreground" />
            <span className="text-sm font-medium">{item.label}</span>
          </button>
        ))}
      </section>
    </div>
  );
};

export default ProfilePage;
