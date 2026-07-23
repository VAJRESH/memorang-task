# Memorang AI Learning Agent

An AI-powered learning platform that transforms any PDF into an interactive, structured lesson with MCQs, real-time feedback, and personalized study tips.

Upload a PDF → Agent drafts a lesson plan → You review & approve → Agent generates MCQs per objective → You answer with hints/explanations → Summary with study tips.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Data Flow](#data-flow)
- [Tech Stack](#tech-stack)
- [Setup](#setup)
- [Project Structure](#project-structure)
- [Design Decisions](#design-decisions)
- [Future Improvements](#future-improvements)
- [Alternative Tools](#alternative-tools)

---

## Features

- PDF upload and text extraction
- AI-generated lesson plan with difficulty grading
- Human-in-the-Loop (HITL) plan approval with revision support
- MCQ generation grounded in document content
- **Server-side answer evaluation** — correct answers are never exposed to the client
- Per-question attempt tracking with retry (no penalty)
- Visual feedback: green/red highlights, hints, explanations
- CopilotKit sidebar tutor that helps without revealing answers
- Lesson progress bar tracking questions across objectives
- Final summary with per-objective scores and AI-generated study tips
- Session persistence with PostgreSQL (Neon)
- Dual AI provider support (Gemini / Groq) with runtime switching

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (Next.js)                          │
│                                                                 │
│  ┌──────────┐  ┌──────────────┐  ┌────────────┐  ┌──────────┐ │
│  │PdfUploader│  │PlanReviewWidget│  │MCQCardWidget│  │LessonSummary│
│  └─────┬────┘  └──────┬───────┘  └─────┬──────┘  └─────┬────┘ │
│        │               │                │               │       │
│        └───────────────┴────────────────┴───────────────┘       │
│                              │                                   │
│                    useLearningAgent (hook)                        │
│                              │                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │ HTTP
┌──────────────────────────────┼───────────────────────────────────┐
│                        Server (API Routes)                        │
│                              │                                   │
│  ┌──────────┐  ┌────────────┴───────┐  ┌──────────┐  ┌───────┐ │
│  │/upload-pdf│  │    /api/agent      │  │/evaluate │  │/sessions│ │
│  │(parse)   │  │(plan+MCQ gen)      │  │(check    │  │(CRUD)  │ │
│  └──────────┘  └────────┬───────────┘  │answers)  │  └───┬───┘ │
│                          │              └─────┬────┘      │     │
│                ┌─────────┴──────────┐         │           │     │
│                │  LangGraph Agent    │    ┌────┴───────────┴──┐  │
│                │  (Plan + Approve    │    │     Neon DB        │  │
│                │   + MCQ Gen)        │    │   (PostgreSQL)     │  │
│                └────────┬───────────┘    │ sessions, attempts, │  │
│                         │                │ questions tables     │  │
│               ┌─────────┴──────────┐    └────────────────────┘  │
│               │  Gemini / Groq LLM  │                            │
│               └────────────────────┘                            │
└──────────────────────────────────────────────────────────────────┘
```

### LangGraph State Machine (Simplified)

The agent graph only handles LLM-dependent operations. Answer evaluation is done server-side without LLM involvement.

```
START → Planner → Approval ──(approved)──→ MCQ Generator → END
                    ↑            │
                    │ (revise)   │
                    └────────────┘
                    Approval ──(rejected)──→ END
```

After the first objective's MCQs are generated by the graph, subsequent objectives use a standalone `generate-mcqs` API action (no graph traversal needed).

### Answer Evaluation (Server-Side)

```
Client submits answer ──→ POST /api/evaluate { questionId, selectedOptionId }
                                    │
                          ┌─────────┴──────────┐
                          │  Look up question   │
                          │  from DB (answers   │
                          │  stored server-side) │
                          └─────────┬──────────┘
                                    │
                          Returns { isCorrect, explanation?, hint? }
```

Questions are stored in the `questions` table with their correct answers. The client only receives `{ id, objectiveIndex, question, choices }` — never `correctOptionId`, `explanation`, or `hint`.

---

## Data Flow

1. **PDF Upload**: Client sends file to `/api/upload-pdf` → extracted text returned
2. **Start Agent**: Client sends `{ action: "start", pdfText }` to `/api/agent` → graph runs planner, hits `interrupt()` at approval
3. **Plan Approval/Revision**: Client resumes with `{ approved, feedback, revise }` → approval node processes, proceeds to MCQ generation or loops back for revision
4. **First MCQs**: Graph's MCQ generator produces questions for the first objective → questions stored in DB → stripped version (no answers) sent to client
5. **Answer Submission**: Client sends `{ questionId, selectedOptionId }` to `/api/evaluate` → server looks up correct answer from DB → returns `{ isCorrect, explanation?, hint? }`
6. **Progression**: Client tracks attempts locally, advances questions/objectives. When a new objective starts, calls `{ action: "generate-mcqs" }` on `/api/agent`
7. **Summary**: When all objectives are exhausted, client computes scores from local attempt data and calls `{ action: "generate-tips" }` for AI-generated study tips
8. **Persistence**: Hook fires side-effects to `/api/sessions` to create session on plan approval, record each attempt, and save final summary

---

## Tech Stack

| Layer       | Technology                       | Purpose                            |
| ----------- | -------------------------------- | ---------------------------------- |
| Framework   | Next.js 16 (App Router)          | Full-stack React with API routes   |
| AI Agent    | LangGraph (@langchain/langgraph) | State machine with HITL interrupts |
| LLM         | Google Gemini / Groq (LLaMA 3.3) | Structured output generation       |
| UI Runtime  | CopilotKit                       | Chat sidebar tutor + Generative UI |
| Database    | Neon (PostgreSQL)                | Session, attempt & question store  |
| ORM         | Drizzle ORM                      | Type-safe schema & queries         |
| Styling     | Tailwind CSS                     | Utility-first styling              |
| PDF Parsing | unpdf                            | Server-side text extraction        |
| Language    | TypeScript                       | End-to-end type safety             |

---

## Setup

### Prerequisites

- Node.js 18+
- npm or pnpm
- A Neon database (free tier works) or any PostgreSQL instance
- At least one AI API key (Gemini or Groq)

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd memorang-task
npm install
```

### 2. Environment Variables

Copy the example and fill in your keys:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Required (at least one):
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here

# Database (optional — app works without it, sessions won't persist):
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require

# Optional:
NEXT_PUBLIC_COPILOTKIT_RUNTIME_URL=http://localhost:3000/api/copilotkit
```

**Get API Keys:**

- Gemini: [Google AI Studio](https://aistudio.google.com/app/apikey)
- Groq: [Groq Console](https://console.groq.com/keys)
- Neon DB: [Neon Dashboard](https://console.neon.tech/)

### 3. Push Database Schema

```bash
npx drizzle-kit push
```

This creates the `sessions`, `attempts`, and `questions` tables in your database.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Usage

1. Select an AI provider (Gemini or Groq)
2. Upload a PDF
3. Review the generated lesson plan — approve, revise with feedback, or reject
4. Answer MCQs with real-time feedback (green/red, hints, explanations)
5. Complete all objectives to see your performance summary and study tips

---

## Project Structure

```
app/
├── api/
│   ├── agent/route.ts          # LangGraph driver + standalone MCQ/tips generation
│   ├── evaluate/route.ts       # Server-side answer evaluation (DB lookup)
│   ├── copilotkit/route.ts     # CopilotKit runtime endpoint for sidebar tutor
│   ├── upload-pdf/route.ts     # PDF upload & text extraction
│   └── sessions/route.ts       # Session CRUD (create, attempt, complete)
├── page.tsx                    # Main page orchestrating all widgets
├── providers.tsx               # CopilotKit context provider
└── layout.tsx                  # Root layout

components/
├── LessonTutor.tsx             # CopilotKit sidebar (answer-safe context)
├── ProviderSelector.tsx        # Gemini/Groq toggle
├── SessionHistory.tsx          # Past session cards
├── upload/
│   └── PdfUploader.tsx         # Drag-and-drop PDF upload
├── widgets/
│   ├── PlanReviewWidget.tsx    # HITL plan approval with revise button
│   ├── MCQCardWidget.tsx       # Interactive MCQ with progress & feedback
│   └── LessonSummary.tsx       # Final score report & study tips
└── ui/                         # Base UI components (Button, Card, Badge, Progress)

lib/
├── agent/
│   ├── graph.ts                # LangGraph state machine (planner → approval → mcqGen)
│   ├── nodes.ts                # Graph nodes + standalone generateMCQs/generateStudyTips
│   ├── state.ts                # LangGraph state annotation & reducers
│   ├── schemas.ts              # Zod schemas for structured LLM output
│   ├── prompts.ts              # System prompts for each generation step
│   ├── question-store.ts       # DB-backed question storage & stripping
│   └── client-types.ts         # Client-safe type definitions (no answer fields)
├── db/
│   ├── index.ts                # Neon/Drizzle connection
│   └── schema.ts               # Database tables (sessions, attempts, questions)
├── hooks/
│   └── useLearningAgent.ts     # Main client hook (state, actions, persistence)
├── pdf/parser.ts               # PDF text extraction & chunking
├── constant.ts                 # Route constants
├── errors.ts                   # Error sanitization
└── utils.ts                    # Shared helpers (cn, twMerge)

drizzle/                        # Generated migrations
```

---

## Design Decisions

### Why server-side answer evaluation?

Sending `correctOptionId` to the client means anyone can inspect network responses or JS bundles to see answers. Instead, generated questions are stored in the `questions` DB table with their full data. The client only sees question text and choices. When an answer is submitted, `/api/evaluate` looks it up server-side and returns only the relevant feedback (hint on wrong, explanation on correct).

### Why a simplified LangGraph (no evaluator/review nodes)?

Answer evaluation is a string comparison — it doesn't need an LLM or a stateful graph. Moving evaluation to a simple API endpoint eliminates unnecessary `interrupt()` → resume round-trips (2 per question), making the quiz phase significantly faster. The graph now only handles what actually requires LLMs: planning and MCQ generation.

### Why LangGraph at all (vs. plain API calls)?

LangGraph provides a **stateful, interruptible state machine** — essential for the HITL plan approval workflow. The `interrupt()` primitive pauses the graph at the approval node and resumes from the exact same point. The graph also chains planner → approval → first MCQ generation atomically with a checkpointer, so partial progress is preserved on failure.

### Why MemorySaver instead of a persistent checkpointer?

For a single-user demo app, the in-process `MemorySaver` avoids external infrastructure for graph state. Each thread (lesson) lives in memory for the duration of the server process. For production, this should be swapped to a Redis or PostgreSQL checkpointer.

### Why deterministic question IDs (`obj{index}-q{n}`)?

The summary computation groups questions by objective using ID prefixes. Relying on LLM-generated IDs caused unreliable grouping. Deterministic IDs guarantee consistent per-objective scoring.

### Why dual provider support (Gemini + Groq)?

Free-tier rate limits are common during development. Having a fallback provider means you can switch instantly when one hits limits, without code changes.

### Why CopilotKit for the tutor sidebar?

CopilotKit provides a pre-built chat UI with `useCopilotReadable` for exposing context to the LLM. The tutor can see lesson state but `correctOptionId` is never on the client — preventing answer leaks while still enabling helpful hints.

### Why Neon (serverless PostgreSQL)?

Neon's HTTP driver works in serverless/edge environments without persistent connections. Free tier is sufficient. The app gracefully degrades if `DATABASE_URL` is not set — the question store falls back to in-memory and sessions don't persist.

### Why per-question attempt tracking (not per-session)?

Pedagogically, retry attempts are meaningful at the question level. A learner who gets 1 question wrong 3 times but aces everything else shouldn't see "15 total attempts" — they should see "1 question needed 3 tries."

---

## Future Improvements

### Features

- **Spaced repetition**: Track weak objectives and resurface them in future sessions
- **Adaptive difficulty**: Dynamically adjust question difficulty based on performance
- **Multi-modal content**: Support images, diagrams, and tables from PDFs
- **Collaborative learning**: Shared sessions with leaderboards
- **Export/share**: Generate sharable lesson cards or flashcard decks
- **Voice interaction**: Audio-based Q&A for accessibility
- **Progress streaks**: Gamification with daily learning goals

### Technical

- **Streaming responses**: Use LangGraph streaming for real-time UI updates during generation
- **Persistent checkpointer**: Replace MemorySaver with PostgreSQL checkpointer for multi-instance deployments
- **Authentication**: Add NextAuth or Clerk for multi-user support
- **Question expiry**: Add TTL to the questions table to clean up old entries
- **Caching**: Cache generated plans/MCQs to avoid redundant LLM calls on revision
- **Queue-based generation**: Use background jobs for MCQ generation to avoid API route timeouts
- **Better PDF parsing**: Handle scanned PDFs with OCR (Tesseract/AWS Textract)
- **Test coverage**: Add integration tests for the LangGraph flow with mocked LLM responses
- **Observability**: Add LangSmith tracing for debugging agent behavior in production

---

## Alternative Tools

| Current Choice   | Alternatives                                    | Trade-offs                                                                                             |
| ---------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **LangGraph**    | Mastra, Temporal, Inngest                       | Mastra is simpler but less mature; Temporal/Inngest are overkill for a single-graph flow               |
| **Gemini**       | OpenAI GPT-4o, Claude, Mistral                  | OpenAI has better structured output but higher cost; Claude excels at long documents                   |
| **CopilotKit**   | Vercel AI SDK (useChat), custom WebSocket       | Vercel AI SDK is lighter but lacks built-in Generative UI widgets; CopilotKit provides HITL primitives |
| **Neon**         | Supabase, PlanetScale, Turso                    | Supabase adds auth/storage bundle; PlanetScale is MySQL; Turso (SQLite) is simpler but less powerful   |
| **Drizzle**      | Prisma, Kysely                                  | Prisma has better DX but heavier runtime; Kysely is type-safe SQL but less ecosystem                   |
| **unpdf**        | LlamaParse, Unstructured.io, Adobe PDF Services | LlamaParse handles complex layouts better; Unstructured.io extracts tables/images; both are paid       |
| **Tailwind CSS** | shadcn/ui (full), Radix + Stitches, Chakra UI   | shadcn/ui would provide more components; Chakra has runtime overhead                                   |
| **Next.js**      | Remix, SvelteKit, Astro                         | Remix has better data loading patterns; SvelteKit is lighter; Next.js has the largest ecosystem        |

---

## License

MIT
