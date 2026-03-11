import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import type { NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"

// Import OAuth providers (enabled when env vars are set)
import Google from "next-auth/providers/google"
import GitHub from "next-auth/providers/github"

// Custom HuggingFace provider
const HuggingFace = {
  id: "huggingface",
  name: "Hugging Face",
  type: "oauth" as const,
  clientId: process.env.HUGGINGFACE_ID,
  clientSecret: process.env.HUGGINGFACE_SECRET,
  authorization: {
    url: "https://huggingface.co/oauth/authorize",
    params: { scope: "profile email" }
  },
  token: "https://huggingface.co/oauth/token",
  userinfo: "https://huggingface.co/api/whoami-v2",
  profile(profile: any) {
    return {
      id: profile.sub,
      name: profile.name,
      email: profile.email,
      image: profile.picture,
    }
  },
}

// Build providers dynamically based on available env vars
const oauthProviders: any[] = []
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  oauthProviders.push(Google({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }))
}
if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
  oauthProviders.push(GitHub({ clientId: process.env.GITHUB_ID, clientSecret: process.env.GITHUB_SECRET }))
}

export const authConfig = {
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: "jwt" as const },
  providers: [
    // Credentials provider — direct email/password sign-in
    Credentials({
      name: "HeadyMe",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        password: { label: "Password", type: "password" },
        action: { label: "Action", type: "text" }, // "signup" or "signin"
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const email = (credentials.email as string).toLowerCase()
        const password = credentials.password as string
        const action = credentials.action as string

        if (action === "signup") {
          // Create new user
          const existing = await prisma.user.findUnique({ where: { email } })
          if (existing) throw new Error("Email already registered")
          const hashed = await bcrypt.hash(password, 12)
          const user = await prisma.user.create({
            data: {
              email,
              name: email.split("@")[0],
              image: null,
              emailVerified: new Date(),
            }
          })
          // Store hashed password in account record
          await prisma.account.create({
            data: {
              userId: user.id,
              type: "credentials",
              provider: "credentials",
              providerAccountId: user.id,
              access_token: hashed, // store hash here
            }
          })
          return { id: user.id, email: user.email, name: user.name }
        }

        // Sign in
        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) throw new Error("No account found with this email")
        const account = await prisma.account.findFirst({
          where: { userId: user.id, provider: "credentials" }
        })
        if (!account?.access_token) throw new Error("Please sign in with your OAuth provider")
        const valid = await bcrypt.compare(password, account.access_token)
        if (!valid) throw new Error("Invalid password")
        return { id: user.id, email: user.email, name: user.name }
      }
    }),
    // OAuth providers (only added when env vars are configured)
    ...oauthProviders,
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      return true
    },
    async redirect({ url, baseUrl }) {
      // Default redirect to onboarding
      if (url.startsWith(baseUrl)) return url
      return baseUrl + "/onboarding/create-account"
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      // Refresh onboarding state from DB on every request
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            onboardingComplete: true,
            onboardingStep: true,
            headyUsername: true,
            headyEmail: true,
            apiKey: true,
          }
        })
        if (dbUser) {
          token.onboardingComplete = dbUser.onboardingComplete
          token.onboardingStep = dbUser.onboardingStep
          token.headyUsername = dbUser.headyUsername
          token.headyEmail = dbUser.headyEmail
          token.apiKey = dbUser.apiKey
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string
        session.user.onboardingComplete = token.onboardingComplete as boolean
        session.user.onboardingStep = token.onboardingStep as number
        session.user.headyUsername = token.headyUsername as string
        session.user.headyEmail = token.headyEmail as string
        session.user.apiKey = token.apiKey as string
      }
      return session
    },
  },
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      if (isNewUser) {
        // Log new user signup
        await prisma.onboardingLog.create({
          data: {
            userId: user.id!,
            step: 0,
            action: "signup",
            metadata: {
              provider: account?.provider,
              timestamp: new Date().toISOString()
            }
          }
        })
      }
    }
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
