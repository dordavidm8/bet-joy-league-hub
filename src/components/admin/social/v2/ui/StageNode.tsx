import React from 'react';
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';

export type StageStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface StageNodeProps {
  label: string;
  status: StageStatus;
  agentName?: string;
  isLast?: boolean;
}

export default function StageNode({ label, status, agentName, isLast }: StageNodeProps) {
  return (
    <div className="relative flex gap-4">
      {!isLast && (
        <div className={`absolute right-3 top-8 bottom-[-16px] w-[2px] ${status === 'completed' ? 'bg-primary' : 'bg-border'}`} />
      )}
      
      <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background">
        {status === 'completed' && <CheckCircle2 className="h-6 w-6 text-primary" />}
        {status === 'running' && <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />}
        {status === 'failed' && <XCircle className="h-6 w-6 text-destructive" />}
        {status === 'pending' && <Circle className="h-6 w-6 text-muted-foreground" />}
      </div>
      
      <div className="flex flex-col pb-6 pt-1">
        <span className={`text-sm font-semibold ${status === 'running' ? 'text-blue-500' : status === 'completed' ? 'text-foreground' : 'text-muted-foreground'}`}>
          {label}
        </span>
        {agentName && (
          <span className="text-xs text-muted-foreground mt-1">
            מבוצע ע"י: <span className="font-mono">{agentName}</span>
          </span>
        )}
      </div>
    </div>
  );
}
