/** Auth.js sessiyasidan olingan, API uchun yetarli identifikator. */
export interface ApiSession {
  id: string;
  name: string;
}

let current: ApiSession | null = null;

/** `AuthBridge` chaqiradi. MockApi shundan foydalanadi; HttpApi esa cookie/token bilan ishlaydi. */
export function setApiSession(session: ApiSession | null) {
  current = session;
}

export function getApiSession(): ApiSession | null {
  return current;
}
