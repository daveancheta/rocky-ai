import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        })

        if (!session) {
            return NextResponse.json({
                success: true,
                message: "Not Authenticated :("
            }, { status: 200 })
        }

        return NextResponse.json({
            success: true,
            session: {
                user: session.user
            },
            message: "Authenticated!"
        }, { status: 200 })
    } catch (error) {
        console.error("Could not read session:", error)
        return NextResponse.json({
            success: false,
            message: "Could not read session.",
        }, { status: 500 })
    }
}