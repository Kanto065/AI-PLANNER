"use client";

import { useEffect, useState, useTransition } from "react";
import { Blueprint } from "./Blueprint";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { sendTriageMessage, respondToProposal, type StoredMessage } from "@/lib/actions/triage";
import { previewGoalPlan, type PlanPreview } from "@/lib/actions/goals";
import { formatHM } from "@/lib/date-utils";

export type SessionSummary = { id: string; date: string; summary: string; messages: StoredMessage[] };

function GoalActionCard({ msg, index, onRespond, pending }: { msg: Extract<StoredMessage["proposal"], { kind: "goal_action" }>; index: number; onRespond: (i: number, d: "confirm" | "reject") => void; pending: boolean }) {
  return (
    <Blueprint className="max-w-[88%] self-start p-3.5" style={{ background: "var(--color-accent-100)" }}>
      <div className="mb-1.5" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-accent-800)" }}>
        Proposed change
      </div>
      <div className="mb-2.5" style={{ fontSize: 14 }}>{msg.text}</div>
      <ProposalActions status={msg.status} index={index} onRespond={onRespond} pending={pending} />
    </Blueprint>
  );
}

function PlanProposalCard({ msg, index, onRespond, pending }: { msg: Extract<StoredMessage["proposal"], { kind: "goal_plan" }>; index: number; onRespond: (i: number, d: "confirm" | "reject") => void; pending: boolean }) {
  const [preview, setPreview] = useState<PlanPreview | null>(null);

  useEffect(() => {
    let cancelled = false;
    previewGoalPlan({
      weekdays: msg.weekdays,
      sessionMinutes: msg.sessionMinutes,
      preferredStartMinutes: msg.preferredStartMinutes,
      deadline: msg.deadline ? new Date(msg.deadline + "T00:00:00") : null,
      estimatedHours: msg.estimatedHours ?? null,
    }).then((result) => { if (!cancelled) setPreview(result); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const frequencyLabel = msg.weekdays.length === 0 ? "Every day" : msg.weekdays.map((d) => dayNames[d]).join(", ");

  return (
    <Blueprint className="max-w-[88%] self-start p-3.5" style={{ background: "var(--color-accent-100)" }}>
      <div className="mb-1.5" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-accent-800)" }}>
        Proposed new goal
      </div>
      <div className="mb-1" style={{ fontWeight: 500, fontSize: 15 }}>{msg.title}</div>
      {msg.description ? <div className="text-muted mb-2" style={{ fontSize: 13 }}>{msg.description}</div> : null}

      {!preview ? (
        <div className="text-muted mb-2.5" style={{ fontSize: 13 }}>Computing schedule…</div>
      ) : preview.ok ? (
        <div className="mb-2.5 grid grid-cols-2 gap-2.5">
          <div>
            <div className="text-muted" style={{ fontSize: 11 }}>Sessions</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{preview.sessionCount} ({preview.totalHours.toFixed(1)}h)</div>
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: 11 }}>Days</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{frequencyLabel}</div>
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: 11 }}>Deadline</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{msg.deadline ?? "No deadline"}</div>
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: 11 }}>Through</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>
              {preview.lastDateIso ? new Date(preview.lastDateIso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-2.5" style={{ fontSize: 13, color: "var(--color-accent-800)" }}>{preview.errors.join(" ")}</div>
      )}

      <ProposalActions status={msg.status} index={index} onRespond={onRespond} pending={pending} disabled={!preview?.ok} />
    </Blueprint>
  );
}

function TaskProposalCard({ msg, index, onRespond, pending }: { msg: Extract<StoredMessage["proposal"], { kind: "task_create" }>; index: number; onRespond: (i: number, d: "confirm" | "reject") => void; pending: boolean }) {
  return (
    <Blueprint className="max-w-[88%] self-start p-3.5" style={{ background: "var(--color-accent-100)" }}>
      <div className="mb-1.5" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-accent-800)" }}>
        Proposed task
      </div>
      <div className="mb-1" style={{ fontWeight: 500, fontSize: 15 }}>{msg.title}</div>
      <div className="text-muted mb-2.5" style={{ fontSize: 13 }}>
        {msg.scheduledDate}
        {msg.scheduledStartMinutes != null ? ` · ${formatHM(new Date(2000, 0, 1, Math.floor(msg.scheduledStartMinutes / 60), msg.scheduledStartMinutes % 60))}` : ""}
      </div>
      <ProposalActions status={msg.status} index={index} onRespond={onRespond} pending={pending} />
    </Blueprint>
  );
}

function ProposalActions({ status, index, onRespond, pending, disabled }: { status: "pending" | "confirmed" | "rejected"; index: number; onRespond: (i: number, d: "confirm" | "reject") => void; pending: boolean; disabled?: boolean }) {
  if (status === "confirmed") return <span className="tag tag-outline">Applied</span>;
  if (status === "rejected") return <span className="tag tag-neutral">Dismissed</span>;
  return (
    <div className="flex gap-2">
      <button className="btn btn-primary" disabled={pending || disabled} onClick={() => onRespond(index, "confirm")} style={{ fontSize: 12, padding: "6px 12px" }} type="button">Confirm</button>
      <button className="btn btn-secondary" disabled={pending} onClick={() => onRespond(index, "reject")} style={{ fontSize: 12, padding: "6px 12px" }} type="button">Reject</button>
    </div>
  );
}

function ProposalCard({ msg, index, onRespond, pending }: { msg: StoredMessage; index: number; onRespond: (i: number, d: "confirm" | "reject") => void; pending: boolean }) {
  if (!msg.proposal) return null;
  if (msg.proposal.kind === "goal_plan") return <PlanProposalCard msg={msg.proposal} index={index} onRespond={onRespond} pending={pending} />;
  if (msg.proposal.kind === "task_create") return <TaskProposalCard msg={msg.proposal} index={index} onRespond={onRespond} pending={pending} />;
  return <GoalActionCard msg={msg.proposal} index={index} onRespond={onRespond} pending={pending} />;
}

export function TriageChat({ initialSessionId, initialMessages, sessions }: { initialSessionId: string | null; initialMessages: StoredMessage[]; sessions: SessionSummary[] }) {
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [messages, setMessages] = useState<StoredMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [pending, startTransition] = useTransition();
  const [openedSession, setOpenedSession] = useState<SessionSummary | null>(null);

  const speech = useSpeechRecognition((text) => setInput((prev) => (prev ? prev + " " : "") + text));

  const send = () => {
    const text = input.trim();
    if (!text || thinking) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setThinking(true);
    startTransition(async () => {
      const result = await sendTriageMessage(sessionId, text);
      setSessionId(result.sessionId);
      setMessages(result.messages);
      setThinking(false);
    });
  };

  const respond = (index: number, decision: "confirm" | "reject") => {
    if (!sessionId) return;
    startTransition(async () => {
      const result = await respondToProposal(sessionId, index, decision);
      setMessages(result.messages);
    });
  };

  return (
    <div className="grid gap-5 md:grid-cols-[1fr_260px]" style={{ height: "calc(100% - 4px)" }}>
      <div className="flex flex-col" style={{ height: "70vh", minHeight: 420 }}>
        <h2 className="mb-3.5">Triage</h2>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
          {messages.map((m, i) => (
            <div key={i} className="flex flex-col">
              {m.role === "user" && (
                <div className="max-w-[80%] self-end" style={{ background: "var(--color-accent)", color: "var(--color-bg)", padding: "10px 13px", borderRadius: "var(--radius-md)", fontSize: 14 }}>
                  {m.text}
                </div>
              )}
              {m.role === "assistant" && !m.proposal && (
                <div className="max-w-[80%] self-start border" style={{ borderColor: "var(--color-divider)", padding: "10px 13px", borderRadius: "var(--radius-md)", fontSize: 14 }}>
                  {m.text}
                </div>
              )}
              {m.role === "assistant" && m.proposal && (
                <div className="flex flex-col gap-2">
                  <div className="max-w-[80%] self-start border" style={{ borderColor: "var(--color-divider)", padding: "10px 13px", borderRadius: "var(--radius-md)", fontSize: 14 }}>
                    {m.text}
                  </div>
                  <ProposalCard msg={m} index={i} onRespond={respond} pending={pending} />
                </div>
              )}
              {m.role === "system" && (
                <div className="self-center text-muted" style={{ fontSize: 12 }}>{m.text}</div>
              )}
            </div>
          ))}
          {thinking && <div className="text-muted self-start" style={{ fontSize: 13 }}>AI Planner is thinking…</div>}
        </div>
        <div className="mt-3 flex items-center gap-2 border-t pt-3" style={{ borderColor: "var(--color-divider)" }}>
          <button
            className="btn btn-icon"
            onClick={speech.toggle}
            disabled={!speech.supported}
            title={speech.supported ? "Voice input" : "Voice input not supported in this browser"}
            style={{ border: "1px solid var(--color-divider)", background: speech.recording ? "var(--color-accent-100)" : "transparent" }}
            type="button"
          >
            {speech.recording ? (
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-accent-800)", animation: "recPulse 1s infinite", display: "block" }} />
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                <path d="M12 18v3" />
                <path d="M9 21h6" />
              </svg>
            )}
          </button>
          <input
            className="input flex-1"
            placeholder={speech.recording ? "Listening…" : "Talk through what's on your mind…"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
          />
          <button className="btn btn-primary" onClick={send} disabled={thinking} style={{ padding: "9px 13px" }} type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 12L21 4l-8 17-2.5-7.5L4 12z" /></svg>
          </button>
        </div>
      </div>

      {sessions.length > 0 && (
        <div>
          <h6 className="mb-3">Past sessions</h6>
          <div className="flex flex-col gap-2">
            {sessions.map((s) => (
              <Blueprint key={s.id} className="cursor-pointer p-3" style={{ background: "var(--color-bg)" }} onClick={() => setOpenedSession(s)}>
                <div className="text-muted mb-1" style={{ fontSize: 12 }}>{s.date}</div>
                <div style={{ fontSize: 13 }}>{s.summary}</div>
              </Blueprint>
            ))}
          </div>
        </div>
      )}

      {openedSession && (
        <div className="dialog-backdrop" onClick={() => setOpenedSession(null)}>
          <Blueprint as="div" className="dialog p-5.5" style={{ maxHeight: "70vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <h4 className="mb-1">{openedSession.date}</h4>
            <div className="text-muted mb-4" style={{ fontSize: 13 }}>{openedSession.summary}</div>
            <div className="flex flex-col gap-2.5">
              {openedSession.messages.filter((m) => m.role !== "system").map((m, i) => (
                <div key={i} className={m.role === "user" ? "self-end" : "self-start"} style={{
                  maxWidth: "85%",
                  background: m.role === "user" ? "var(--color-accent)" : "transparent",
                  color: m.role === "user" ? "var(--color-bg)" : "var(--color-text)",
                  border: m.role === "assistant" ? "1px solid var(--color-divider)" : "none",
                  padding: "9px 12px",
                  borderRadius: "var(--radius-md)",
                  fontSize: 13,
                }}>
                  {m.text}
                </div>
              ))}
            </div>
            <button className="btn btn-secondary mt-4 w-full" onClick={() => setOpenedSession(null)} type="button">Close</button>
          </Blueprint>
        </div>
      )}
    </div>
  );
}
