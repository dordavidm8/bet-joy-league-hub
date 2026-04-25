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
      // Mocking fetch for Day 3 layout purposes if API isn't ready.
      // But we will hit the actual API (we can write it later or assume there is an API to get posts).
      // Because we know there's a social_posts table.
      
      const res = await fetch('/api/agents/posts?status=draft');
      if (!res.ok) {
         // Returning mock data to see the UI working right now
         return [
           { id: 1, platform: 'linkedin', status: 'draft_ready', final_caption: '🏆 KickOff is crushing the sports betting analytics game! \n\nCheck out our new V2 AI Social Agents that completely revolutionized our marketing pipeline! #AI #Tech #Football #Startups', created_at: new Date().toISOString() },
           { id: 2, platform: 'instagram', status: 'draft_ready', final_caption: '⚽ משחק העונה יוצא לדרך!\n\nהימורים פתוחים עכשיו באפליקציה! שים לב ליחסים המטורפים שרצים אצלנו 👇\n\n#כדורגל #מכבי #הימורים', created_at: new Date().toISOString(), image_url: 'https://via.placeholder.com/150' }
         ] as SocialDraft[];
      }
      return res.json() as Promise<SocialDraft[]>;
    },
    refetchInterval: 10000 // Poll every 10s for new drafts
  });
}
