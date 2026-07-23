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
│  │PdfUploader│  │PlanReviewWidget│  │MCQCardWidget│  │LessonSummary│ │
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
│  ┌─────────────┐   ┌────────┴────────┐   ┌──────────────────┐  │
│  │/api/upload-pdf│   │  /api/agent     │   │  /api/sessions   │  │
│  │(PDF parsing) │   │(LangGraph driver)│   │(CRUD persistence)│  │
│  └─────────────┘   └────────┬────────┘   └────────┬─────────┘  │
│                              │                      │            │
│                    ┌─────────┴──────────┐    ┌─────┴─────┐      │
│                    │  LangGraph Agent    │    │  Neon DB   │      │
│                    │  (State Machine)    │    │(PostgreSQL)│      │
│                    └────────────────────┘    └───────────┘      │
│                              │                                   │
│                    ┌─────────┴──────────┐                        │
│                    │  Gemini / Groq LLM  │                        │
│                    └────────────────────┘                        │
└──────────────────────────────────────────────────────────────────┘
```

### LangGraph State Machine

```
START → Planner → Approval ──(approved)──→ MCQ Generator → Evaluator
                    ↑                                         │
                    │ (revise)                                 │
                    └─────────────────────────────────────────┘
                                                              │
                    Evaluator ──(incorrect)──→ Evaluator (retry with hint)
                    Evaluator ──(correct)───→ Review
                    Review ──(more questions)──→ Evaluator
                    Review ──(next objective)──→ MCQ Generator
                    Review ──(all done)───→ Summary → END
                    Approval ──(rejected)──→ END
```

---

## Data Flow

1. **PDF Upload**: Client sends file to `/api/upload-pdf` → extracted text returned
2. **Start Agent**: Client sends `{ action: "start", pdfText }` to `/api/agent` → LangGraph graph invoked with `pdfText`, runs planner node, hits `interrupt()` at approval
3. **Plan Approval/Revision**: Client resumes with `{ approved, feedback, revise }` → approval node processes, either loops back (revise) or proceeds to MCQ generation
4. **MCQ Loop**: Generator produces questions → evaluator `interrupt()`s for each answer → client resumes with `{ selectedOptionId }` → evaluator scores → routing decides retry vs advance
5. **Review**: After correct answer, review node `interrupt()`s to show explanation → client continues → advances question/objective
6. **Summary**: When all objectives exhausted, summary node computes scores and generates study tips via LLM
7. **Persistence**: Hook fires side-effects to `/api/sessions` to create session on plan approval, record each attempt, and save final summary

---

## Tech Stack

| Layer       | Technology                       | Purpose                            |
| ----------- | -------------------------------- | ---------------------------------- |
| Framework   | Next.js 16 (App Router)          | Full-stack React with API routes   |
| AI Agent    | LangGraph (@langchain/langgraph) | State machine with HITL interrupts |
| LLM         | Google Gemini / Groq (LLaMA 3.3) | Structured output generation       |
| UI Runtime  | CopilotKit                       | Chat sidebar tutor + Generative UI |
| Database    | Neon (PostgreSQL)                | Session & attempt persistence      |
| ORM         | Drizzle ORM                      | Type-safe schema & queries         |
| Styling     | Tailwind CSS                     | Utility-first styling              |
| PDF Parsing | pdf-parse + unpdf                | Server-side text extraction        |
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
npm run db:push
```

This creates the `sessions` and `attempts` tables in your Neon database.

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
│   ├── agent/route.ts          # LangGraph driver — start/resume the graph
│   ├── copilotkit/route.ts     # CopilotKit runtime endpoint for sidebar tutor
│   ├── parse-pdf/route.ts      # PDF text extraction
│   ├── upload-pdf/route.ts     # PDF upload handler
│   └── sessions/route.ts       # Session CRUD (create, attempt, complete)
├── page.tsx                    # Main page orchestrating all widgets
├── providers.tsx               # CopilotKit context provider
└── layout.tsx                  # Root layout

components/
├── LessonTutor.tsx             # CopilotKit sidebar (answer-safe context)
├── PdfUploader.tsx             # Drag-and-drop PDF upload
├── PlanReviewWidget.tsx        # HITL plan approval with revise button
├── MCQCardWidget.tsx           # Interactive MCQ with progress & feedback
├── LessonSummary.tsx           # Final score report & study tips
├── SessionHistory.tsx          # Past session cards
└── ui/                         # Base UI components (Button, Card, Badge, Progress)

lib/
├── agent/
│   ├── graph.ts                # LangGraph state machine compilation
│   ├── nodes.ts                # All graph nodes (planner, approval, mcq, evaluator, review, summary)
│   ├── state.ts                # LangGraph state annotation & reducers
│   ├── schemas.ts              # Zod schemas for structured LLM output
│   ├── prompts.ts              # System prompts for each node
│   └── client-types.ts         # Client-safe type definitions
├── db/
│   ├── index.ts                # Neon/Drizzle connection
│   └── schema.ts               # Database table definitions
├── hooks/
│   └── useLearningAgent.ts     # Main client hook (state, actions, persistence)
├── pdf/parser.ts               # PDF text chunking utilities
└── utils.ts                    # Shared helpers (cn, twMerge)
```

---

## Design Decisions

### Why LangGraph over plain LangChain?

LangGraph provides a **stateful, interruptible state machine** — essential for HITL workflows. The `interrupt()` primitive lets us pause the graph at any node (plan approval, answer submission, review) and resume from the exact same point when the user responds. Plain LangChain chains don't support mid-execution pauses natively.

### Why MemorySaver instead of a persistent checkpointer?

For a single-user demo app, the in-process `MemorySaver` avoids external infrastructure for graph state. Each thread (lesson) lives in memory for the duration of the server process. For production, this should be swapped to a Redis or PostgreSQL checkpointer.

### Why deterministic question IDs (`obj{index}-q{n}`)?

The summary node groups questions by objective using ID prefixes. Relying on LLM-generated IDs caused the "0/0 performance" bug because IDs were unpredictable. Deterministic IDs guarantee reliable grouping.

### Why dual provider support (Gemini + Groq)?

Free-tier rate limits are common during development. Having a fallback provider means you can switch instantly when one hits limits, without code changes.

### Why CopilotKit for the tutor sidebar?

CopilotKit provides a pre-built chat UI with `useCopilotReadable` for exposing context to the LLM. The tutor can see lesson state but correctOptionId is redacted — preventing answer leaks while still enabling helpful hints.

### Why Neon (serverless PostgreSQL)?

Neon's HTTP driver works in serverless/edge environments without persistent connections. Free tier is sufficient for session history. The app gracefully degrades if DATABASE_URL is not set — sessions just don't persist.

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

- **Streaming responses**: Use LangGraph streaming instead of request/response for real-time UI updates during generation
- **Persistent checkpointer**: Replace MemorySaver with PostgreSQL or Redis checkpointer for multi-instance deployments
- **Authentication**: Add NextAuth or Clerk for multi-user support
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
| **pdf-parse**    | LlamaParse, Unstructured.io, Adobe PDF Services | LlamaParse handles complex layouts better; Unstructured.io extracts tables/images; both are paid       |
| **Tailwind CSS** | shadcn/ui (full), Radix + Stitches, Chakra UI   | shadcn/ui would provide more components; Chakra has runtime overhead                                   |
| **Next.js**      | Remix, SvelteKit, Astro                         | Remix has better data loading patterns; SvelteKit is lighter; Next.js has the largest ecosystem        |

---

## License

MIT
