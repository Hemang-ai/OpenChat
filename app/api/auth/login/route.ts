import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { verifyPassword } from "@/lib/auth/password";
import { signToken, COOKIE_NAME_EXPORT } from "@/lib/auth/jwt";
import { writeAuditEvent } from "@/lib/security/audit";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";

const schema = z.object({
  email: z.string().trim().min(1).max(255),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = schema.parse(body);
    const ip = getClientIp(req);
    const limit = await rateLimit({ key: `${ip}:${email.toLowerCase()}`, namespace: "auth-login", limit: 10, windowSeconds: 15 * 60 });
    const limitHeaders = rateLimitHeaders(limit);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many sign-in attempts. Please try again later." }, { status: 429, headers: limitHeaders });
    }

    const user = await db.user.findFirst({
      where: { OR: [{ email: email.toLowerCase() }, { username: email.toLowerCase() }] },
    });
    if (!user) {
      await writeAuditEvent({ type: "auth.login.failed", metadata: { identifier: email.toLowerCase() }, ip });
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401, headers: limitHeaders });
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        { error: "This account uses Google sign-in" },
        { status: 401, headers: limitHeaders }
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      await writeAuditEvent({ type: "auth.login.failed", actorId: user.id, ip });
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401, headers: limitHeaders });
    }

    const token = signToken({ userId: user.id, email: user.email });

    const response = NextResponse.json({ success: true, userId: user.id, name: user.name });
    response.cookies.set(COOKIE_NAME_EXPORT, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    Object.entries(limitHeaders).forEach(([key, value]) => response.headers.set(key, value));

    await writeAuditEvent({ type: "auth.login.succeeded", actorId: user.id, ip });

    return response;
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
