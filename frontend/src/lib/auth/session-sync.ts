/**
 * Tablar orasida kirish/chiqish holatini sinxronlash: `BroadcastChannel`, bo'lmasa `storage` hodisasi.
 * Faqat holat nomi yuboriladi — token yoki foydalanuvchi ma'lumoti emas.
 */

export type SessionSyncMessage = "signed-out" | "signed-in";

const CHANNEL = "maktab365-auth";
const STORAGE_KEY = "maktab365-auth-event";

export function broadcastSessionEvent(message: SessionSyncMessage): void {
  if (typeof window === "undefined") return;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(CHANNEL);
      channel.postMessage(message);
      channel.close();
      return;
    }
    // `storage` hodisasi faqat boshqa tablarda ishlaydi; qiymat har safar yangi bo'lsin.
    window.localStorage.setItem(STORAGE_KEY, `${message}:${Date.now()}`);
  } catch {
    // Maxfiy rejim yoki bloklangan storage: boshqa tablar keyingi so'rovda o'zi bilib oladi.
  }
}

/** Boshqa tablardan kelgan hodisalarga obuna (joriy tab o'z xabarini olmaydi). Qaytarilgan funksiya — bekor qilish. */
export function onSessionEvent(handler: (message: SessionSyncMessage) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const accept = (value: unknown) => {
    if (value === "signed-out" || value === "signed-in") handler(value);
  };
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (event: MessageEvent<unknown>) => accept(event.data);
    return () => channel.close();
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY && event.newValue) accept(event.newValue.split(":")[0]);
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
