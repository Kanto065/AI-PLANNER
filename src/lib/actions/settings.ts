"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "./require-user";

export type ChangePasswordState = { error?: string; success?: boolean };

export async function changePassword(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const userId = await requireUserId();
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!current || !next || !confirm) return { error: "All fields are required." };
  if (next !== confirm) return { error: "New passwords don't match." };
  if (next.length < 8) return { error: "New password must be at least 8 characters." };

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.passwordHash) {
    return { error: "This account signed up with Google and has no password to change." };
  }
  const valid = await bcrypt.compare(current, user.passwordHash);
  if (!valid) return { error: "Current password is incorrect." };

  const passwordHash = await bcrypt.hash(next, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  return { success: true };
}
