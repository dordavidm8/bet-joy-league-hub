import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, Check, X, Loader2 } from 'lucide-react';

const API = '/api/social';

async function fetchKB() {
  const r = await fetch(`${API}/knowledge-base`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function createKB(body: any) {
  const r = await fetch(`${API}/knowledge-base`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function updateKB(id: string, body: any) {
  const r = await fetch(`${API}/knowledge-base/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function deleteKB(id: string) {
  const r = await fetch(`${API}/knowledge-base/${id}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const CATEGORIES = ['brand', 'tone', 'product', 'audience', 'competition', 'general'];

export const KnowledgeBaseManager = () => {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', content: '', category: 'general' });
  const [editForm, setEditForm] = useState<any>({});

  const { data, isLoading } = useQuery({ queryKey: ['social-kb'], queryFn: fetchKB });

  const createMut = useMutation({
    mutationFn: createKB,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['social-kb'] }); setAdding(false); setForm({ title: '', content: '', category: 'general' }); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, ...body }: any) => updateKB(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['social-kb'] }); setEditingId(null); },
  });
  const deleteMut = useMutation({
    mutationFn: deleteKB,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['social-kb'] }),
  });

  const entries = data?.entries ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold">Knowledge Base</h3>
          <p className="text-[10px] text-muted-foreground">מידע שהאייגנטים משתמשים בו בכל ריצה</p>
        </div>
        <button onClick={() => setAdding(!adding)}
          className="flex items-center gap-1.5 text-xs font-bold bg-primary text-primary-foreground px-3 py-1.5 rounded-xl hover:bg-primary/90 transition-colors">
          {adding ? <X size={13} /> : <Plus size={13} />}
          {adding ? 'ביטול' : 'הוסף פריט'}
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="border-2 border-primary/30 rounded-2xl p-4 flex flex-col gap-3 bg-primary/5">
          <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="כותרת..." className="bg-background border rounded-xl px-3 py-2 text-sm outline-none" dir="rtl" />
          <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
            placeholder="תוכן..." rows={3}
            className="bg-background border rounded-xl px-3 py-2 text-sm outline-none resize-none" dir="rtl" />
          <div className="flex items-center gap-2">
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
              className="bg-background border rounded-xl px-3 py-2 text-xs flex-1 outline-none">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={() => createMut.mutate(form)} disabled={!form.title || !form.content || createMut.isPending}
              className="flex items-center gap-1 text-xs font-bold bg-emerald-600 text-white px-3 py-2 rounded-xl disabled:opacity-60">
              {createMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} שמור
            </button>
          </div>
        </div>
      )}

      {isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground py-4"><Loader2 size={16} className="animate-spin" /> טוען...</div>}

      {/* Entries */}
      <div className="flex flex-col gap-2">
        {entries.map((e: any) => (
          <div key={e.id} className="border rounded-2xl p-3 flex flex-col gap-2 bg-card">
            {editingId === e.id ? (
              <div className="flex flex-col gap-2">
                <input value={editForm.title} onChange={ev => setEditForm((p: any) => ({ ...p, title: ev.target.value }))}
                  className="bg-background border rounded-xl px-3 py-1.5 text-sm outline-none" dir="rtl" />
                <textarea value={editForm.content} onChange={ev => setEditForm((p: any) => ({ ...p, content: ev.target.value }))}
                  rows={3} className="bg-background border rounded-xl px-3 py-1.5 text-sm outline-none resize-none" dir="rtl" />
                <div className="flex gap-2">
                  <button onClick={() => updateMut.mutate({ id: e.id, ...editForm })} disabled={updateMut.isPending}
                    className="text-xs font-bold bg-emerald-600 text-white px-3 py-1.5 rounded-xl flex items-center gap-1 disabled:opacity-60">
                    {updateMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} שמור
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-xs px-3 py-1.5 rounded-xl border hover:bg-secondary">ביטול</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">{e.title}</span>
                    <span className="text-[10px] bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">{e.category}</span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditingId(e.id); setEditForm({ title: e.title, content: e.content, category: e.category }); }}
                      className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                      <Edit2 size={12} />
                    </button>
                    <button onClick={() => { if (confirm('למחוק?')) deleteMut.mutate(e.id); }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3" dir="rtl">{e.content}</p>
              </>
            )}
          </div>
        ))}
        {!isLoading && entries.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8 border-2 border-dashed rounded-2xl">
            <p>📚 Knowledge Base ריק</p>
            <p className="text-xs mt-1">הוסף מידע שהאייגנטים יוכלו להשתמש בו</p>
          </div>
        )}
      </div>
    </div>
  );
};
