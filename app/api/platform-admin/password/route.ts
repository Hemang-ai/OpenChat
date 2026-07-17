import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPlatformActor } from "@/lib/auth/platform-admin";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { db } from "@/lib/db/client";
import { writeAuditEvent } from "@/lib/security/audit";

const schema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(15).max(128) });

export async function POST(req: NextRequest) {
  const actor = await getPlatformActor();
  if (!actor) return NextResponse.json({ error: "Platform administrator access is required" }, { status: 403 });
  try {
    const { currentPassword, newPassword } = schema.parse(await req.json());
    const user = await db.user.findUnique({ where: { id: actor.id }, select: { passwordHash: true } });
    if (!user?.passwordHash || !(await verifyPassword(currentPassword, user.passwordHash))) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }
    await db.user.update({ where: { id: actor.id }, data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false } });
    await writeAuditEvent({ type: "platform.password.changed", actorId: actor.id, targetType: "user", targetId: actor.id, ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Invalid password" }, { status: 400 });
    return NextResponse.json({ error: "Could not change password" }, { status: 500 });
  }
}
