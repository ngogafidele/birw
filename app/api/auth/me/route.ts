// Returns the currently authenticated user's effective session context.
import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { requireAuth } from "@/lib/auth/middleware"
import { DEFAULT_STORE } from "@/lib/auth/session"
import { User } from "@/lib/db/models/User"

export async function GET(request: NextRequest) {
  try {
    const { authorized, session } = await requireAuth(request)
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    await connectToDatabase()
    const user = await User.findById(session.userId).select("-password")

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        ...user.toObject(),
        stores: [DEFAULT_STORE],
        currentStore: DEFAULT_STORE,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch session" },
      { status: 500 }
    )
  }
}
