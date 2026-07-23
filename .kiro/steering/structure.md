# Directory & File Structure

This document outlines the project architecture for the **Memorang AI Learning Agent**.

.
├── .kiro/ # Kiro Steering & Spec-Driven Development Artifacts
│ ├── product.md # PRD, Acceptance Criteria & User Flows
│ ├── tech.md # Tech Stack, Libraries & Environment Variables
│ └── structure.md # Folder & File Mapping Guide
│
├── app/ # Next.js App Router (UI & API Routes)
│ ├── api/
│ │ ├── copilotkit/
│ │ │ └── route.ts # CopilotKit Runtime Endpoint & Agent Adapter
│ │ └── parse-pdf/
│ │ └── route.ts # PDF Ingestion & Text Extraction Endpoint
│ │
│ ├── favicon.ico
│ ├── globals.css # TailwindCSS Directives & Theme Setup
│ ├── layout.tsx # Root Layout wrapping CopilotKit Context Provider
│ └── page.tsx # Main Canvas (PDF Upload + Chat Sidebar + Widget View)
│
├── components/ # React UI Components
│ ├── ui/ # Base UI Elements (Buttons, Cards, Inputs, Badges)
│ │ ├── button.tsx
│ │ ├── card.tsx
│ │ └── progress.tsx
│ │
│ ├── upload/ # Ingestion & Parsing Components
│ │ └── PdfUploader.tsx # Drag-and-Drop PDF Upload Handler
│ │
│ └── widgets/ # CopilotKit Generative UI Custom Widgets
│ ├── PlanReviewWidget.tsx # HITL Lesson Plan Approval Component
│ ├── MCQCardWidget.tsx # Interactive MCQ Renderer (Hints/Explains/Retries)
│ └── LessonSummary.tsx # Final Performance & Study Tips Report Component
│
├── lib/ # Core Business Logic & AI Engines
│ ├── agent/ # LangGraph Agent Engine
│ │ ├── graph.ts # State Machine (Planner -> HITL -> QuizGen -> Summary)
│ │ ├── nodes.ts # LangGraph State Nodes
│ │ ├── prompts.ts # System Prompts for Planning, MCQs, & Hints
│ │ ├── state.ts # LangGraph Annotation & State Type Definitions
│ │ └── schemas.ts # Zod Validation Schemas (Plan, MCQ, Summary)
│ │
│ ├── pdf/ # Parsing & Document Utilities
│ │ └── parser.ts # Text Chunking & Extraction Utilities
│ │
│ └── utils.ts # Shared Helper Functions (clsx, twMerge)
│
├── public/ # Static Assets (Logos, Icons, Sample PDFs)
│ └── sample-lesson.pdf
│
├── .env.example # Environment Variable Template (API Keys)
├── next.config.js # Next.js Configuration
├── package.json # Project Dependencies
├── tailwind.config.ts # Tailwind Styling Extensions
└── tsconfig.json # TypeScript Configuration Rules

---

### Core Module Breakdown

- **`/app/api/copilotkit/route.ts`**: Binds the LangGraph agent state machine to CopilotKit, enabling real-time streaming and custom widget execution.
- **`/components/widgets/`**: Contains the custom Generative UI components rendered directly inside the chat and canvas streams.
- **`/lib/agent/`**: Encapsulates all LangGraph logic, Zod structured outputs, and Human-in-the-Loop (`interrupt()`) state handlers.
- **`/lib/pdf/parser.ts`**: Handles client/server-side PDF parsing and text chunking.
