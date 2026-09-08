import { auth } from "@/auth";

/** Every server action in this single-user app needs the current user's
 * id; proxy.ts already guarantees a session exists for any authed route,
 * so a missing session here means something is actually wrong. */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}
