// TopBar.tsx – כותרת עליונה (Header)
// מציג: לוגו Kickoff, לינקים לניווט (desktop), NotificationBell, תפריט משתמש.
// כולל כפתור לוח ניהול אם המשתמש הוא admin.
import { useAuth } from "@/context/AuthContext";
import NotificationBell from "@/components/NotificationBell";
import { HelpCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const TopBar = () => {
  const { backendUser, isGuest, exitGuest } = useAuth();
  const navigate = useNavigate();
  const points = backendUser?.points_balance ?? 0;

  const handleJoin = () => {
    exitGuest();
  };

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md">
      <div className="flex items-center justify-between px-5 md:px-8 h-14 max-w-lg md:max-w-7xl mx-auto">
        <button onClick={() => navigate("/")} className="flex items-center gap-2">
          <img src="/kickoff_logo_cropped.png" alt="DerbyUp" className="h-5 w-auto" />
          <span className="text-xl font-black tracking-tight leading-none">DerbyUp</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/help")}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-secondary transition-colors"
          >
            <HelpCircle size={20} className="text-muted-foreground" />
          </button>
          {isGuest ? (
            <button
              onClick={handleJoin}
              className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-full hover:opacity-90 transition-opacity"
            >
              הצטרף
            </button>
          ) : (
            <>
              <NotificationBell />
              <div className="flex items-center gap-1.5 bg-secondary rounded-full px-3 py-1.5">
                <span className="text-sm font-bold">{Math.floor(points).toLocaleString()}</span>
                <span className="text-xs text-muted-foreground">נקודות</span>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopBar;
