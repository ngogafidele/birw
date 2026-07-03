// Resolves authenticated sessions and the single active store in Server Components.
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import {
  DEFAULT_STORE,
  getSessionFromCookies,
  type AuthSession,
  type StoreKey,
} from "@/lib/auth/session"
import { getCurrentUserSession } from "@/lib/auth/current-user"

export async function requireServerSession(): Promise<AuthSession> {
  const cookieStore = await cookies()
  const tokenSession = getSessionFromCookies(cookieStore)
  if (!tokenSession) {
    redirect("/")
  }

  const session = await getCurrentUserSession(tokenSession)
  if (!session) {
    redirect("/")
  }

  return session
}

export function getCurrentStore(session: AuthSession): StoreKey {
  void session
  return DEFAULT_STORE
}
