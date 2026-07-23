import { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/sessions — List all past learning sessions (most recent first).
 * POST /api/sessions — Create or update a session, or record an attempt.
 */

export async function GET(): Promise<Response> {
  const db = getDb();
  if (!db) {
    return Response.json({ sessions: [] }, { status: 200 });
  }

  try {
    const rows = await db
      .select()
      .from(schema.sessions)
      .orderBy(desc(schema.sessions.createdAt))
      .limit(50);

    return Response.json({ sessions: rows }, { status: 200 });
  } catch (error) {
    console.error("[sessions GET]", error);
    return Response.json({ sessions: [] }, { status: 200 });
  }
}

type SessionBody =
  | {
      action: "create";
      title: string;
      difficulty: string;
      objectives: { title: string; description: string }[];
      provider: string;
    }
  | {
      action: "attempt";
      sessionId: string;
      questionId: string;
      objectiveTitle: string;
      question: string;
      selectedOptionId: string;
      correct: boolean;
      attemptNumber: number;
    }
  | {
      action: "complete";
      sessionId: string;
      totalQuestions: number;
      totalCorrect: number;
      totalAttempts: number;
      accuracy: number;
      studyTips: string[];
    };

export async function POST(req: NextRequest): Promise<Response> {
  const db = getDb();
  if (!db) {
    // DB not configured — return a fake session id so the app still works.
    return Response.json({ id: "no-db-" + Date.now() }, { status: 200 });
  }

  let body: SessionBody;
  try {
    body = (await req.json()) as SessionBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    if (body.action === "create") {
      const [row] = await db
        .insert(schema.sessions)
        .values({
          title: body.title,
          difficulty: body.difficulty,
          objectiveCount: body.objectives.length,
          objectives: body.objectives,
          provider: body.provider,
        })
        .returning({ id: schema.sessions.id });

      return Response.json({ id: row.id }, { status: 201 });
    }

    if (body.action === "attempt") {
      await db.insert(schema.attempts).values({
        sessionId: body.sessionId,
        questionId: body.questionId,
        objectiveTitle: body.objectiveTitle,
        question: body.question,
        selectedOptionId: body.selectedOptionId,
        correct: body.correct,
        attemptNumber: body.attemptNumber,
      });

      return Response.json({ ok: true }, { status: 200 });
    }

    if (body.action === "complete") {
      await db
        .update(schema.sessions)
        .set({
          totalQuestions: body.totalQuestions,
          totalCorrect: body.totalCorrect,
          totalAttempts: body.totalAttempts,
          accuracy: body.accuracy,
          studyTips: body.studyTips,
          completed: true,
          completedAt: new Date(),
        })
        .where(eq(schema.sessions.id, body.sessionId));

      return Response.json({ ok: true }, { status: 200 });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[sessions POST]", error);
    return Response.json(
      { error: "Failed to save session data" },
      { status: 500 },
    );
  }
}
