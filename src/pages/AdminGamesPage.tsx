import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle, Clock, Edit, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useState } from "react";
import AdminGameEditor from "@/components/AdminGameEditor";
import { generateGames } from "@/lib/api";

const GAME_TYPES = [
  { label: 'כל הסוגים', value: '' },
  { label: 'Missing XI', value: 'missing_xi' },
  { label: 'Who Are Ya?', value: 'who_are_ya' },
  { label: 'Career Path', value: 'career_path' },
  { label: 'Box2Box', value: 'box2box' },
  { label: 'Guess Club', value: 'guess_club' },
];

const AdminGamesPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingGame, setEditingGame] = useState<any>(null);
  const [selectedType, setSelectedType] = useState('');

  // Fetch games from the admin endpoint
  const { data: adminData, isLoading } = useQuery({
    queryKey: ["admin-games"],
    queryFn: async () => {
      const res = await fetch("/api/admin/games");
      if (!res.ok) throw new Error("Failed to fetch admin games");
      return res.json();
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = {};
      if (selectedType) body.game_type = selectedType;
      const res = await fetch('/api/admin/games/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Generation failed');
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["admin-games"] });
      const msg = selectedType
        ? `אתגר '${selectedType}' נוצר בסטטוס pending!`
        : 'כל סוגי האתגרים נוצרו!';
      alert(msg);
    },
  });

  const games = adminData?.games ?? [];

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* Header */}
      <div className="px-5 pt-4">
        <button onClick={() => navigate("/")} className="flex items-center gap-1 text-muted-foreground text-sm mb-3">
          <ArrowRight size={16} /> חזרה למסך הראשי
        </button>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black">ניהול אתגרים</h2>
          <div className="flex items-center gap-2">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="text-xs bg-secondary text-foreground border border-border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary cursor-pointer"
            >
              {GAME_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors text-xs font-bold"
              title="גנרט"
            >
              <Play size={14} className={generateMutation.isPending ? "animate-spin" : ""} />
              {generateMutation.isPending ? 'מייצר...' : 'גנרט'}
            </button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">ניהול סטטוסים, עריכת רמזים ואישור פתרונות</p>
      </div>

      {/* Stats Summary */}
      <div className="px-5 grid grid-cols-3 gap-3">
        <div className="card-kickoff flex flex-col items-center p-3">
          <span className="text-xl font-black">{games.filter((g: any) => g.status === 'published').length}</span>
          <span className="text-[10px] text-muted-foreground">באוויר</span>
        </div>
        <div className="card-kickoff flex flex-col items-center p-3">
          <span className="text-xl font-black">{games.filter((g: any) => g.status === 'pending').length}</span>
          <span className="text-[10px] text-muted-foreground">ממתינים</span>
        </div>
        <div className="card-kickoff flex flex-col items-center p-3">
          <span className="text-xl font-black">{games.length}</span>
          <span className="text-[10px] text-muted-foreground">סה"כ</span>
        </div>
      </div>

      {/* Games List */}
      <div className="flex flex-col gap-3 px-5">
        <span className="section-label px-0">אתגרים אחרונים</span>
        {isLoading ? (
          <div className="text-center p-8 animate-pulse text-muted-foreground text-sm">טוען נתונים...</div>
        ) : games.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground text-sm">לא נמצאו אתגרים בבסיס הנתונים</div>
        ) : (
          games.map((game: any, i: number) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card-kickoff p-4 flex items-center justify-between group"
            >
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-xl ${
                  game.status === 'published' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'
                }`}>
                  {game.status === 'published' ? <CheckCircle size={20} /> : <Clock size={20} />}
                </div>
                <div>
                  <h4 className="font-bold text-sm leading-tight">
                    {game.type.replace('_', ' ').toUpperCase()}
                  </h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(game.play_date).toLocaleDateString("he-IL")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setEditingGame(game)}
                  className="p-2 text-muted-foreground hover:text-primary transition-colors opacity-100"
                  title="ערוך אתגר"
                >
                  <Edit size={16} />
                </button>
                <div className="text-[10px] font-bold px-2 py-0.5 bg-secondary rounded-full uppercase">
                   {game.status}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {editingGame && (
        <AdminGameEditor 
          game={editingGame} 
          onClose={() => setEditingGame(null)} 
        />
      )}
    </div>
  );
};

export default AdminGamesPage;
