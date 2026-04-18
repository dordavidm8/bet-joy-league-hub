import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  joinLeague,
  AppNotification,
} from "@/lib/api";

const TYPE_ICON: Record<string, string> = {
  bet_won:         "✅",
  bet_lost:        "❌",
  league_invite:   "🏆",
  league_result:   "🎖️",
  daily_challenge: "⚽",
  weekly_bonus:    "🌟",
  special_offer:   "🎁",
  admin_message:   "📢",
};

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "עכשיו";
  if (diff < 3600) return `לפני ${Math.floor(diff / 60)} דק׳`;
  if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} ש׳`;
  return `לפני ${Math.floor(diff / 86400)} ימים`;
}

const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [adminModal, setAdminModal] = useState<{ open: boolean; title: string; body: string }>({ open: false, title: '', body: '' });
  const [inviteModal, setInviteModal] = useState<{ open: boolean; notification: AppNotification | null }>({ open: false, notification: null });
  const panelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: getNotifications,
    refetchInterval: 30_000,
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unread_count ?? 0;

  const readAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const readOneMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const joinMutation = useMutation({
    mutationFn: (invite_code: string) => joinLeague(invite_code),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["my-leagues"] });
      setInviteModal({ open: false, notification: null });
      setOpen(false);
      navigate(`/leagues/${res.league.id}`);
    },
  });

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = () => {
    setOpen((prev) => !prev);
    if (!open && unreadCount > 0) readAllMutation.mutate();
  };

  const handleNotificationClick = (n: AppNotification) => {
    if (!n.is_read) readOneMutation.mutate(n.id);
    if (n.type === "league_invite" && n.data?.invite_code) {
      setOpen(false);
      setInviteModal({ open: true, notification: n });
    } else if (n.type === "league_result" && n.data?.league_id) {
      navigate(`/leagues/${n.data.league_id}`);
      setOpen(false);
    } else if (n.type === "daily_challenge") {
      navigate("/minigames");
      setOpen(false);
    } else if (n.type === "bet_won" || n.type === "bet_lost") {
      navigate("/bets");
      setOpen(false);
    } else if (n.type === "admin_message") {
      setAdminModal({ open: true, title: n.title, body: n.body ?? '' });
      setOpen(false);
    }
  };

  const inviteN = inviteModal.notification;

  return (
    <>
    <div className="relative" ref={panelRef}>
      <button
        onClick={handleOpen}
        className="relative w-9 h-9 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
        aria-label="התראות"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-primary text-primary-foreground text-[10px] font-black rounded-full flex items-center justify-center px-1">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-11 w-80 max-h-[70vh] bg-background border border-border rounded-2xl shadow-xl overflow-hidden flex flex-col z-50"
          style={{ right: "auto" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <span className="font-bold text-sm">התראות</span>
            {notifications.some(n => !n.is_read) && (
              <button onClick={() => readAllMutation.mutate()} className="text-xs text-primary hover:underline">
                סמן הכל כנקרא
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                <Bell size={28} className="opacity-30" />
                <p className="text-sm">אין התראות</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full flex items-start gap-3 px-4 py-3 border-b border-border/50 text-right hover:bg-secondary/50 transition-colors ${!n.is_read ? "bg-primary/5" : ""}`}
                >
                  <span className="text-xl shrink-0 mt-0.5">{TYPE_ICON[n.type] ?? "🔔"}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-tight ${!n.is_read ? "font-bold" : "font-medium"}`}>{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{n.body}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground/60">{timeAgo(n.created_at)}</span>
                      {n.type === "league_invite" && <span className="text-[10px] text-primary font-bold">לחץ לפרטים ←</span>}
                      {n.type === "league_result" && <span className="text-[10px] text-primary font-bold">צפה בליגה ←</span>}
                      {n.type === "daily_challenge" && <span className="text-[10px] text-primary font-bold">לאתגרים ←</span>}
                      {(n.type === "bet_won" || n.type === "bet_lost") && <span className="text-[10px] text-primary font-bold">להיסטוריית הימורים ←</span>}
                      {n.type === "admin_message" && <span className="text-[10px] text-primary font-bold">קרא עוד ←</span>}
                    </div>
                  </div>
                  {!n.is_read && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>

    {/* League invite confirmation dialog */}
    {inviteModal.open && inviteN && createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4"
        onClick={() => setInviteModal({ open: false, notification: null })}>
        <div className="bg-background rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4"
          onClick={e => e.stopPropagation()}>
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="text-4xl">🏆</span>
            <h3 className="font-black text-lg leading-tight">{inviteN.data?.league_name ?? "הוזמנת לליגה"}</h3>
            <p className="text-sm text-muted-foreground">
              {inviteN.data?.inviter} מזמין אותך להצטרף לליגה
            </p>
          </div>
          {joinMutation.isError && (
            <p className="text-xs text-destructive text-center">{(joinMutation.error as any)?.message || "שגיאה בהצטרפות"}</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => joinMutation.mutate(inviteN.data!.invite_code as string)}
              disabled={joinMutation.isPending}
              className="flex-1 bg-primary text-primary-foreground font-bold py-3 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {joinMutation.isPending ? "מצטרף..." : "הצטרף לליגה"}
            </button>
            <button
              onClick={() => setInviteModal({ open: false, notification: null })}
              className="flex-1 bg-secondary text-foreground font-bold py-3 rounded-xl hover:bg-secondary/80 transition-colors"
            >
              דחה
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

    {/* Admin message modal */}
    {adminModal.open && createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4"
        onClick={() => setAdminModal({ ...adminModal, open: false })}>
        <div className="bg-background rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4"
          onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">📢</span>
            <h3 className="font-bold text-base leading-tight flex-1">{adminModal.title}</h3>
          </div>
          {adminModal.body && <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{adminModal.body}</p>}
          <button onClick={() => setAdminModal({ ...adminModal, open: false })}
            className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl">
            סגור
          </button>
        </div>
      </div>,
      document.body
    )}
    </>
  );
};

export default NotificationBell;
