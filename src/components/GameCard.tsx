import { Game } from "@/lib/mockData";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface GameCardProps {
  game: Game;
  index: number;
}

const GameCard = ({ game, index }: GameCardProps) => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.32, 0.72, 0, 1] }}
      className="card-kickoff min-w-[280px] flex flex-col gap-4 snap-center"
    >
      {/* Competition + Live badge */}
      <div className="flex items-center justify-between">
        <span className="section-label">{game.competition}</span>
        {game.isLive && (
          <span className="flex items-center gap-1 text-xs font-bold text-primary">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            LIVE
          </span>
        )}
      </div>

      {/* Teams */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col items-center gap-1 flex-1">
          <span className="text-2xl">{game.homeTeam.logo}</span>
          <span className="text-sm font-bold text-center leading-tight">{game.homeTeam.name}</span>
        </div>

        <div className="flex flex-col items-center">
          {game.isLive && game.score ? (
            <span className="text-2xl font-black">
              {game.score.home} - {game.score.away}
            </span>
          ) : (
            <span className="text-lg font-bold text-muted-foreground">{game.time}</span>
          )}
        </div>

        <div className="flex flex-col items-center gap-1 flex-1">
          <span className="text-2xl">{game.awayTeam.logo}</span>
          <span className="text-sm font-bold text-center leading-tight">{game.awayTeam.name}</span>
        </div>
      </div>

      {/* CTA */}
      <Button variant="cta" size="default" onClick={() => navigate(`/game/${game.id}`)} className="w-full">
        הימר עכשיו
      </Button>
    </motion.div>
  );
};

export default GameCard;
