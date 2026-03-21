import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AiAdvisorProps {
  homeTeam: string;
  awayTeam: string;
  onClose: () => void;
}

const AiAdvisor = ({ homeTeam, awayTeam, onClose }: AiAdvisorProps) => {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-foreground/20 z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="absolute bottom-0 left-0 right-0 bg-card rounded-t-[24px] p-5 max-h-[70vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-lg">🤖 יועץ AI</h3>
            <button onClick={onClose} className="text-muted-foreground">
              <X size={20} />
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <div className="bg-secondary rounded-[16px] p-4">
              <p className="text-sm font-medium mb-2">
                ניתוח: {homeTeam} נגד {awayTeam}
              </p>
              <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                <li>• {homeTeam} בסדרת 4 ניצחונות רצופים בבית</li>
                <li>• {awayTeam} לא ניצחה מחוץ לבית ב-3 משחקים אחרונים</li>
                <li>• במפגשים האחרונים: 3 ניצחונות ל{homeTeam}, 1 תיקו, 1 ניצחון ל{awayTeam}</li>
              </ul>
            </div>

            <div className="bg-secondary rounded-[16px] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold">רמת ביטחון</span>
                <span className="text-sm font-black text-primary">72%</span>
              </div>
              <div className="w-full bg-border rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: "72%" }} />
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              ⚠️ בהתבסס על נתוני העבר בלבד. אין זה מהווה ייעוץ הימורים.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AiAdvisor;
