import { useState, useEffect } from 'react';

export interface StreamEvent {
  type: string;
  timestamp: string;
  agent?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  message?: string;
  data?: any;
}

export function useAgentRunStream(runId: string | null) {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    if (!runId) return;

    setIsLive(true);
    setEvents([]);

    const evtSource = new EventSource(`/api/agents/runs/${runId}/stream`);

    evtSource.onmessage = (event) => {
      try {
        const parsed: StreamEvent = JSON.parse(event.data);
        setEvents((prev) => [...prev, parsed]);
        
        if (parsed.type === 'pipeline_complete' || parsed.type === 'pipeline_failed') {
          evtSource.close();
          setIsLive(false);
        }
      } catch (err) {
        console.error("Failed to parse SSE JSON", err);
      }
    };

    evtSource.onerror = (err) => {
      console.error("EventSource failed:", err);
      evtSource.close();
      setIsLive(false);
    };

    return () => {
      evtSource.close();
    };
  }, [runId]);

  return { events, isLive };
}
