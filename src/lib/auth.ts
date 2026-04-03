import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Facebook from "next-auth/providers/facebook";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { addHours } from "date-fns";
import { db } from "@/lib/db";
import type { Role } from "@prisma/client";

// ── OAuth profile shape helpers ───────────────────────────────────────────────

function extractFacebookPhoto(profile: Record<string, unknown>): string | null {
  const pic = profile.picture as { data?: { url?: string } } | string | undefined;
  if (typeof pic === "string") return pic;
  return pic?.data?.url ?? null;
}

function extractGooglePhoto(profile: Record<string, unknown>): string | null {
  return (profile.picture as string | undefined) ?? null;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,

  providers: [
    Facebook({
      clientId:     process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    }),
    Google({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      credentials: {
        email:           { label: "Email",    type: "email"    },
        password:        { label: "Password", type: "password" },
        autoSigninToken: { label: "Token",    type: "text"     },
      },
      async authorize(credentials) {
        // ── Auto-signin path (post-payment) ─────────────────────────────
        if (credentials?.autoSigninToken) {
          const user = await db.user.findFirst({
            where: {
              autoSigninToken:          credentials.autoSigninToken as string,
              autoSigninTokenExpiresAt: { gt: new Date() },
            },
          });
          if (!user) return null;

          void db.user.update({
            where: { id: user.id },
            data:  { autoSigninToken: null, autoSigninTokenExpiresAt: null, lastLoginAt: new Date() },
          }).catch(() => {});

          return {
            id:     user.id,
            email:  user.email,
            name:   user.name,
            image:  user.photo ?? null,
            role:   user.role,
            djMode: user.djMode ?? false,
          };
        }

        // ── Standard email + password path ──────────────────────────────
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) return null;
        if (user.isSuspended) return null;

        // OAuth-only accounts have no password — direct them to social login
        if (!user.passwordHash) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash,
        );
        if (!isValid) return null;

        await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

        return {
          id:     user.id,
          email:  user.email,
          name:   user.name,
          image:  user.photo ?? null,
          role:   user.role,
          djMode: user.djMode ?? false,
        };
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    // ── signIn — OAuth gate ──────────────────────────────────────────────────
    async signIn({ user, account, profile }) {
      // Credentials path — handled entirely in authorize()
      if (!account || account.provider === "credentials") return true;

      const email = user.email?.toLowerCase().trim();
      if (!email) return false;

      // Extract social profile photo
      const photo =
        account.provider === "facebook"
          ? extractFacebookPhoto((profile ?? {}) as Record<string, unknown>)
          : extractGooglePhoto((profile ?? {}) as Record<string, unknown>);

      // ── Existing user: log them in ────────────────────────────────────
      const existing = await db.user.findUnique({
        where:  { email },
        select: { id: true, isSuspended: true },
      });

      if (existing) {
        if (existing.isSuspended) return false;

        // Update provider and last-login (fire-and-forget)
        void db.user.update({
          where: { id: existing.id },
          data:  {
            lastLoginAt:  new Date(),
            authProvider: account.provider,
            // Fill in photo only if they don't already have one
            ...(photo ? { photo } : {}),
          },
        }).catch(() => {});

        return true;
      }

      // ── New user: create PendingSignup, redirect to signup flow ───────
      void db.pendingSignup.upsert({
        where:  { email },
        create: {
          email,
          name:         user.name ?? "Artist",
          authProvider: account.provider,
          socialPhoto:  photo,
          role:         "ARTIST",          // default; user picks path on /signup
          expiresAt:    addHours(new Date(), 2),
        },
        update: {
          name:         user.name ?? "Artist",
          authProvider: account.provider,
          socialPhoto:  photo,
          expiresAt:    addHours(new Date(), 2),
        },
      }).catch(() => {});

      // Redirect to signup with social data pre-filled
      const params = new URLSearchParams({
        oauth:  account.provider,
        name:   user.name ?? "",
        email,
      });
      return `/signup?${params.toString()}`;
    },

    // ── jwt — attach DB fields to token ────────────────────────────────────
    async jwt({ token, user, account }) {
      if (user && account) {
        if (account.provider !== "credentials") {
          // OAuth: fetch our DB record by email
          const email = user.email?.toLowerCase().trim();
          if (email) {
            const dbUser = await db.user.findUnique({
              where:  { email },
              select: { id: true, role: true, djMode: true },
            });
            if (dbUser) {
              token.id     = dbUser.id;
              token.role   = dbUser.role as Role;
              token.djMode = dbUser.djMode ?? false;
            }
          }
        } else {
          // Credentials: custom fields are on the user object
          token.id     = user.id!;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          token.role   = (user as any).role   as Role;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          token.djMode = (user as any).djMode as boolean ?? false;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).role   = token.role   as Role;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).djMode = token.djMode as boolean ?? false;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    newUser: "/signup",
  },
});
