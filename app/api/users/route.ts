// Lists and provisions users for the BIRW store.
import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { User } from "@/lib/db/models/User"
import { requireAdmin } from "@/lib/auth/middleware"
import { CreateUserSchema } from "@/lib/db/validators/user"
import { hashPassword } from "@/lib/auth/hash"
import { DEFAULT_STORE } from "@/lib/auth/session"
import {
  isDuplicateKeyError,
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
} from "@/lib/utils/api-errors"
import { ZodError } from "zod"

export async function GET(_request: NextRequest) {
  void _request
  try {
    const { authorized } = await requireAdmin(_request)
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: "Admin only" },
        { status: 403 }
      )
    }

    await connectToDatabase()
    const users = await User.find().select("-password")

    return NextResponse.json({ success: true, data: users })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch users" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { authorized } = await requireAdmin(request)
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: "Admin only" },
        { status: 403 }
      )
    }

    const body = CreateUserSchema.parse(await request.json())

    if (body.role === "admin") {
      return NextResponse.json(
        { success: false, error: "Only one admin is allowed" },
        { status: 400 }
      )
    }

    await connectToDatabase()

    const hashedPassword = await hashPassword(body.password)
    const user = await User.create({
      name: body.name,
      email: body.email.toLowerCase(),
      password: hashedPassword,
      role: body.role,
      stores: [DEFAULT_STORE],
      isActive: body.isActive ?? true,
      isAdmin: false,
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          stores: user.stores,
          isActive: user.isActive,
          isAdmin: user.isAdmin,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: "Please fill all required fields" },
        { status: 400 }
      )
    }

    if (isDuplicateKeyError(error)) {
      return NextResponse.json(
        { success: false, error: "A user with that email already exists" },
        { status: 409 }
      )
    }

    if (isNetworkError(error)) {
      return NextResponse.json(
        { success: false, error: NETWORK_ERROR_MESSAGE },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { success: false, error: "Failed to create user" },
      { status: 400 }
    )
  }
}
