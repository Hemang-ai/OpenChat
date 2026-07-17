import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateServiceRequest } from "@/lib/auth/service-api";
import { db } from "@/lib/db/client";

const createSchema = z.object({ userName: z.string().email(), active: z.boolean().default(true), displayName: z.string().max(120).optional(), roles: z.array(z.object({ value: z.enum(["ADMIN", "BUILDER", "ANALYST", "SUPPORT_AGENT", "VIEWER"]) })).optional() });
const schemas = ["urn:ietf:params:scim:schemas:core:2.0:User"];

export async function GET(req: NextRequest) {
  const identity = await authenticateServiceRequest(req, "scim:users");
  if (!identity) return NextResponse.json({ detail: "Unauthorized", schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"] }, { status: 401 });
  const members = await db.workspaceMember.findMany({ where: { workspaceId: identity.workspaceId }, include: { user: { select: { id: true, email: true, name: true } } }, take: 100 });
  return NextResponse.json({ schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"], totalResults: members.length, startIndex: 1, itemsPerPage: members.length, Resources: members.map((member) => ({ schemas, id: member.user.id, userName: member.user.email, displayName: member.user.name, active: true, roles: [{ value: member.role }] })) });
}

export async function POST(req: NextRequest) {
  const identity = await authenticateServiceRequest(req, "scim:users");
  if (!identity) return NextResponse.json({ detail: "Unauthorized", schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"] }, { status: 401 });
  try {
    const data = createSchema.parse(await req.json());
    const user = await db.user.upsert({ where: { email: data.userName.toLowerCase() }, update: { name: data.displayName }, create: { email: data.userName.toLowerCase(), name: data.displayName } });
    const role = data.roles?.[0]?.value || "VIEWER";
    await db.workspaceMember.upsert({ where: { workspaceId_userId: { workspaceId: identity.workspaceId, userId: user.id } }, update: { role }, create: { workspaceId: identity.workspaceId, userId: user.id, role } });
    return NextResponse.json({ schemas, id: user.id, userName: user.email, displayName: user.name, active: data.active, roles: [{ value: role }] }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ detail: error.issues[0]?.message, schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"] }, { status: 400 });
    return NextResponse.json({ detail: "Provisioning failed", schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"] }, { status: 500 });
  }
}
