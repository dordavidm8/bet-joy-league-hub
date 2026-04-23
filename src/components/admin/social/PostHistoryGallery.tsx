// admin/social/PostHistoryGallery.tsx – גלריית פוסטים
// מציג ארכיון של פוסטים שנוצרו עם: כיתוב, פלטפורמה, סטטוס, מדדי engagement.
// אפשרויות: אישור, דחייה, עריכה של פוסטים ממתינים.
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ExternalLink, Filter } from 'lucide-react';

const API = '/api/social';

async function fetchHistory(platform?: string, status?: string, limit = 20) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (platform) params.set('platform', platform);
  if (status) params.set('status', status);
  const r = await fetch(`${API}/posts?${params}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const PLATFORM_STYLES: Record<string, { badge: string; emoji: string }> = {
  linkedin:  { badge: 'bg-blue-100 text-blue-700',  emoji: '💼' },
  instagram: { badge: 'bg-pink-100 text-pink-700',  emoji: '📸' },
  tiktok:    { badge: 'bg-gray-800 text-gray-100',  emoji: '🎵' },
};
const STATUS_STYLES: Record<string, string> = {
  published:    'bg-emerald-100 text-emerald-700',
  pending_approval: 'bg-amber-100 text-amber-700',
  rejected:     'bg-red-100 text-red-700',
  draft:        'bg-gray-100 text-gray-500',
};

export const PostHistoryGallery = () => {
  const [platform, setPlatform] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['social-history', platform, status],
    queryFn: () => fetchHistory(platform || undefined, status || undefined),
    staleTime: 30_000,
  });

  const posts = data?.posts ?? [];

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select value={platform} onChange={e => setPlatform(e.target.value)}
          className="bg-secondary border border-border rounded-xl px-3 py-1.5 text-xs font-medium outline-none">
          <option value="">כל הפלטפורמות</option>
          <option value="linkedin">💼 LinkedIn</option>
          <option value="instagram">📸 Instagram</option>
          <option value="tiktok">🎵 TikTok</option>
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="bg-secondary border border-border rounded-xl px-3 py-1.5 text-xs font-medium outline-none">
          <option value="">כל הסטטוסים</option>
          <option value="published">✅ פורסם</option>
          <option value="pending_approval">⏳ ממתין</option>
          <option value="rejected">❌ נדחה</option>
          <option value="draft">📝 טיוטה</option>
        </select>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> טוען...
        </div>
      )}

      {/* Gallery grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {posts.map((post: any) => {
          const ps = PLATFORM_STYLES[post.platform] ?? { badge: 'bg-secondary', emoji: '📄' };
          return (
            <div key={post.id} className="border rounded-2xl overflow-hidden bg-card hover:shadow-md transition-shadow flex flex-col">
              {/* Image */}
              {(post.image_url || post.image_base64) ? (
                <div className="aspect-square bg-secondary relative overflow-hidden">
                  <img
                    src={post.image_url || `data:image/png;base64,${post.image_base64}`}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              ) : (
                <div className="aspect-square bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center text-3xl">
                  {ps.emoji}
                </div>
              )}
              {/* Info */}
              <div className="p-2.5 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ps.badge}`}>
                    {ps.emoji} {post.platform}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[post.status] ?? 'bg-secondary'}`}>
                    {post.status === 'published' ? '✅' : post.status === 'pending_approval' ? '⏳' : post.status === 'rejected' ? '❌' : '📝'}
                  </span>
                </div>
                <p className="text-[11px] text-foreground line-clamp-2 leading-tight" dir="auto">
                  {post.caption?.slice(0, 80) || post.image_prompt?.slice(0, 80)}...
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(post.created_at).toLocaleDateString('he-IL')}
                </p>
                {post.published_url && (
                  <a href={post.published_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-[10px] text-primary hover:underline">
                    <ExternalLink size={10} /> צפה בפוסט
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!isLoading && posts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-2 border-2 border-dashed rounded-2xl">
          <span className="text-3xl">🗂️</span>
          <p className="text-sm text-muted-foreground">אין פוסטים בהיסטוריה</p>
        </div>
      )}
    </div>
  );
};
