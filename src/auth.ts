import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

/** Derives a unique username from an email/name for accounts created via
 * Google sign-in (which has no username of its own). */
async function uniqueUsernameFor(seed: string) {
  const base = seed.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").toLowerCase() || "user";
  let candidate = base;
  let n = 1;
  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    candidate = `${base}${n}`;
    n++;
  }
  return candidate;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        identifier: { label: "Email or username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const identifier = credentials?.identifier as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!identifier || !password) return null;

        const user = await prisma.user.findFirst({
          where: {
            OR: [{ email: identifier }, { username: identifier }],
          },
        });
        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name ?? user.username };
      },
    }),
    ...(googleEnabled
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Credentials already resolved to a real User row in `authorize`.
      if (account?.provider !== "google") return true;
      if (!user.email) return false;

      const existing = await prisma.user.findUnique({ where: { email: user.email } });
      if (existing) {
        user.id = existing.id;
        return true;
      }

      const username = await uniqueUsernameFor(user.email);
      const created = await prisma.user.create({
        data: { email: user.email, username, name: user.name ?? username, passwordHash: null },
      });
      await prisma.userStats.create({ data: { userId: created.id } });
      user.id = created.id;
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) token.userId = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
});
