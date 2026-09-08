import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/actions/require-user";
import { TriageChat, type SessionSummary } from "@/lib/design/TriageChat";
import type { StoredMessage } from "@/lib/actions/triage";
import { startOfDay } from "@/lib/date-utils";

export default async function TriagePage() {
  const userId = await requireUserId();
  const todayStart = startOfDay(new Date());

  const recent = await prisma.conversationSummary.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const active = recent.find((s) => s.createdAt >= todayStart) ?? null;
  const past = recent.filter((s) => s !== active);

  const sessions: SessionSummary[] = past.map((s) => ({
    id: s.id,
    date: s.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    summary: s.summary,
    messages: (s.messages as StoredMessage[] | null) ?? [],
  }));

  return (
    <TriageChat
      initialSessionId={active?.id ?? null}
      initialMessages={(active?.messages as StoredMessage[] | null) ?? []}
      sessions={sessions}
    />
  );
}
