import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { eodTime: true },
  });

  return NextResponse.json({ eodTime: user?.eodTime ?? null });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { eodTime } = await request.json();

  await prisma.user.update({
    where: { id: session.user.id },
    data: { eodTime: eodTime ? new Date(eodTime) : null },
  });

  return NextResponse.json({ eodTime });
}
