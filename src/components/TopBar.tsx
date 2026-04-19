import { useAuth } from "@/context/AuthContext";
import NotificationBell from "@/components/NotificationBell";
import { useNavigate } from "react-router-dom";

const TopBar = () => {
  const { backendUser } = useAuth();
  const navigate = useNavigate();
  const points = backendUser?.points_balance ?? 0;

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md">
      <div className="flex items-center justify-between px-5 h-14 max-w-lg mx-auto">
        <button onClick={() => navigate("/")} className="flex items-center gap-2">
          <img src="/kickoff_logo_cropped.png" alt="Kickoff" className="h-8 w-auto" />
          <span className="text-xl font-black tracking-tight">Kickoff</span>
        </button>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <div className="flex items-center gap-1.5 bg-secondary rounded-full px-3 py-1.5">
            <span className="text-sm font-bold">{points.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground">נקודות</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
