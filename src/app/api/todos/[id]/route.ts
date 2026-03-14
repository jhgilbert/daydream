import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (typeof body.done === "boolean") {
    data.done = body.done;
    data.completedAt = body.done ? new Date() : null;
  }
  if (typeof body.priority === "number") data.priority = body.priority;
  if (typeof body.blocked === "boolean") data.blocked = body.blocked;
  if (typeof body.deleted === "boolean") data.deleted = body.deleted;
  if (typeof body.notes === "string") data.notes = body.notes;

  const todo = await prisma.todo.updateMany({
    where: { id, userId: session.user.id },
    data,
  });

  if (todo.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
