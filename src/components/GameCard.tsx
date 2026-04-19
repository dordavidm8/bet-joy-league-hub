import { Game } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { translateTeam } from "@/lib/teamNames";

interface GameCardProps {
  game: Game;
  index: number;
}

const GameCard = ({ game, index }: GameCardProps) => {
  const navigate = useNavigate();
  const isLive = game.status === "live";
  const isFinished = game.status === "finished";

  const startDate = new Date(game.start_time);
  const timeLabel = isLive
    ? game.minute ? `${game.minute}′` : "LIVE"
    : startDate.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  const dateLabel = isLive ? null : startDate.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.32, 0.72, 0, 1] }}
      className="card-kickoff min-w-[280px] flex flex-col gap-4 snap-center"
    >
      {/* Competition + Live badge */}
      <div className="flex items-center justify-between">
        <span className="section-label">{game.competition_name ?? "כדורגל"}</span>
        {isLive && (
          <span className="flex items-center gap-1 text-xs font-bold text-primary">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            LIVE
          </span>
        )}
        {isFinished && (
          <span className="text-xs font-bold text-muted-foreground">הסתיים</span>
        )}
      </div>

      {/* Teams */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col items-center gap-1 flex-1">
          {game.home_team_logo
            ? <img src={game.home_team_logo} className="w-8 h-8 object-contain" alt="" />
            : <span className="text-2xl">⚽</span>}
          <span className="text-sm font-bold text-center leading-tight">{translateTeam(game.home_team)}</span>
        </div>

        <div className="flex flex-col items-center">
          {(isLive || isFinished) && game.score_home != null ? (
            <span className="text-2xl font-black">{game.score_home} - {game.score_away}</span>
          ) : (
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-muted-foreground">{timeLabel}</span>
              {dateLabel && <span className="text-xs text-muted-foreground">{dateLabel}</span>}
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-1 flex-1">
          {game.away_team_logo
            ? <img src={game.away_team_logo} className="w-8 h-8 object-contain" alt="" />
            : <span className="text-2xl">⚽</span>}
          <span className="text-sm font-bold text-center leading-tight">{translateTeam(game.away_team)}</span>
        </div>
      </div>

      {/* CTA */}
      <Button
        variant="cta"
        size="default"
        onClick={() => navigate(`/game/${game.id}`)}
        className="w-full"
        disabled={isFinished}
      >
        {isFinished ? "הסתיים" : "המר עכשיו"}
      </Button>
    </motion.div>
  );
};

export default GameCard;
