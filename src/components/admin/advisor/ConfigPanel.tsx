// admin/advisor/ConfigPanel.tsx – הגדרות יועץ AI
// עורך: שם מודל LLM, טמפרטורה, max_tokens, מגבלת הודעות יומית, system prompt.
// שינויים נשמרים ב-advisor_config table ונכנסים לתוקף מיידית.
import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { advisorGetConfig, advisorPatchConfig } from '@/lib/api';
import { Save, CheckCircle } from 'lucide-react';

const MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'mixtral-8x7b-32768',
];

export const ConfigPanel = () => {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['advisor-config'], queryFn: advisorGetConfig });

  const [form, setForm] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) {
      setForm(Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.value])));
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: advisorPatchConfig,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['advisor-config'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  if (isLoading) return <div className="py-12 text-center text-sm text-muted-foreground">טוען...</div>;

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="flex flex-col gap-5 max-w-lg">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold">מודל</label>
        <select value={form.model ?? ''} onChange={e => set('model', e.target.value)}
          className="border border-border rounded-lg p-2 text-sm bg-background">
          {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold">מגבלה יומית</label>
          <input type="number" min={1} max={200} value={form.daily_limit ?? ''} onChange={e => set('daily_limit', e.target.value)}
            className="border border-border rounded-lg p-2 text-sm bg-background" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold">Temperature</label>
          <input type="number" min={0} max={2} step={0.1} value={form.temperature ?? ''} onChange={e => set('temperature', e.target.value)}
            className="border border-border rounded-lg p-2 text-sm bg-background" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold">Max tokens</label>
          <input type="number" min={100} max={4000} step={50} value={form.max_tokens ?? ''} onChange={e => set('max_tokens', e.target.value)}
            className="border border-border rounded-lg p-2 text-sm bg-background" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-bold">System prompt</label>
        <textarea rows={5} value={form.system_prompt ?? ''} onChange={e => set('system_prompt', e.target.value)}
          className="border border-border rounded-lg p-2 text-sm bg-background resize-y font-mono" />
      </div>

      <button
        onClick={() => mutation.mutate(form)}
        disabled={mutation.isPending}
        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-bold w-fit disabled:opacity-60">
        {saved ? <CheckCircle size={14} /> : <Save size={14} />}
        {saved ? 'נשמר!' : 'שמור'}
      </button>

      {mutation.isError && (
        <p className="text-destructive text-xs">{(mutation.error as Error).message}</p>
      )}

      {data && (
        <div className="text-xs text-muted-foreground border border-border rounded-lg p-3">
          {Object.entries(data).map(([k, v]) => v.updated_at && (
            <div key={k}>{k} — עודכן ע"י {v.updated_by} ב-{new Date(v.updated_at).toLocaleDateString('he-IL')}</div>
          ))}
        </div>
      )}
    </div>
  );
};
