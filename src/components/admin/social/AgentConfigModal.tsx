// admin/social/AgentConfigModal.tsx – הגדרות סוכן מדיה חברתית
// Modal לעריכת: enabled, auto_approve, brand_voice, posting_time.
// שמירה ב-social_agent_config table.
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';

const API = '/api/social';

async function fetchConfig() {
  const r = await fetch(`${API}/config`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function patchConfig(updates: Record<string, string>) {
  const r = await fetch(`${API}/config`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates }) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const GROQ_MODELS = [
  { value: 'llama-3.3-70b-versatile', label: 'llama-3.3-70b-versatile ⭐ (ברירת מחדל)' },
  { value: 'llama-3.1-8b-instant',    label: 'llama-3.1-8b-instant (מהיר)' },
  { value: 'mixtral-8x7b-32768',      label: 'mixtral-8x7b-32768 (ארוך)' },
  { value: 'gemma2-9b-it',            label: 'gemma2-9b-it' },
];

const ConfigRow = ({ label, children, desc }: { label: string; children: React.ReactNode; desc?: string }) => (
  <div className="flex items-start justify-between gap-4 py-3 border-b last:border-0">
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-sm font-medium">{label}</span>
      {desc && <span className="text-[11px] text-muted-foreground">{desc}</span>}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

const BoolToggle = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <button onClick={() => onChange(value === 'true' ? 'false' : 'true')}
    className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${
      value === 'true' ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-secondary border-border text-muted-foreground'
    }`}>
    {value === 'true' ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
    {value === 'true' ? 'כן' : 'לא'}
  </button>
);

export const AgentConfigModal = () => {
  const qc = useQueryClient();
  const [local, setLocal] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['social-config'],
    queryFn: fetchConfig,
    onSuccess: (d: any) => setLocal(d.config ?? {}),
  } as any);

  const saveMut = useMutation({
    mutationFn: () => patchConfig(local),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['social-config', 'social-status'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const set = (key: string, value: string) => setLocal(p => ({ ...p, [key]: value }));

  if (isLoading) return <div className="flex items-center gap-2 text-sm text-muted-foreground py-8"><Loader2 size={16} className="animate-spin" /> טוען הגדרות...</div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">הגדרות מערכת</h3>
        <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
          className="flex items-center gap-1.5 text-xs font-bold bg-primary text-primary-foreground px-3 py-1.5 rounded-xl hover:bg-primary/90 disabled:opacity-60 transition-colors">
          {saveMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          {saved ? '✅ נשמר!' : 'שמור הגדרות'}
        </button>
      </div>

      <div className="border rounded-2xl p-4 flex flex-col bg-card">
        {/* Master switch */}
        <ConfigRow label="הפעל מערכת" desc="מאפשר/מבטל את כל הסוכנים">
          <BoolToggle value={local.enabled ?? 'false'} onChange={v => set('enabled', v)} />
        </ConfigRow>

        {/* Auto approve */}
        <ConfigRow label="פרסום אוטומטי" desc="פרסם בלי צורך באישור ידני">
          <BoolToggle value={local.auto_approve ?? 'false'} onChange={v => set('auto_approve', v)} />
        </ConfigRow>

        {/* Posting time */}
        <ConfigRow label="שעת pipeline" desc="שעה בשעון ישראל (IST)">
          <input value={local.posting_time ?? '08:00'} onChange={e => set('posting_time', e.target.value)}
            type="time" className="bg-secondary border rounded-xl px-3 py-1.5 text-sm outline-none w-28" />
        </ConfigRow>

        {/* Groq model */}
        <ConfigRow label="מודל Groq" desc="LLM לאייגנטים">
          <select value={local.model ?? 'llama-3.3-70b-versatile'} onChange={e => set('model', e.target.value)}
            className="bg-secondary border rounded-xl px-3 py-1.5 text-xs outline-none max-w-[220px]">
            {GROQ_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </ConfigRow>

        {/* Daily limit */}
        <ConfigRow label="מגבלת פוסטים יומית" desc="מספר פוסטים מקסימלי ביום">
          <input value={local.daily_limit ?? '3'} onChange={e => set('daily_limit', e.target.value)}
            type="number" min={1} max={10}
            className="bg-secondary border rounded-xl px-3 py-1.5 text-sm outline-none w-20 text-center" />
        </ConfigRow>

        {/* Platforms */}
        <ConfigRow label="LinkedIn" desc="פרסום ל-LinkedIn">
          <BoolToggle value={local.linkedin_enabled ?? 'true'} onChange={v => set('linkedin_enabled', v)} />
        </ConfigRow>
        <ConfigRow label="Instagram" desc="פרסום ל-Instagram">
          <BoolToggle value={local.instagram_enabled ?? 'true'} onChange={v => set('instagram_enabled', v)} />
        </ConfigRow>
        <ConfigRow label="TikTok" desc="פרסום ל-TikTok">
          <BoolToggle value={local.tiktok_enabled ?? 'true'} onChange={v => set('tiktok_enabled', v)} />
        </ConfigRow>

        {/* Brand voice */}
        <div className="py-3">
          <p className="text-sm font-medium mb-2">קול המותג</p>
          <textarea value={local.brand_voice ?? ''} onChange={e => set('brand_voice', e.target.value)}
            rows={3} dir="rtl" placeholder="תאר את הטון והסגנון של התוכן..."
            className="w-full bg-secondary border rounded-xl px-3 py-2 text-xs outline-none resize-none focus:ring-1 focus:ring-primary/30" />
        </div>
      </div>

      {saveMut.isError && (
        <p className="text-xs text-destructive">❌ שגיאה: {(saveMut.error as Error).message}</p>
      )}
    </div>
  );
};
