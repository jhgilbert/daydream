import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const todos = await prisma.todo.findMany({
    where: { userId: session.user.id, deleted: false },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(todos);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { text, deadline, priority, queen } = await request.json();
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const todo = await prisma.todo.create({
    data: {
      text: text.trim(),
      userId: session.user.id,
      ...(typeof deadline === "string" && { deadline: new Date(deadline) }),
      ...(typeof priority === "number" && { priority }),
      ...(queen === true && { queen: true }),
    },
  });

  return NextResponse.json(todo, { status: 201 });
}
