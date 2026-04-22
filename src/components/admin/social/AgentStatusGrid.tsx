import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, CheckCircle2, XCircle, Clock, Zap } from 'lucide-react';

const API = '/api/social';

async function fetchStatus() {
  const r = await fetch(`${API}/status`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function fetchRuns() {
  const r = await fetch(`${API}/runs?limit=5`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const AGENT_DEFINITIONS = [
  { key: 'contentCalendar',  label: 'Content Calendar',   emoji: '📅', desc: 'Weekly theme generation' },
  { key: 'growthStrategy',   label: 'Growth Strategy',    emoji: '📈', desc: 'Content angle selection' },
  { key: 'contentCreator',   label: 'Content Creator',    emoji: '✍️', desc: '3× Groq parallel captions' },
  { key: 'visualCreator',    label: 'Visual Creator',     emoji: '🎨', desc: 'Nano Banana → Imagen 3' },
  { key: 'seoGeo',           label: 'SEO / GEO',          emoji: '🔍', desc: 'Hashtags + search optimization' },
  { key: 'publisher',        label: 'Publisher',          emoji: '📤', desc: 'LinkedIn · Instagram · TikTok' },
  { key: 'socialListening',  label: 'Social Listening',   emoji: '👂', desc: 'Serper + sentiment (every 4h)' },
  { key: 'analytics',        label: 'Analytics',          emoji: '📊', desc: 'Platform metrics (11:00 IST)' },
];

const STATUS_MAP: Record<string, { icon: React.ReactNode; cls: string }> = {
  completed: { icon: <CheckCircle2 size={14} />, cls: 'text-emerald-600' },
  running:   { icon: <Loader2 size={14} className="animate-spin" />, cls: 'text-blue-500' },
  failed:    { icon: <XCircle size={14} />, cls: 'text-red-500' },
  pending:   { icon: <Clock size={14} />, cls: 'text-amber-500' },
};

export const AgentStatusGrid = () => {
  const { data: status } = useQuery({ queryKey: ['social-status'], queryFn: fetchStatus, refetchInterval: 15_000 });
  const { data: runsData, isLoading: runsLoading } = useQuery({ queryKey: ['social-runs'], queryFn: fetchRuns, refetchInterval: 30_000 });

  const config = status?.config ?? {};
  const lastRun = runsData?.runs?.[0];

  return (
    <div className="flex flex-col gap-4">
      {/* System health bar */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${config.enabled === 'true' ? 'bg-emerald-50 border-emerald-200' : 'bg-secondary border-border'}`}>
        <div className={`w-2 h-2 rounded-full ${config.enabled === 'true' ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
        <div className="flex-1">
          <p className="text-sm font-bold">{config.enabled === 'true' ? '🟢 מערכת פעילה' : '⚫ מערכת כבויה'}</p>
          <p className="text-[10px] text-muted-foreground">
            Pipeline יומי: {config.posting_time ?? '08:00'} IST ·
            Auto-publish: {config.auto_approve === 'true' ? 'כן' : 'לא'} ·
            Model: {config.model ?? 'llama-3.3-70b-versatile'}
          </p>
        </div>
        <Zap size={16} className={config.enabled === 'true' ? 'text-emerald-500' : 'text-muted-foreground'} />
      </div>

      {/* Last run summary */}
      {lastRun && (
        <div className="border rounded-2xl p-4 flex flex-col gap-2 bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold">ריצה אחרונה</span>
            <span className={`flex items-center gap-1 text-xs font-bold ${STATUS_MAP[lastRun.status]?.cls ?? 'text-muted-foreground'}`}>
              {STATUS_MAP[lastRun.status]?.icon} {lastRun.status}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {new Date(lastRun.run_date).toLocaleDateString('he-IL')} ·
            {lastRun.weekly_theme?.theme_he ?? lastRun.weekly_theme?.theme ?? '—'} ·
            {lastRun.dry_run ? ' [Dry Run]' : ' [Live]'}
          </p>
          {lastRun.errors?.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">
              ⚠️ {lastRun.errors.length} שגיאות: {lastRun.errors.map((e: any) => e.agent).join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Agent cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {AGENT_DEFINITIONS.map(agent => {
          const agentLog = lastRun?.agent_log?.[agent.key];
          const status = agentLog ? (agentLog.error ? 'failed' : 'completed') : 'pending';
          const { icon, cls } = STATUS_MAP[status] ?? STATUS_MAP.pending;

          return (
            <div key={agent.key} className="border rounded-2xl p-3 flex flex-col gap-2 bg-card hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-base">{agent.emoji}</span>
                <span className={`flex items-center gap-0.5 ${cls}`}>{icon}</span>
              </div>
              <div>
                <p className="text-xs font-bold leading-tight">{agent.label}</p>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{agent.desc}</p>
              </div>
              {agentLog?.error && (
                <p className="text-[10px] text-red-600 truncate" title={agentLog.error}>{agentLog.error}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Pipeline history */}
      <div className="border rounded-2xl p-4 flex flex-col gap-3">
        <h3 className="text-sm font-bold">היסטוריית ריצות</h3>
        {runsLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 size={13} className="animate-spin" /> טוען...</div>
        ) : (
          <div className="flex flex-col gap-2">
            {(runsData?.runs ?? []).map((run: any) => (
              <div key={run.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                <span className={`${STATUS_MAP[run.status]?.cls ?? ''}`}>{STATUS_MAP[run.status]?.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{run.weekly_theme?.theme_he ?? run.weekly_theme?.theme ?? 'ללא נושא'}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(run.run_date).toLocaleDateString('he-IL')} {run.dry_run ? '· Dry Run' : ''}
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_MAP[run.status]?.cls ?? ''} bg-current/10`}>
                  {run.status}
                </span>
              </div>
            ))}
            {(runsData?.runs ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground">אין ריצות עדיין</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
