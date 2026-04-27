import React, { useState } from 'react';
import StageNode from '../ui/StageNode';
import { useAgentRunStream } from '../hooks/useAgentRunStream';
import { Play } from 'lucide-react';

export default function PipelineTimeline() {
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const { events, isLive } = useAgentRunStream(activeRunId);

  // Derive pipeline state from basic ordered steps we expect
  const stages = [
    { id: 'research', label: '1. איסוף נתונים', agent: 'research-agent' },
    { id: 'strategy', label: '2. אסטרטגיה', agent: 'strategy-agent' },
    { id: 'creative', label: '3. קריאייטיב', agent: 'creative-content-agent' },
    { id: 'seo', label: '4. אופטימיזציה', agent: 'seo-geo-agent' },
    { id: 'packager', label: '5. הכנת טיוטות', agent: 'draft-packager' }
  ];

  const handleStartRun = async () => {
    try {
      const res = await fetch('/api/agents/runs', { method: 'POST' });
      if (res.ok) {
        const body = await res.json();
        setActiveRunId(body.runId);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col h-full pt-4">
      <div className="flex items-center justify-between mb-6 px-2">
        <h3 className="font-bold">🖥️ ניטור ריצות חיות</h3>
        <button 
           onClick={handleStartRun}
           disabled={isLive}
           className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 disabled:opacity-50 shadow-md"
        >
          <Play size={14} /> {isLive ? 'Pipeline רץ...' : 'הפעלה ידנית'}
        </button>
      </div>

      <div className="overflow-y-auto px-2 space-y-2">
        {stages.map((stage, index) => {
          // Find matching event from stream to determine status
          const eventForStage = [...events].reverse().find(e => e.agent === stage.agent);
          
          let status: 'pending' | 'running' | 'completed' | 'failed' = 'pending';
          if (eventForStage) {
            if (eventForStage.type === 'stage_started') status = 'running';
            if (eventForStage.type === 'stage_completed') status = 'completed';
            if (eventForStage.type === 'stage_failed') status = 'failed';
          } else if (events.length > 0) {
            // If we have started but not reached this stage yet, it's pending.
            // If the whole pipeline finished and we didn't see it, it might still just be pending (skipped)
          }

          return (
            <StageNode 
              key={stage.id}
              label={stage.label}
              agentName={stage.agent}
              status={status}
              isLast={index === stages.length - 1}
            />
          );
        })}
      </div>
    </div>
  );
}
