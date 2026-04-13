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
  const isLive = game.status === "live";
  const isFinished = game.status === "finished";
  const canBet = game.status === "scheduled";
  const hasScore = game.score_home != null && game.score_away != null;

  return (
    <div
      className="card-kickoff flex items-center gap-3 py-3 cursor-pointer hover:bg-secondary/60 transition-colors"
      onClick={() => navigate(`/game/${game.id}`)}
    >
      {/* Time / Score column */}
      <div className="flex flex-col items-center min-w-[52px] text-center shrink-0">
        {isLive ? (
          <>
            {hasScore ? (
              <span className="text-base font-black">{game.score_home} - {game.score_away}</span>
            ) : (
              <span className="text-sm font-bold">LIVE</span>
            )}
            <span className="flex items-center gap-0.5 text-[10px] font-bold text-primary">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              {game.minute ? `${game.minute}′` : "LIVE"}
            </span>
          </>
        ) : isFinished && hasScore ? (
          <>
            <span className="text-base font-black">{game.score_home} - {game.score_away}</span>
            <span className="text-[10px] text-muted-foreground">הסתיים</span>
          </>
        ) : (
          <>
            <span className="text-sm font-bold">{timeStr}</span>
            <span className="text-[11px] text-muted-foreground">{dateStr}</span>
          </>
        )}
      </div>

      {/* Teams */}
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

      {/* Action button */}
      <Button
        variant={canBet ? "cta" : "outline"}
        size="sm"
        onClick={(e) => { e.stopPropagation(); navigate(`/game/${game.id}`); }}
        className="shrink-0 text-xs px-3 py-1.5 h-auto"
      >
        {isLive ? "לייב" : isFinished ? "תוצאה" : "הימר"}
      </Button>
    </div>
  );
};

export default GameListItem;
