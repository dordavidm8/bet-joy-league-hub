# מערכת עיצוב

## עקרונות

- **Mobile-first** – max-width 512px לפריסה הראשית, מוגדל ל-100% בדסקטופ
- **עברית + RTL** – כל ה-UI בעברית, כיוון טקסט ימין-לשמאל
- **Dark mode** – נתמך דרך `next-themes` + Tailwind `dark:` variant
- **עיצוב קלפים** – רוב התוכן ב-card-style עם רדיוס עגול
- **Glassmorphism** – backdrop-blur על overlays ו-modals

---

## פלטת צבעים (CSS Variables – HSL)

```css
/* Light mode */
--background:       0 0% 100%
--foreground:       222.2 84% 4.9%
--primary:          142 71% 45%      /* ירוק – צבע המותג */
--primary-foreground: 0 0% 100%
--secondary:        210 40% 96.1%
--secondary-foreground: 222.2 47.4% 11.2%
--muted:            210 40% 96.1%
--muted-foreground: 215.4 16.3% 46.9%
--accent:           210 40% 96.1%
--destructive:      0 84.2% 60.2%   /* אדום */
--border:           214.3 31.8% 91.4%
--card:             0 0% 100%
--card-foreground:  222.2 84% 4.9%
```

---

## טיפוגרפיה

| מאפיין | ערך |
|--------|-----|
| גופן ראשי | **Heebo** (Google Fonts) – ממוטב לעברית |
| גופן חלופי | sans-serif |
| גודל בסיס | 16px |
| קנה מידה | Tailwind default (text-xs → text-5xl) |

---

## Spacing & Layout

```css
/* mobile-first container */
max-w-[512px] mx-auto   /* עמוד ראשי */
px-4                    /* padding צדדי */
pb-24                   /* מרווח לBottomTabBar */
```

---

## רדיוסים

```js
// tailwind.config.ts
borderRadius: {
  lg: "var(--radius)",        // 4px ברירת מחדל
  md: "calc(var(--radius) - 2px)",
  sm: "calc(var(--radius) - 4px)",
}
```

---

## ניווט

### BottomTabBar (5 טאבים)
```
🏠 בית  |  ⚽ משחקים  |  🏆 ליגות  |  🎮 אתגרים  |  👤 פרופיל
```

### TopBar
- כפתור חזרה (אם לא בדף ראשי)
- כותרת הדף
- פעמון התראות (NotificationBell)

---

## קומפוננטות עיצוב (Shadcn/ui)

| קומפוננטה | שימוש |
|-----------|------|
| `Button` | כפתורים: default, outline, ghost, destructive |
| `Card` | מכל תוכן ראשי |
| `Dialog` | Modals |
| `Sheet` | Drawer מהצד / מהתחתית |
| `Tabs` | ניווט בתוך דף |
| `Select` | dropdowns |
| `Input` | שדות טקסט |
| `Checkbox` / `Switch` | הגדרות |
| `Progress` | ניצחון/הפסד, loading |
| `Avatar` | תמונת פרופיל |
| `Badge` | תוויות סטטוס |
| `Toast` (Sonner) | הודעות הצלחה/שגיאה |
| `Tooltip` | הסברים על אלמנטים |
| `Accordion` | FAQ / הרחבות |
| `Alert` | הודעות מערכת |

---

## אנימציות

```css
/* Keyframes מותאמים */
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes accordion-down { ... }
@keyframes accordion-up { ... }
```

**Framer Motion** – ל:
- כניסת קלפים
- מעברי דפים
- אנימציות תגמול (נקודות נצברו)
- תוצאת מיני-גיים (ResultModal)

---

## אייקונים

- **Lucide React** – אייקוני UI כלליים (חץ, פעמון, כוכב...)
- **Emoji** – לתחנות, סטטוסים (⚽🏆🎮🔔)
- **ESPN logo URLs** – לוגואות קבוצות
- **flagcdn.com** – דגלי קבוצות לאומיות

---

## מצבי UI

### Loading
```jsx
// skeleton cards
<Skeleton className="h-24 w-full rounded-xl" />
```

### Empty State
```jsx
<div className="text-center text-muted-foreground py-12">
  <Emoji /> <p>אין תוצאות</p>
</div>
```

### Error
```jsx
<ErrorBoundary fallback={<ErrorState />} />
```

---

## Toast (Sonner)

```ts
import { toast } from 'sonner'

toast.success('ניחוש נשמר בהצלחה!')
toast.error('שגיאה בשמירת הניחוש')
toast.info('...')
```

---

## עיצוב ספציפי לפיצ'רים

### כרטיס משחק (GameCard)
- לוגואות + שמות קבוצות
- ניקוד (אם חי/הסתיים)
- badge סטטוס (LIVE / 15:00 / הסתיים)
- badge "מוצג" אם featured

### ניחוש (BetQuestion)
- 3 כפתורים (בית / תיקו / אורח)
- הצגת סיכויים
- slider לסכום הניחוש
- תצוגת "פוטנציאל רווח"

### לוח מובילים
- מיקום + שם + avatar + נקודות
- הדגשת שורת המשתמש המחובר
- top 3 עם תגים מיוחדים

### כרטיס ניחוש (BetHistory)
- סטטוס צבעוני: ירוק (won), אדום (lost), אפור (pending)
- הסיכויים + הסכום + התשלום בפועל
