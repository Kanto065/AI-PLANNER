import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/actions/require-user";
import { AppShell } from "@/lib/design/AppShell";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const userId = await requireUserId();

  const openLog = await prisma.timeLog.findFirst({
    where: { userId, endedAt: null },
    include: { task: { select: { id: true, title: true } } },
  });

  const timer = openLog
    ? { taskId: openLog.task.id, taskTitle: openLog.task.title, startedAt: openLog.startedAt.toISOString() }
    : null;

  return <AppShell timer={timer}>{children}</AppShell>;
}
