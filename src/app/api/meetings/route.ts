import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meetings = await prisma.meeting.findMany({
    where: { userId: session.user.id, endTime: { gt: new Date() } },
    orderBy: { startTime: "asc" },
  });

  return NextResponse.json(meetings);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { meetings } = await request.json();
  if (!Array.isArray(meetings) || meetings.length === 0) {
    return NextResponse.json(
      { error: "meetings array is required" },
      { status: 400 }
    );
  }

  const created = await prisma.$transaction(
    meetings.map((m: { label?: string; startTime: string; endTime: string }) =>
      prisma.meeting.create({
        data: {
          label: m.label ?? null,
          startTime: new Date(m.startTime),
          endTime: new Date(m.endTime),
          userId: session.user!.id!,
        },
      })
    )
  );

  return NextResponse.json(created, { status: 201 });
}
