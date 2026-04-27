import React from 'react';
import { Activity } from 'lucide-react';

export interface AgentData {
  id: string;
  skill_name: string;
  role: string;
  title: string;
  avatar: string;
  enabled: boolean;
  last_run_at: string | null;
}

export default function AgentCard({ agent }: { agent: AgentData }) {
  return (
    <div className={`p-3 bg-white dark:bg-gray-800 border rounded-lg shadow-sm transition-all border-gray-200 dark:border-gray-700`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
           <span className="text-2xl">{agent.avatar}</span>
           <div>
             <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100">{agent.title}</h4>
             <p className="text-xs text-gray-500 font-mono">{agent.skill_name}</p>
           </div>
        </div>
      </div>
      
      <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
         <div className="flex items-center gap-1">
           <Activity size={12} />
           <span>{agent.enabled ? 'Active' : 'Disabled'}</span>
         </div>
      </div>
    </div>
  );
}
