"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export type LoginState = { error?: string };

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  try {
    await signIn("credentials", {
      identifier: formData.get("identifier"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email/username or password." };
    }
    throw error;
  }
}
