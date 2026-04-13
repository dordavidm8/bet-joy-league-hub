import { useAuth } from "@/context/AuthContext";
import NotificationBell from "@/components/NotificationBell";

const TopBar = () => {
  const { backendUser } = useAuth();
  const points = backendUser?.points_balance ?? 0;

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md">
      <div className="flex items-center justify-between px-5 h-14 max-w-lg mx-auto">
        <h1 className="text-xl font-black tracking-tight">Kickoff</h1>
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
