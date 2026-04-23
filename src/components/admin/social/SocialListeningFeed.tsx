// admin/social/SocialListeningFeed.tsx – פיד ניטור אזכורים
// מציג אזכורי המותג שנמצאו ברשת (social_mentions table).
// כולל: URL, sentiment (חיובי/שלילי/ניטרלי), PR risk flag.
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertTriangle, TrendingUp, Eye } from 'lucide-react';

const API = '/api/social';

async function fetchMentions() {
  const r = await fetch(`${API}/mentions`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function fetchCompetitor() {
  const r = await fetch(`${API}/competitor/posts`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const SENTIMENT_STYLE: Record<string, { cls: string; label: string }> = {
  positive: { cls: 'bg-emerald-100 text-emerald-700', label: '😊 חיובי' },
  negative: { cls: 'bg-red-100 text-red-700',         label: '😞 שלילי' },
  neutral:  { cls: 'bg-gray-100 text-gray-600',        label: '😐 נייטרל' },
  risk:     { cls: 'bg-orange-100 text-orange-700',    label: '⚠️ סיכון PR' },
};

export const SocialListeningFeed = () => {
  const { data: mentionsData, isLoading: mentionsLoading } = useQuery({
    queryKey: ['social-mentions'],
    queryFn: fetchMentions,
    staleTime: 60_000,
  });
  const { data: competitorData, isLoading: competitorLoading } = useQuery({
    queryKey: ['social-competitor'],
    queryFn: fetchCompetitor,
    staleTime: 60_000,
  });

  const mentions = mentionsData?.mentions ?? [];
  const competitors = competitorData?.posts ?? [];
  const risks = mentions.filter((m: any) => m.sentiment === 'risk' || m.sentiment === 'negative');

  return (
    <div className="flex flex-col gap-5">
      {/* PR Risk alert */}
      {risks.length > 0 && (
        <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 text-orange-800">
          <AlertTriangle size={18} className="shrink-0 text-orange-500" />
          <div>
            <p className="text-sm font-bold">{risks.length} התראות PR פעילות</p>
            <p className="text-xs">{risks[0]?.content?.slice(0, 80)}...</p>
          </div>
        </div>
      )}

      {/* Mentions */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Eye size={14} className="text-muted-foreground" />
          <h3 className="text-sm font-bold">אזכורים וסנטימנט</h3>
        </div>

        {mentionsLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4"><Loader2 size={14} className="animate-spin" /> סורק...</div>
        )}

        {!mentionsLoading && mentions.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-6 border-2 border-dashed rounded-2xl">
            <p>👂 אין אזכורים עדיין</p>
            <p className="text-xs mt-1">הסוכן יסרוק כל 4 שעות</p>
          </div>
        )}

        {mentions.map((m: any, i: number) => {
          const sent = SENTIMENT_STYLE[m.sentiment ?? 'neutral'];
          return (
            <div key={i} className="border rounded-2xl p-3 flex flex-col gap-2 bg-card">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sent.cls}`}>{sent.label}</span>
                <span className="text-[10px] text-muted-foreground">{m.source ?? 'web'}</span>
              </div>
              <p className="text-xs text-foreground leading-relaxed" dir="auto">{m.content}</p>
              {m.url && (
                <a href={m.url} target="_blank" rel="noreferrer"
                  className="text-[10px] text-primary hover:underline truncate">{m.url}</a>
              )}
            </div>
          );
        })}
      </div>

      {/* Competitor posts */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-muted-foreground" />
          <h3 className="text-sm font-bold">פעילות מתחרים</h3>
        </div>

        {competitorLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4"><Loader2 size={14} className="animate-spin" /> סורק...</div>
        )}

        {!competitorLoading && competitors.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-6 border-2 border-dashed rounded-2xl">
            <p>🔍 אין נתוני מתחרים</p>
          </div>
        )}

        {competitors.map((p: any, i: number) => (
          <div key={i} className="border rounded-2xl p-3 flex flex-col gap-1.5 bg-card">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">{p.competitor ?? 'מתחרה'}</span>
              <span className="text-[10px] text-muted-foreground">{p.platform}</span>
            </div>
            <p className="text-xs leading-relaxed" dir="auto">{p.content?.slice(0, 120)}...</p>
            <div className="flex gap-3 text-[10px] text-muted-foreground">
              {p.likes && <span>❤️ {p.likes}</span>}
              {p.comments && <span>💬 {p.comments}</span>}
              {p.shares && <span>🔁 {p.shares}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
