import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { advisorGetStats, advisorGetToolStats, advisorGetTopUsers, advisorGetEvents } from '@/lib/api';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const KPICard = ({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) => (
  <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-2xl font-black">{value}</span>
    {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
  </div>
);

const fmt = (n: number | string | null) => n == null ? '—' : Number(n).toLocaleString('he-IL');

export const StatsPanel = () => {
  const [days, setDays] = useState(30);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['advisor-stats', days],
    queryFn: () => advisorGetStats(days),
  });
  const { data: tools } = useQuery({
    queryKey: ['advisor-tools', days],
    queryFn: () => advisorGetToolStats(days),
  });
  const { data: users } = useQuery({
    queryKey: ['advisor-users', days],
    queryFn: () => advisorGetTopUsers(days),
  });
  const { data: events } = useQuery({
    queryKey: ['advisor-events'],
    queryFn: () => advisorGetEvents(30, 0),
  });

  if (isLoading) return <div className="py-12 text-center text-sm text-muted-foreground">טוען...</div>;

  const ov = stats?.overview as Record<string, unknown> | undefined;
  const daily = stats?.daily ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2">
        {[7, 30, 90].map(d => (
          <button key={d} onClick={() => setDays(d)}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${days === d ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>
            {d}ד
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard label="בקשות" value={fmt(ov?.total_requests as number)} />
        <KPICard label="tokens" value={fmt(ov?.total_tokens as number)} />
        <KPICard label="עלות (USD)" value={`$${Number(ov?.cost_usd ?? 0).toFixed(4)}`} />
        <KPICard label="שגיאות" value={fmt(ov?.error_count as number)} sub={`p95: ${fmt(ov?.p95_ms as number)}ms`} />
      </div>

      {daily.length > 0 && (
        <div>
          <h3 className="font-bold text-sm mb-2">בקשות יומיות</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="requests" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {tools && tools.length > 0 && (
        <div>
          <h3 className="font-bold text-sm mb-2">שימוש בכלים</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={tools} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="tool_name" type="category" tick={{ fontSize: 10 }} width={140} />
              <Tooltip />
              <Bar dataKey="calls" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {users && users.length > 0 && (
        <div>
          <h3 className="font-bold text-sm mb-2">משתמשים מובילים</h3>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="p-2 text-right">משתמש</th>
                  <th className="p-2 text-right">בקשות</th>
                  <th className="p-2 text-right">tokens</th>
                </tr>
              </thead>
              <tbody>
                {users.slice(0, 20).map(u => (
                  <tr key={u.user_id} className="border-t border-border">
                    <td className="p-2 font-mono">{u.user_id.slice(0, 12)}…</td>
                    <td className="p-2">{fmt(u.requests)}</td>
                    <td className="p-2">{fmt(u.tokens)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {events && events.length > 0 && (
        <div>
          <h3 className="font-bold text-sm mb-2">אירועים אחרונים</h3>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="p-2 text-right">סוג</th>
                  <th className="p-2 text-right">כלי</th>
                  <th className="p-2 text-right">tokens</th>
                  <th className="p-2 text-right">ms</th>
                  <th className="p-2 text-right">שגיאה</th>
                  <th className="p-2 text-right">זמן</th>
                </tr>
              </thead>
              <tbody>
                {events.map(e => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="p-2 font-bold">{e.event_type}</td>
                    <td className="p-2">{e.tool_name ?? '—'}</td>
                    <td className="p-2">{fmt(e.total_tokens)}</td>
                    <td className="p-2">{fmt(e.duration_ms)}</td>
                    <td className="p-2 text-destructive">{e.error_message?.slice(0, 30) ?? ''}</td>
                    <td className="p-2 text-muted-foreground">{new Date(e.created_at).toLocaleTimeString('he-IL')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
