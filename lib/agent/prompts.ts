import type { LearningObjective } from "./schemas";

/**
 * System prompts for the Memorang AI Learning Agent nodes. Centralised here so
 * pedagogical tone and constraints stay consistent and are easy to tune.
 */

/** Guides the planner to draft a structured lesson plan from PDF content. */
export const PLANNER_SYSTEM_PROMPT = `You are an expert instructional designer.
Analyze the provided document text and produce a concise, well-structured
lesson plan. Choose an overall difficulty (beginner, intermediate, or advanced)
that matches the material. Break the content into 3-5 focused learning
objectives, ordered from foundational to advanced. Each objective must be
directly grounded in the document content — do not invent topics that are not
present in the text.

Your output must be a JSON object with exactly these fields:
- "title": string (the overall lesson title)
- "difficulty": one of "beginner", "intermediate", or "advanced"
- "objectives": array of objects, each with "title" (string) and "description" (string)

Do not add any other fields. Do not wrap the object in another key.`;

/** Builds the human prompt that feeds PDF text into the planner. */
export function buildPlannerHumanPrompt(pdfText: string): string {
  return `Draft a lesson plan for the following document content:\n\n"""\n${pdfText}\n"""`;
}

/** Guides MCQ generation for a single objective. */
export const MCQ_GENERATOR_SYSTEM_PROMPT = `You are an expert assessment author.
Generate high-quality multiple-choice questions that test the learner's grasp
of a specific learning objective. Rules:
- Every question must have exactly four choices with ids "a", "b", "c", "d".
- Exactly one choice is correct; set correctOptionId to that choice's id.
- Ground every question strictly in the supplied document content.
- Provide a clear explanation shown only after a correct answer.
- Provide a subtle hint that nudges the learner toward the concept WITHOUT
  revealing or eliminating specific answer choices.
- Set objectiveIndex to the provided objective index for every question.
- Set id to a unique string identifier for each question.

Your output must be a JSON object with this exact structure:
{
  "questions": [
    {
      "id": "<unique string>",
      "objectiveIndex": <number>,
      "question": "<question text>",
      "choices": [
        { "id": "a", "text": "<choice text>" },
        { "id": "b", "text": "<choice text>" },
        { "id": "c", "text": "<choice text>" },
        { "id": "d", "text": "<choice text>" }
      ],
      "correctOptionId": "<one of a, b, c, d>",
      "explanation": "<explanation text>",
      "hint": "<hint text>"
    }
  ]
}

Do NOT use an "options" object. Use the "choices" array format shown above.
Do NOT omit the "id" or "objectiveIndex" fields from any question.`;

/** Builds the human prompt for generating MCQs for one objective. */
export function buildMcqHumanPrompt(params: {
  pdfText: string;
  objective: LearningObjective;
  objectiveIndex: number;
  count: number;
}): string {
  const { pdfText, objective, objectiveIndex, count } = params;
  return [
    `Objective index: ${objectiveIndex}`,
    `Objective title: ${objective.title}`,
    `Objective description: ${objective.description}`,
    ``,
    `Generate ${count} multiple-choice question(s) for this objective.`,
    `Use "obj${objectiveIndex}-q0", "obj${objectiveIndex}-q1", etc. as the question ids.`,
    `Set objectiveIndex to ${objectiveIndex} for every question.`,
    `Remember: use "choices" array with {id, text} objects, NOT an "options" object.`,
    ``,
    `Document content:`,
    `"""`,
    pdfText,
    `"""`,
  ].join("\n");
}

/** Guides generation of personalized study tips for the final summary. */
export const SUMMARY_SYSTEM_PROMPT = `You are a supportive learning coach.
Given a learner's performance across a lesson, write 2-5 concise, encouraging,
and actionable study tips. Focus on the objectives where the learner struggled
(needed multiple attempts or answered incorrectly). Keep each tip to one
sentence. Do not restate raw numbers; translate them into guidance.`;

/** Builds the human prompt summarizing performance for study-tip generation. */
export function buildSummaryHumanPrompt(params: {
  lessonTitle: string;
  totalQuestions: number;
  totalCorrect: number;
  totalAttempts: number;
  perObjective: { title: string; correct: number; total: number }[];
}): string {
  const {
    lessonTitle,
    totalQuestions,
    totalCorrect,
    totalAttempts,
    perObjective,
  } = params;
  const lines = perObjective.map(
    (o) => `- ${o.title}: ${o.correct}/${o.total} correct`,
  );
  return [
    `Lesson: ${lessonTitle}`,
    `Overall: ${totalCorrect}/${totalQuestions} correct across ${totalAttempts} total attempts.`,
    `Per-objective results:`,
    ...lines,
    ``,
    `Write personalized study tips based on this performance.`,
  ].join("\n");
}
