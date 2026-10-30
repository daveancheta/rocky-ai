import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    // Read request-specific data before the catch block so Next.js can use it
    // to bail out of prerendering this session-dependent route.
    const requestHeaders = request.headers;
    try {
        const session = await auth.api.getSession({
            headers: requestHeaders
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
