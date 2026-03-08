import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name } = await request.json();
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  // Assign sortOrder to place at end of list
  const last = await prisma.project.findFirst({
    where: { userId: session.user.id },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const nextOrder = (last?.sortOrder ?? -1) + 1;

  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      sortOrder: nextOrder,
      userId: session.user.id,
    },
  });

  return NextResponse.json(project, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderedIds } = await request.json();
  if (!Array.isArray(orderedIds)) {
    return NextResponse.json({ error: "orderedIds is required" }, { status: 400 });
  }

  // Update sortOrder for each project based on its position in the array
  await Promise.all(
    orderedIds.map((id: string, index: number) =>
      prisma.project.updateMany({
        where: { id, userId: session.user.id },
        data: { sortOrder: index },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
