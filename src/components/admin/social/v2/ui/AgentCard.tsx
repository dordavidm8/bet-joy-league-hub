import React from 'react';
import { Play, Activity, Clock } from 'lucide-react';

export interface AgentData {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'running' | 'offline';
  metadata: {
    avatar: string;
    title: string;
  };
}

export default function AgentCard({ agent }: { agent: AgentData }) {
  const isRunning = agent.status === 'running';

  return (
    <div className={`p-3 bg-white dark:bg-gray-800 border rounded-lg shadow-sm transition-all ${
      isRunning ? 'border-primary ring-1 ring-primary' : 'border-gray-200 dark:border-gray-700'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
           <span className="text-2xl">{agent.metadata.avatar}</span>
           <div>
             <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100">{agent.metadata.title}</h4>
             <p className="text-xs text-gray-500 font-mono">{agent.name}</p>
           </div>
        </div>
        <div className="flex flex-col items-end">
          {isRunning ? (
            <span className="flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
          ) : (
             <span className="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600"></span>
          )}
        </div>
      </div>
      
      <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
         <div className="flex items-center gap-1">
           <Activity size={12} className={isRunning ? 'text-green-500' : ''} />
           <span>{agent.status}</span>
         </div>
      </div>
    </div>
  );
}
