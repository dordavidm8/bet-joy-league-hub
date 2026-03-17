import { useLeagues } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import { Plus, Users, Trophy, Lock, Globe } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const LeaguesPage = () => {
  const [showCreate, setShowCreate] = useState(false);
  const { data: leagues = [], isLoading } = useLeagues();

  return (
    <div className="flex flex-col gap-6 px-5 pt-4 pb-24">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black">הליגות שלי</h2>
        <Button variant="default" size="sm" onClick={() => setShowCreate(!showCreate)}>
          <Plus size={16} />
          צור ליגה
        </Button>
      </div>

      {showCreate && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="card-kickoff flex flex-col gap-4 overflow-hidden"
        >
          <h3 className="font-bold">ליגה חדשה</h3>
          <input
            placeholder="שם הליגה"
            className="bg-secondary rounded-[16px] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
          <div className="flex gap-2">
            <Button variant="option" size="sm" className="flex-1">
              <Globe size={14} /> פתוחה
            </Button>
            <Button variant="option" size="sm" className="flex-1">
              <Lock size={14} /> הזמנה בלבד
            </Button>
          </div>
          <select className="bg-secondary rounded-[16px] px-4 py-3 text-sm outline-none appearance-none">
            <option>פורמט: הכל לזוכה</option>
            <option>פורמט: תשלום למשחק</option>
          </select>
          <select className="bg-secondary rounded-[16px] px-4 py-3 text-sm outline-none appearance-none">
            <option>משך: עונה מלאה</option>
            <option>משך: סבב בודד</option>
            <option>משך: טורניר</option>
          </select>
          <Button variant="cta" size="lg" onClick={() => setShowCreate(false)}>
            צור ליגה
          </Button>
        </motion.div>
      )}

      {/* League List */}
      <div className="flex flex-col gap-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-[20px]" />
          ))
        ) : (
          leagues.map((league, i) => (
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
                    {league.isPrivate && <Lock size={12} className="text-muted-foreground" />}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users size={12} /> {league.memberCount} חברים
                  </p>
                </div>
              </div>
              <div className="text-left">
                <p className="text-sm font-black">#{league.rank}</p>
                <p className="text-xs text-muted-foreground">{league.points.toLocaleString()} נק׳</p>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default LeaguesPage;
