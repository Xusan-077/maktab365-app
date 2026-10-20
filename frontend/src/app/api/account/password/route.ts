import { auth } from "@/auth";
import { handlePasswordChange } from "@/lib/auth/password-change";

export const POST = auth((request) => handlePasswordChange(request));
