import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

// Routes that don't require authentication
const publicRoutes = ["/", "/login", "/signup", "/api/auth"]

// Onboarding routes in order
const onboardingRoutes = [
  "/onboarding/create-account",
  "/onboarding/email-config",
  "/onboarding/permissions",
  "/onboarding/buddy"
]

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Allow public routes
  if (publicRoutes.some(route => path.startsWith(route))) {
    return NextResponse.next()
  }

  // Allow API routes (handled by their own auth)
  if (path.startsWith("/api/")) {
    return NextResponse.next()
  }

  // Check authentication via JWT
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // Check onboarding status
  if (!token.onboardingComplete) {
    const currentStep = (token.onboardingStep as number) || 0
    const expectedRoute = onboardingRoutes[currentStep]

    // If user is on the correct onboarding route, allow
    if (path === expectedRoute) {
      return NextResponse.next()
    }

    // If trying to access a later step, redirect to current step
    if (onboardingRoutes.includes(path)) {
      const requestedStep = onboardingRoutes.indexOf(path)
      if (requestedStep > currentStep) {
        return NextResponse.redirect(new URL(expectedRoute, request.url))
      }
      return NextResponse.next()
    }

    // For any other route, redirect to current onboarding step
    return NextResponse.redirect(new URL(expectedRoute, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
}
