import { Redis } from "@upstash/redis";

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
import { NextRequest, NextResponse } from "next/server";

export interface Suggestion {
  id: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  marketType: "EVENT" | "PRICE";
  submittedBy: string;
  submittedAt: number;
  status: "pending" | "approved" | "rejected";
}

const KEY = "market_suggestions";

export async function GET() {
  try {
    const suggestions: Suggestion[] = (await kv.get(KEY)) ?? [];
    return NextResponse.json(suggestions);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { question, optionA, optionB, optionC, marketType, submittedBy } = body;

    if (!question?.trim() || !optionA?.trim() || !optionB?.trim() || !submittedBy)
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    const existing: Suggestion[] = (await kv.get(KEY)) ?? [];

    const suggestion: Suggestion = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      question: question.trim(),
      optionA: optionA.trim(),
      optionB: optionB.trim(),
      optionC: optionC?.trim() ?? "",
      marketType: marketType === "PRICE" ? "PRICE" : "EVENT",
      submittedBy,
      submittedAt: Date.now(),
      status: "pending",
    };

    await kv.set(KEY, [...existing, suggestion]);
    return NextResponse.json(suggestion, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to save suggestion" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, status } = await req.json();
    const existing: Suggestion[] = (await kv.get(KEY)) ?? [];
    const updated = existing.map((s) => s.id === id ? { ...s, status } : s);
    await kv.set(KEY, updated);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    const existing: Suggestion[] = (await kv.get(KEY)) ?? [];
    await kv.set(KEY, existing.filter((s) => s.id !== id));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
