import { useApp } from "@/context/AppContext";

const TopBar = () => {
  const { userPoints } = useApp();

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md">
      <div className="flex items-center justify-between px-5 h-14 max-w-lg mx-auto">
        <h1 className="text-xl font-black tracking-tight">Kickoff</h1>
        <div className="flex items-center gap-1.5 bg-secondary rounded-full px-3 py-1.5">
          <span className="text-sm font-bold">{userPoints.toLocaleString()}</span>
          <span className="text-xs text-muted-foreground">נקודות</span>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
