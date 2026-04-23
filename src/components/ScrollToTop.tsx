// ScrollToTop.tsx – גלילה לראש עמוד
// לא מציג UI. מאזין לשינויי route ומגלול ל-(0,0) בכל ניווט.
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
