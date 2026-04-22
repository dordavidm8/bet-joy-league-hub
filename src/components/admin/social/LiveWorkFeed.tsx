import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X, Edit2, Loader2, Image, RefreshCw, ExternalLink, Wand2 } from 'lucide-react';
import { MagicSwitchModal } from './MagicSwitchModal';

const API = '/api/social';

async function fetchPosts(status = 'pending_approval') {
  const r = await fetch(`${API}/posts?status=${status}&limit=20`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function approvePost(id: string) {
  const r = await fetch(`${API}/posts/${id}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function rejectPost(id: string, reason: string) {
  const r = await fetch(`${API}/posts/${id}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function updatePost(id: string, caption: string) {
  const r = await fetch(`${API}/posts/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caption }) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function triggerPipeline() {
  const r = await fetch(`${API}/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dryRun: false }) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const PLATFORM_COLORS: Record<string, string> = {
  linkedin:  'bg-blue-100 text-blue-700',
  instagram: 'bg-pink-100 text-pink-700',
  tiktok:    'bg-gray-900 text-white',
};
const PLATFORM_EMOJIS: Record<string, string> = {
  linkedin: '💼', instagram: '📸', tiktok: '🎵',
};

export const LiveWorkFeed = () => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [magicSwitchText, setMagicSwitchText] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['social-pending-posts'],
    queryFn: () => fetchPosts('pending_approval'),
    refetchInterval: 30_000,
  });

  const approveMut = useMutation({
    mutationFn: approvePost,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['social-pending-posts'] }),
  });
  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectPost(id, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['social-pending-posts'] }); setRejectingId(null); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, caption }: { id: string; caption: string }) => updatePost(id, caption),
    onSuccess: (_, { id }) => { qc.invalidateQueries({ queryKey: ['social-pending-posts'] }); setEditing(p => { const n = { ...p }; delete n[id]; return n; }); },
  });
  const triggerMut = useMutation({ mutationFn: triggerPipeline });

  const posts = data?.posts ?? [];

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-sm font-bold">פוסטים ממתינים לאישור</span>
          {posts.length > 0 && (
            <span className="bg-red-100 text-red-700 text-xs font-black px-2 py-0.5 rounded-full">{posts.length}</span>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-secondary transition-colors">
            <RefreshCw size={13} /> רענן
          </button>
          <button
            onClick={() => triggerMut.mutate()}
            disabled={triggerMut.isPending}
            className="flex items-center gap-1.5 text-xs font-bold bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-colors"
          >
            {triggerMut.isPending ? <Loader2 size={13} className="animate-spin" /> : '🚀'}
            הפעל Pipeline
          </button>
        </div>
      </div>

      {triggerMut.isSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold px-3 py-2 rounded-xl">
          ✅ Pipeline הופעל! הפוסטים יופיעו כאן בעוד כמה דקות.
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground gap-2">
          <Loader2 size={16} className="animate-spin" /> טוען פוסטים...
        </div>
      )}

      {error && (
        <div className="bg-destructive/5 border border-destructive/20 text-destructive text-sm px-4 py-3 rounded-xl">
          ⚠️ {(error as Error).message}
        </div>
      )}

      {!isLoading && posts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 border-2 border-dashed rounded-2xl">
          <span className="text-4xl">🕊️</span>
          <p className="text-sm font-bold">אין פוסטים ממתינים</p>
          <p className="text-xs text-muted-foreground">הפעל Pipeline כדי לייצר פוסטים חדשים</p>
        </div>
      )}

      {posts.map((post: any) => (
        <div key={post.id} className="border rounded-2xl p-4 flex flex-col gap-3 bg-card shadow-sm hover:shadow-md transition-shadow">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${PLATFORM_COLORS[post.platform] ?? 'bg-secondary'}`}>
                {PLATFORM_EMOJIS[post.platform]} {post.platform}
              </span>
              <span className="text-[10px] text-muted-foreground">{new Date(post.created_at).toLocaleString('he-IL')}</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">{post.media_type}</span>
          </div>

          {/* Image */}
          {(post.image_url || post.image_base64) && (
            <div className="relative overflow-hidden rounded-xl aspect-video bg-secondary">
              <img
                src={post.image_url || (post.image_base64 ? `data:image/png;base64,${post.image_base64}` : '')}
                alt="generated visual"
                className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}
          {!post.image_url && !post.image_base64 && (
            <div className="flex items-center gap-2 bg-secondary/50 rounded-xl px-3 py-2">
              <Image size={14} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground truncate">{post.image_prompt?.slice(0, 80)}...</span>
            </div>
          )}

          {/* Caption */}
          {editing[post.id] !== undefined ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={editing[post.id]}
                onChange={e => setEditing(p => ({ ...p, [post.id]: e.target.value }))}
                rows={4}
                className="w-full text-sm bg-secondary border border-border rounded-xl px-3 py-2 outline-none resize-none focus:ring-1 focus:ring-primary/30"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateMut.mutate({ id: post.id, caption: editing[post.id] })}
                  disabled={updateMut.isPending}
                  className="flex-1 text-xs font-bold bg-primary text-primary-foreground px-3 py-2 rounded-xl disabled:opacity-60"
                >
                  שמור
                </button>
                <button
                  onClick={() => setEditing(p => { const n = { ...p }; delete n[post.id]; return n; })}
                  className="text-xs px-3 py-2 rounded-xl border hover:bg-secondary"
                >
                  ביטול
                </button>
                <button
                  onClick={() => setMagicSwitchText(editing[post.id])}
                  title="מטה הקסם לפורמטים נוספים"
                  className="text-xs p-2 rounded-xl border hover:bg-purple-50 text-purple-600 transition-colors"
                >
                  <Wand2 size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div
              className="text-sm text-foreground leading-relaxed cursor-pointer hover:bg-secondary/50 rounded-xl px-2 py-1 transition-colors group"
              onClick={() => setEditing(p => ({ ...p, [post.id]: post.caption ?? '' }))}
            >
              <span dir="auto">{post.caption}</span>
              <Edit2 size={11} className="inline ml-1 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}

          {/* Hashtags */}
          {post.hashtags?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {post.hashtags.map((h: string) => (
                <span key={h} className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full font-medium">{h}</span>
              ))}
            </div>
          )}

          {/* Reject reason input */}
          {rejectingId === post.id && (
            <div className="flex gap-2">
              <input
                value={rejectReason[post.id] ?? ''}
                onChange={e => setRejectReason(p => ({ ...p, [post.id]: e.target.value }))}
                placeholder="סיבת דחייה (אופציונלי)..."
                className="flex-1 text-xs bg-secondary border border-border rounded-xl px-3 py-2 outline-none"
              />
              <button
                onClick={() => rejectMut.mutate({ id: post.id, reason: rejectReason[post.id] ?? '' })}
                disabled={rejectMut.isPending}
                className="text-xs font-bold bg-red-600 text-white px-3 py-2 rounded-xl disabled:opacity-60"
              >
                {rejectMut.isPending ? '...' : 'דחה'}
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => approveMut.mutate(post.id)}
              disabled={approveMut.isPending}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold bg-emerald-600 text-white px-3 py-2 rounded-xl hover:bg-emerald-700 disabled:opacity-60 transition-colors"
            >
              <Check size={14} /> {approveMut.isPending ? '...' : 'אשר ופרסם'}
            </button>
            <button
              onClick={() => setRejectingId(rejectingId === post.id ? null : post.id)}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold border border-red-200 text-red-600 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors"
            >
              <X size={14} /> דחה
            </button>
          </div>
        </div>
      ))}
      
      {magicSwitchText !== null && (
        <MagicSwitchModal 
          initialText={magicSwitchText} 
          onClose={() => setMagicSwitchText(null)} 
        />
      )}
    </div>
  );
};
