import { useCallback, useEffect, useState } from "react";

/** Qayta yuborishgacha qolgan soniyalar; `restart` taymerni boshidan boshlaydi. */
export function useResendTimer(seconds: number) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    if (left <= 0) return;
    const id = window.setTimeout(() => setLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(id);
  }, [left]);

  const restart = useCallback(() => setLeft(seconds), [seconds]);
  return { left, restart };
}
