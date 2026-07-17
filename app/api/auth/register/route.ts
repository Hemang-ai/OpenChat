import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";
import { signToken, COOKIE_NAME_EXPORT } from "@/lib/auth/jwt";
import { slugify } from "@/lib/utils/validation";
import { writeAuditEvent } from "@/lib/security/audit";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";

const schema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  workspaceName: z.string().min(2).max(100),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, workspaceName } = schema.parse(body);
    const ip = getClientIp(req);
    const limit = await rateLimit({ key: ip, namespace: "auth-register", limit: 5, windowSeconds: 60 * 60 });
    const limitHeaders = rateLimitHeaders(limit);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many registration attempts. Please try again later." }, { status: 429, headers: limitHeaders });
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409, headers: limitHeaders });
    }

    const passwordHash = await hashPassword(password);
    const slug = slugify(workspaceName) + "-" + Math.random().toString(36).slice(2, 6);

    const user = await db.user.create({
      data: {
        name,
        email,
        passwordHash,
        workspaces: {
          create: {
            name: workspaceName,
            slug,
          },
        },
      },
      include: { workspaces: { select: { id: true }, take: 1 } },
    });

    const token = signToken({ userId: user.id, email: user.email });

    const response = NextResponse.json({ success: true, userId: user.id });
    response.cookies.set(COOKIE_NAME_EXPORT, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    Object.entries(limitHeaders).forEach(([key, value]) => response.headers.set(key, value));

    await writeAuditEvent({
      type: "auth.signup.completed",
      actorId: user.id,
      workspaceId: user.workspaces[0]?.id,
      targetType: "user",
      targetId: user.id,
      ip,
    });

    return response;
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || err.message }, { status: 400 });
    }
    console.error("Register error:", err);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
