import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { MCQQuestion } from "./schemas";

/**
 * Server-side question store for secure answer evaluation.
 *
 * Questions are persisted to the database so the client never sees correct
 * answers. When the DB is not configured, falls back to an in-memory map
 * (acceptable for local development / demo).
 *
 * The `/api/evaluate` endpoint uses `getQuestion()` to look up the full
 * question data and validate submissions.
 */

// --- In-memory fallback (used when DATABASE_URL is not set) ---
const memoryStore = new Map<string, MCQQuestion>();

/** Store a batch of questions (DB with in-memory fallback). */
export async function storeQuestions(questions: MCQQuestion[]): Promise<void> {
  const db = getDb();

  if (!db) {
    // Fallback: in-memory store.
    for (const q of questions) {
      memoryStore.set(q.id, q);
    }
    return;
  }

  // Upsert into the database. Use onConflictDoUpdate to handle re-generation
  // of questions for the same objective (same IDs like "obj0-q0").
  const values = questions.map((q) => ({
    id: q.id,
    objectiveIndex: q.objectiveIndex,
    question: q.question,
    choices: q.choices,
    correctOptionId: q.correctOptionId,
    explanation: q.explanation,
    hint: q.hint,
  }));

  for (const val of values) {
    await db
      .insert(schema.questions)
      .values(val)
      .onConflictDoUpdate({
        target: schema.questions.id,
        set: {
          objectiveIndex: val.objectiveIndex,
          question: val.question,
          choices: val.choices,
          correctOptionId: val.correctOptionId,
          explanation: val.explanation,
          hint: val.hint,
        },
      });
  }
}

/** Retrieve a question by ID (DB with in-memory fallback). */
export async function getQuestion(
  questionId: string,
): Promise<MCQQuestion | undefined> {
  const db = getDb();

  if (!db) {
    return memoryStore.get(questionId);
  }

  const [row] = await db
    .select()
    .from(schema.questions)
    .where(eq(schema.questions.id, questionId))
    .limit(1);

  if (!row) return undefined;

  return {
    id: row.id,
    objectiveIndex: row.objectiveIndex,
    question: row.question,
    choices: row.choices,
    correctOptionId: row.correctOptionId,
    explanation: row.explanation,
    hint: row.hint,
  };
}

/**
 * Strip answer-revealing fields from a question before sending to the client.
 * Returns a "safe" version with only: id, objectiveIndex, question, choices.
 */
export function stripAnswerFields(
  question: MCQQuestion,
): Omit<MCQQuestion, "correctOptionId" | "explanation" | "hint"> {
  const { correctOptionId: _, explanation: __, hint: ___, ...safe } = question;
  return safe;
}

/** Strip answer fields from a batch of questions. */
export function stripBatch(
  questions: MCQQuestion[],
): Omit<MCQQuestion, "correctOptionId" | "explanation" | "hint">[] {
  return questions.map(stripAnswerFields);
}
