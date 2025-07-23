
import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET() {
    const session = await getSession();

    if (!session) {
        return NextResponse.json({ user: null }, { status: 401 });
    }

    const { id, email, isAdmin } = session;
    return NextResponse.json({ user: { id, email, isAdmin } });
}
