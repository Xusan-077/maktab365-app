import { auth } from "@/auth";
import { proxyToBackend } from "@/lib/auth/bff";

// `auth()` o'rami: kerak bo'lsa backend tokenlarini yangilaydi va sessiya cookie'sini javobga yozadi.
const handler = auth((request) => proxyToBackend(request));

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
