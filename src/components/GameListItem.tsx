import { Game } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface GameListItemProps {
  game: Game;
}

const GameListItem = ({ game }: GameListItemProps) => {
  const navigate = useNavigate();
  const start = new Date(game.start_time);
  const timeStr = start.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  const dateStr = start.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
  const canBet = game.status === "scheduled";

  return (
    <div className="card-kickoff flex items-center gap-3 py-3">
      <div className="flex flex-col items-center min-w-[52px] text-center">
        <span className="text-sm font-bold">{timeStr}</span>
        <span className="text-[11px] text-muted-foreground">{dateStr}</span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-muted-foreground mb-0.5 truncate">{game.competition_name ?? "כדורגל"}</p>
        <div className="flex items-center gap-1.5">
          {game.home_team_logo
            ? <img src={game.home_team_logo} className="w-4 h-4 object-contain" alt="" />
            : <span className="text-sm">⚽</span>}
          <span className="text-sm font-bold truncate">{game.home_team}</span>
          <span className="text-xs text-muted-foreground mx-1">נגד</span>
          {game.away_team_logo
            ? <img src={game.away_team_logo} className="w-4 h-4 object-contain" alt="" />
            : <span className="text-sm">⚽</span>}
          <span className="text-sm font-bold truncate">{game.away_team}</span>
        </div>
      </div>

      <Button
        variant="cta"
        size="sm"
        disabled={!canBet}
        onClick={() => navigate(`/game/${game.id}`)}
        className="shrink-0 text-xs px-3 py-1.5 h-auto"
      >
        הימר
      </Button>
    </div>
  );
};

export default GameListItem;
