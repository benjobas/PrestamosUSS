import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        username: {},
        password: {},
        sedeId: {},
      },
      async authorize(credentials) {
        const username = credentials.username as string;
        const password = credentials.password as string;
        const sedeId = credentials.sedeId as string | undefined;

        if (!username || !password) return null;

        const user = await prisma.user.findUnique({
          where: { username, active: true },
        });

        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
          sedeId: sedeId || user.sedeId,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id!;
        token.username = user.username;
        token.role = user.role;
        token.sedeId = user.sedeId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.userId;
      session.user.username = token.username;
      session.user.role = token.role;
      session.user.sedeId = token.sedeId;
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;

      // Public routes
      if (
        pathname.startsWith("/login") ||
        pathname.startsWith("/kiosk") ||
        pathname.startsWith("/api/kiosk") ||
        pathname.startsWith("/api/auth")
      ) {
        return true;
      }

      // Everything else requires auth
      if (!auth?.user) {
        return Response.redirect(new URL("/login", request.url));
      }

      return true;
    },
  },
});
