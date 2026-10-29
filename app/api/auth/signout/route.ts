import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
    try {
        await auth.api.signOut({
            headers: await headers(),
        })

        return NextResponse.json({
            success: true
        })
    } catch (error) {
        console.error("Sign out failed:", error)
        return NextResponse.json({
            success: false,
            message: "Could not sign out. Please try again.",
        }, { status: 500 })
    }
}
