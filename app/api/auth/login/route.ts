// Authenticates a user and issues the application session cookie.
import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { User } from "@/lib/db/models/User"
import {
  pruneOldLoginLogs,
  UserLoginLog,
} from "@/lib/db/models/UserLoginLog"
import { LoginSchema } from "@/lib/db/validators/user"
import { comparePassword } from "@/lib/auth/hash"
import {
  AUTH_COOKIE,
  DEFAULT_STORE,
  createToken,
  getAuthCookieOptions,
  type AuthSession,
} from "@/lib/auth/session"
import { isNetworkError, NETWORK_ERROR_MESSAGE } from "@/lib/utils/api-errors"
import { ZodError } from "zod"

export async function POST(request: NextRequest) {
  try {
    const bodyData = await request.json()
    const body = LoginSchema.parse(bodyData)
    await connectToDatabase()

    const user = await User.findOne({ email: body.email.toLowerCase() })
    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      )
    }

    const isValid = await comparePassword(body.password, user.password)
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      )
    }

    const loginAt = new Date()
    user.lastLogin = loginAt
    await user.save()

    const loginLog = await UserLoginLog.create({
      userId: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      loginAt,
    })
    await pruneOldLoginLogs()

    const stores: AuthSession["stores"] = [DEFAULT_STORE]
    const session: AuthSession = {
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      role: user.role,
      stores,
      currentStore: DEFAULT_STORE,
      loginLogId: loginLog._id.toString(),
      lastActivityAt: Date.now(),
    }

    const token = createToken(session)
    const response = NextResponse.json({
      success: true,
      data: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        isAdmin: user.isAdmin,
        stores,
        currentStore: DEFAULT_STORE,
      },
    })

    response.cookies.set(AUTH_COOKIE, token, getAuthCookieOptions(session))

    return response
  } catch (error) {
    console.error(
      "[Login Error]",
      error instanceof Error ? error.message : error
    )

    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 400 }
      )
    }

    if (isNetworkError(error)) {
      return NextResponse.json(
        { success: false, error: NETWORK_ERROR_MESSAGE },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { success: false, error: "Login failed. Please try again." },
      { status: 400 }
    )
  }
}
