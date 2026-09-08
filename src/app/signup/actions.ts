"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/auth";

export type SignupState = { error?: string };

export async function signupAction(
  _prevState: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !username || !password) return { error: "All fields are required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
    return { error: "Username must be 3-32 characters: letters, numbers, underscores." };
  }

  const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
  if (existing) return { error: "An account with that email or username already exists." };

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, username, passwordHash, name: username },
  });
  await prisma.userStats.create({ data: { userId: user.id } });

  try {
    await signIn("credentials", { identifier: email, password, redirectTo: "/today" });
    return {};
  } catch (error) {
    if (error instanceof AuthError) return { error: "Account created, but sign-in failed — try logging in." };
    throw error;
  }
}
