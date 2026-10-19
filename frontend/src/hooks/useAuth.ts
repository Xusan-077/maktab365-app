import { useSession } from "next-auth/react";

/** Auth.js sessiyasi: `signedIn` faqat sessiya tasdiqlangandan keyin `true`. */
export function useAuth() {
  const { data, status } = useSession();
  return {
    status,
    signedIn: status === "authenticated",
    sessionUser: data?.user ?? null,
  };
}
