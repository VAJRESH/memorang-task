import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Database schema for the Memorang AI Learning Agent.
 *
 * Each PDF upload creates a `session`. Each question answered within that
 * session creates an `attempt`. The summary at the end updates the session
 * with final stats. Generated questions are stored in `questions` so the
 * server can evaluate answers without exposing correct options to the client.
 */

/** A learning session = one PDF uploaded and worked through. */
export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** Title of the lesson plan generated for this session. */
  title: text("title").notNull(),
  /** Difficulty of the lesson (beginner/intermediate/advanced). */
  difficulty: text("difficulty").notNull(),
  /** Number of objectives in the lesson plan. */
  objectiveCount: integer("objective_count").notNull().default(0),
  /** The objectives as JSON array of {title, description}. */
  objectives: jsonb("objectives")
    .$type<{ title: string; description: string }[]>()
    .notNull()
    .default([]),
  /** Total questions answered in this session. */
  totalQuestions: integer("total_questions").notNull().default(0),
  /** Total questions answered correctly (first or eventual). */
  totalCorrect: integer("total_correct").notNull().default(0),
  /** Total individual answer submissions (including retries). */
  totalAttempts: integer("total_attempts").notNull().default(0),
  /** Accuracy percentage (0-100). */
  accuracy: integer("accuracy").notNull().default(0),
  /** AI-generated study tips from the summary. */
  studyTips: jsonb("study_tips").$type<string[]>().notNull().default([]),
  /** Whether the session was completed (all MCQs answered + summary shown). */
  completed: boolean("completed").notNull().default(false),
  /** AI provider used for this session. */
  provider: text("provider").notNull().default("gemini"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

/** A single question attempt within a session. */
export const attempts = pgTable("attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id")
    .references(() => sessions.id)
    .notNull(),
  /** The question ID from the graph (e.g. "obj0-q1"). */
  questionId: text("question_id").notNull(),
  /** The objective this question belongs to. */
  objectiveTitle: text("objective_title").notNull(),
  /** The question text. */
  question: text("question").notNull(),
  /** The option ID the user selected. */
  selectedOptionId: text("selected_option_id").notNull(),
  /** Whether this specific submission was correct. */
  correct: boolean("correct").notNull(),
  /** Which attempt number this was for the same question (1, 2, 3...). */
  attemptNumber: integer("attempt_number").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Generated MCQ questions stored server-side for secure evaluation.
 * The client never receives correctOptionId, explanation, or hint directly —
 * they are only revealed through the /api/evaluate endpoint after submission.
 */
export const questions = pgTable("questions", {
  /** Deterministic question ID (e.g. "obj0-q0"). Used as primary key. */
  id: text("id").primaryKey(),
  /** Index of the objective this question belongs to. */
  objectiveIndex: integer("objective_index").notNull(),
  /** The question prompt text. */
  question: text("question").notNull(),
  /** The four answer choices as JSON array of {id, text}. */
  choices: jsonb("choices").$type<{ id: string; text: string }[]>().notNull(),
  /** The correct choice ID (a, b, c, or d). */
  correctOptionId: text("correct_option_id").notNull(),
  /** Explanation shown after a correct answer. */
  explanation: text("explanation").notNull(),
  /** Hint shown after an incorrect answer. */
  hint: text("hint").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Attempt = typeof attempts.$inferSelect;
export type NewAttempt = typeof attempts.$inferInsert;
export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
