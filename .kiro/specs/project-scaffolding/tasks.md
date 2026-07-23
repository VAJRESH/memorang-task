# Implementation Plan: Project Scaffolding

## Overview

This plan scaffolds the Memorang AI Learning Agent foundation in TypeScript on Next.js App Router. It builds bottom-up: first the project configuration and toolchain gates, then the pure core logic (`cn`, `chunkText`, `extractText`, env validation) that the correctness properties target, then the API route handlers that wire the core logic into Next.js, and finally the UI provider wiring and environment template. Each step produces buildable, type-checked code and integrates into the previous steps so nothing is left orphaned.

## Tasks

- [x] 1. Initialize project configuration and toolchain
  - [x] 1.1 Create `package.json` with pinned dependency versions
    - Add exact pinned versions (no `^`, `~`, `*`, or empty fields) for `next`, `react`, `react-dom`, `typescript`, `@copilotkit/runtime`, `@copilotkit/react-core`, `@copilotkit/react-ui`, `unpdf`, `clsx`, `tailwind-merge`, `tailwindcss`
    - Add dev tooling (test runner, e.g. Vitest or Jest, plus `fast-check`) and `dev`/`build`/`typecheck`/`test` scripts
    - _Requirements: 1.2_

  - [x] 1.2 Create `tsconfig.json` and `next.config.js` at repository root
    - Set `"strict": true` and standard Next.js compiler options in `tsconfig.json`
    - Create `next.config.js`, marking `unpdf` as a server-external package so it is not client-bundled
    - _Requirements: 1.3, 1.8_

  - [x] 1.3 Create TailwindCSS configuration and global stylesheet
    - Create `tailwind.config.ts` whose content globs cover `./app/**/*.{ts,tsx}` and `./components/**/*.{ts,tsx}`
    - Create `app/globals.css` with the Tailwind `base`, `components`, and `utilities` directives
    - _Requirements: 2.1, 2.2_

- [ ] 2. Implement shared class-name merge utility
  - [x] 2.1 Implement `cn` in `lib/utils.ts`
    - Write `cn(...inputs: ClassValue[])` composing `clsx` and `tailwind-merge` so conflicting utilities resolve to the last value
    - _Requirements: 2.7_

  - [ ] 2.2 Write property test for the class-name merger
    - **Property 1: Class merge resolves conflicts to the last value**
    - Generate random class lists including known conflicting Tailwind utilities (e.g. paired `px-*`, `text-*`); assert single-string output and last-wins resolution
    - Tag test with `Feature: project-scaffolding, Property 1`; run minimum 100 cases
    - **Validates: Requirements 2.7**

  - [ ] 2.3 Write example unit tests for well-known `cn` conflicts
    - Assert cases like `cn("px-2", "px-4") === "px-4"`
    - _Requirements: 2.7_

- [ ] 3. Implement PDF parser core logic
  - [x] 3.1 Implement `chunkText` and error types in `lib/pdf/parser.ts`
    - Define `PdfParseError`, `InvalidChunkSizeError`, `MIN_CHUNK_SIZE`, `MAX_CHUNK_SIZE`
    - Implement `chunkText(text, chunkSize)`: reject out-of-range/non-integer sizes, return `[]` for empty text, otherwise slice contiguous non-empty chunks `<= chunkSize`
    - _Requirements: 4.1, 4.4, 4.6, 4.8_

  - [ ] 3.2 Write property test for chunk well-formedness and losslessness
    - **Property 3: Chunking is well-formed and lossless**
    - Generate arbitrary strings (including empty and non-ASCII) and valid chunk sizes; assert round-trip join equality, per-chunk size/non-empty bounds, and empty-input → empty-output
    - Tag test with `Feature: project-scaffolding, Property 3`; run minimum 100 cases
    - **Validates: Requirements 4.4, 4.7, 4.8**

  - [ ] 3.3 Write property test for invalid chunk-size rejection
    - **Property 4: Invalid chunk sizes are rejected**
    - Generate integers outside `[1, 100000]` and non-integers; assert `InvalidChunkSizeError` and no chunks returned
    - Tag test with `Feature: project-scaffolding, Property 4`; run minimum 100 cases
    - **Validates: Requirements 4.6**

  - [ ] 3.4 Implement `extractText` in `lib/pdf/parser.ts`
    - Use `unpdf` to extract text from a `Uint8Array | ArrayBuffer`, preserving character order
    - Return `""` for a valid PDF with no text; reject with `PdfParseError` (no partial text) for corrupt input
    - _Requirements: 4.2, 4.3, 4.5_

  - [ ] 3.5 Write property test for corrupt-input parse failure
    - **Property 5: Corrupt input never yields partial text**
    - Generate random non-PDF byte buffers; assert `PdfParseError` and no returned text
    - Tag test with `Feature: project-scaffolding, Property 5`; run minimum 100 cases
    - **Validates: Requirements 4.5**

  - [ ] 3.6 Write example unit tests for `extractText` happy paths
    - Use fixture PDFs (text-bearing → exact ordered text; text-free → empty string)
    - _Requirements: 4.2, 4.3_

- [ ] 4. Checkpoint - Ensure all core-logic tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement CopilotKit runtime endpoint
  - [x] 5.1 Implement env validation and POST handler in `app/api/copilotkit/route.ts`
    - Define `REQUIRED_COPILOT_ENV_VARS` and pure `findMissingEnvVars(env, required)`
    - Implement `POST` that returns 503 with `{ error, missing }` when vars are missing/empty (no partial processing), otherwise delegates to `buildCopilotEndpoint()` using `copilotRuntimeNextJSAppRouterEndpoint`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6_

  - [ ] 5.2 Write property test for missing-env detection
    - **Property 2: Missing-env detection is exact**
    - Generate random env maps assigning each required var one of {present-non-empty, absent, empty, whitespace}; assert returned set equals the absent-or-empty subset
    - Tag test with `Feature: project-scaffolding, Property 2`; run minimum 100 cases
    - **Validates: Requirements 3.6**

  - [ ] 5.3 Write integration/unit tests for CopilotKit handler behavior
    - `POST` exported as a function returning a `Response`; env set + mocked runtime → 2xx within timeout
    - _Requirements: 3.2, 3.3, 3.4_

- [ ] 6. Implement PDF ingestion endpoint
  - [x] 6.1 Implement POST handler in `app/api/parse-pdf/route.ts`
    - Read multipart `file`; enforce validation order: absent → 400; then 0 bytes / >10 MB / not `application/pdf` → 422 (parser not invoked)
    - On validated file call `extractText`: text → 200 `{ text }`; empty string → 422 "no extractable text"; thrown error → 500 "parsing failed" (no partial text)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [ ] 6.2 Write property test for the validation guard and status mapping
    - **Property 6: Validation guards the parser and maps status codes**
    - Generate file descriptors varying presence/size/content-type with a spy parser; assert parser invoked iff valid, absent → 400, invalid size/type → 422, parser not invoked in failing cases
    - Tag test with `Feature: project-scaffolding, Property 6`; run minimum 100 cases
    - **Validates: Requirements 5.3, 5.5, 5.6**

  - [ ] 6.3 Write example unit tests for parse-pdf status scenarios
    - Mocked parser: returns text → 200; throws → 500; returns `""` → 422
    - _Requirements: 5.4, 5.7, 5.8_

- [ ] 7. Wire UI provider and environment template
  - [ ] 7.1 Create `app/layout.tsx` and `app/page.tsx`
    - Import `./globals.css` exactly once in `layout.tsx`; wrap `children` in `<CopilotKit runtimeUrl="/api/copilotkit">`
    - Add a minimal `page.tsx` main canvas using `cn` from `lib/utils.ts`
    - _Requirements: 1.1, 2.3, 3.5_

  - [ ] 7.2 Create `.env.example` at repository root
    - List every variable in `REQUIRED_COPILOT_ENV_VARS` as `NAME=value` lines with descriptive angle-bracket placeholders (no real secrets) and a preceding purpose + required/optional comment
    - _Requirements: 3.7, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ] 7.3 Write smoke/config tests for file presence and consistency
    - Assert scaffolded files exist; `package.json` versions pinned; `tsconfig` strict; tailwind globs cover `app/`+`components/`; `globals.css` directives imported once in `layout.tsx`; every required env var appears in `.env.example` with placeholder + comment
    - _Requirements: 1.1, 1.2, 1.3, 1.8, 2.1, 2.2, 2.3, 3.1, 3.7, 4.1, 5.1, 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 8. Final checkpoint - Verify build and toolchain gates
  - [ ] 8.1 Verify type-check and production build succeed
    - Ensure `tsc --noEmit` exits 0 and `next build` exits 0 producing `.next` artifacts with no error-level messages
    - _Requirements: 1.4, 1.6_

  - [ ] 8.2 Write integration tests for TailwindCSS emission/omission
    - Build and inspect generated CSS: a covered-path class is present; an uncovered-path class is absent
    - _Requirements: 2.4, 2.5_

  - [ ] 8.3 Checkpoint - Ensure all tests pass
    - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests (Properties 1-6) use `fast-check` with a minimum of 100 generated cases and are tagged with their design property
- Unit, integration, and smoke/config tests cover configuration, external-tool behavior, and example scenarios that are not property-tested

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "3.1", "5.1", "6.1"] },
    {
      "id": 2,
      "tasks": [
        "2.2",
        "2.3",
        "3.2",
        "3.3",
        "3.4",
        "5.2",
        "5.3",
        "6.2",
        "6.3",
        "7.1",
        "7.2"
      ]
    },
    { "id": 3, "tasks": ["3.5", "3.6", "7.3", "8.1"] },
    { "id": 4, "tasks": ["8.2"] }
  ]
}
```
