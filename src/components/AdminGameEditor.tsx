import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateAdminGame } from "@/lib/api";
import { X, Save, AlertCircle } from "lucide-react";

interface AdminGameEditorProps {
  game: any;
  onClose: () => void;
}

const AdminGameEditor = ({ game, onClose }: AdminGameEditorProps) => {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(game.status);
  const [puzzleData, setPuzzleData] = useState(JSON.stringify(game.puzzle_data, null, 2));
  const [solution, setSolution] = useState(JSON.stringify(game.solution, null, 2));

  const mutation = useMutation({
    mutationFn: (data: any) => updateAdminGame(game.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-games"] });
      onClose();
    },
  });

  const handleSave = () => {
    try {
      const parsedData = JSON.parse(puzzleData);
      const parsedSolution = JSON.parse(solution);
      mutation.mutate({ 
        status, 
        puzzle_data: parsedData, 
        solution: parsedSolution 
      });
    } catch (e) {
      alert("Invalid JSON format in puzzle data or solution");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-card w-full max-w-2xl rounded-3xl p-6 shadow-2xl flex flex-col gap-6 max-h-[90vh] overflow-y-auto border border-border"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black">ערוך אתגר</h3>
            <p className="text-xs text-muted-foreground uppercase">{game.type.replace('_', ' ')} · {game.id.substring(0,8)}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">סטטוס</label>
            <div className="flex gap-2">
              {['pending', 'approved', 'published'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all border ${
                    status === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-muted-foreground border-transparent'
                  }`}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1">נתוני חידה (JSON)</label>
              <textarea
                value={puzzleData}
                onChange={(e) => setPuzzleData(e.target.value)}
                className="w-full h-64 bg-secondary/50 rounded-2xl p-4 font-mono text-[11px] outline-none focus:ring-2 focus:ring-primary border border-transparent"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1">פתרון (JSON)</label>
              <textarea
                value={solution}
                onChange={(e) => setSolution(e.target.value)}
                className="w-full h-64 bg-secondary/50 rounded-2xl p-4 font-mono text-[11px] outline-none focus:ring-2 focus:ring-primary border border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button 
            onClick={onClose}
            className="flex-1 py-4 px-6 rounded-2xl bg-secondary text-sm font-bold hover:bg-secondary/80 transition-colors"
          >
            ביטול
          </button>
          <button 
            onClick={handleSave}
            disabled={mutation.isPending}
            className="flex-1 py-4 px-6 rounded-2xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            {mutation.isPending ? "שומר..." : <><Save size={18} /> שמור שינויים</>}
          </button>
        </div>

        {mutation.error && (
          <div className="p-4 bg-destructive/10 text-destructive rounded-2xl flex items-center gap-2 text-xs font-medium">
             <AlertCircle size={14} />
             <span>שגיאה בשמירת הנתונים: {mutation.error.message}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminGameEditor;
