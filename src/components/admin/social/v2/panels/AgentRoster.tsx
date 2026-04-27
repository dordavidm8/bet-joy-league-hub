import React from 'react';
import { useQuery } from '@tanstack/react-query';
import AgentCard, { AgentData } from '../ui/AgentCard';
import { Bot, RefreshCw } from 'lucide-react';

export default function AgentRoster() {
  const { data: roster, isLoading, isError, refetch } = useQuery({
    queryKey: ['agent-roster-v2'],
    queryFn: async () => {
      const res = await fetch('/api/agents/roster');
      if (!res.ok) throw new Error('Failed to fetch roster');
      const data = await res.json();
      return (data.roster || []) as AgentData[];
    }
  });

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 border-l border-border">
      <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur z-10">
        <h2 className="text-lg font-bold flex items-center gap-2">
           <Bot className="text-primary" /> סגל סוכנים (Roster)
        </h2>
        <button onClick={() => refetch()} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>
      
      <div className="p-4 flex-1 overflow-y-auto">
        {isLoading && <div className="text-center p-8 text-muted-foreground animate-pulse">טוען סוכנים...</div>}
        {isError && <div className="text-center p-8 text-destructive bg-destructive/10 rounded-lg">שגיאה בטעינת הסגל</div>}
        
        {roster && (
          <div className="grid gap-3">
             {roster.map(agent => (
               <AgentCard key={agent.id} agent={agent} />
             ))}
          </div>
        )}
      </div>
    </div>
  );
}
