import { useQuery } from '@tanstack/react-query';

export interface SocialDraft {
  id: number;
  platform: 'linkedin' | 'twitter' | 'instagram' | 'tiktok';
  caption: string;
  image_url?: string;
  final_caption?: string; 
  status: string;
  created_at: string;
}

export function useDrafts() {
  return useQuery({
    queryKey: ['social-drafts-v2'],
    queryFn: async () => {
      const res = await fetch('/api/agents/posts?status=draft');
      if (!res.ok) {
         throw new Error('Failed to fetch drafts');
      }
      const data = await res.json();
      return (data.posts || []) as SocialDraft[];
    },
    refetchInterval: 10000 // Poll every 10s for new drafts
  });
}
