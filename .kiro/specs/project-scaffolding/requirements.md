# Requirements Document

## Introduction

This feature establishes the foundational scaffolding for the Memorang AI Learning Agent. It initializes a Next.js App Router project configured with TypeScript and TailwindCSS, wires up the CopilotKit runtime endpoint at `/api/copilotkit`, and provides a reusable PDF parsing utility with a supporting ingestion endpoint at `/api/parse-pdf`. This scaffolding is the base layer that all subsequent learning-agent features (planning, HITL approval, MCQ generation, feedback, and summary) will build upon. The scope is limited to project initialization, configuration, endpoint wiring, and the PDF parsing utility; it does not include the LangGraph agent logic or generative UI widgets.

## Glossary

- **Project**: The Next.js App Router application for the Memorang AI Learning Agent.
- **Build_System**: The Next.js toolchain responsible for compiling, bundling, and type-checking the Project.
- **TypeScript_Config**: The `tsconfig.json` configuration that governs TypeScript compilation and type checking.
- **Tailwind_System**: The TailwindCSS configuration (`tailwind.config.ts`) and directives (`app/globals.css`) that provide utility-first styling.
- **CopilotKit_Endpoint**: The CopilotKit runtime route handler located at `app/api/copilotkit/route.ts`.
- **CopilotKit_Provider**: The CopilotKit React context provider wrapping the application in `app/layout.tsx`.
- **PDF_Parser**: The PDF parsing utility located at `lib/pdf/parser.ts` that extracts and chunks text from PDF documents.
- **PDF_Endpoint**: The PDF ingestion route handler located at `app/api/parse-pdf/route.ts`.
- **Environment_Template**: The `.env.example` file documenting required environment variables.
- **Developer**: A software engineer setting up or building upon the Project.

## Requirements

### Requirement 1: Initialize Next.js App Router Project with TypeScript

**User Story:** As a Developer, I want a Next.js App Router project configured with TypeScript, so that I have a type-safe foundation to build the learning agent features.

#### Acceptance Criteria

1. THE Project SHALL use the Next.js App Router structure with a top-level `app/` directory that contains both a `layout.tsx` file and a `page.tsx` file.
2. THE Project SHALL include a `package.json` file at the repository root declaring `next`, `react`, `react-dom`, and `typescript` as dependencies, each with an explicitly pinned version (no unresolved or empty version fields).
3. THE TypeScript_Config SHALL enable strict type checking by setting the `strict` compiler option to `true` in `tsconfig.json`.
4. WHEN the Developer runs the type-check command, THE Build_System SHALL report exactly zero type errors and exit with a success status code (0) for all scaffolded files.
5. IF the type-check command reports one or more type errors, THEN THE Build_System SHALL exit with a non-zero status code and output a message identifying each offending file and line.
6. WHEN the Developer runs the production build command, THE Build_System SHALL complete with a success status code (0) and produce build output artifacts without emitting any error-level messages.
7. IF the production build command encounters a compilation or configuration error, THEN THE Build_System SHALL terminate with a non-zero status code and output a message indicating the cause, without producing partial or corrupted build artifacts.
8. THE Project SHALL include a `next.config.js` file and a `tsconfig.json` file located at the repository root.

### Requirement 2: Configure TailwindCSS Styling

**User Story:** As a Developer, I want TailwindCSS configured, so that I can style components with utility classes consistently across the application.

#### Acceptance Criteria

1. THE Project SHALL include a `tailwind.config.ts` file whose content paths include every file matching the `app/` and `components/` directories and their subdirectories, so that utility classes used in any file under those directories are detected during the build.
2. THE Tailwind_System SHALL define the TailwindCSS base, components, and utilities directives in `app/globals.css`.
3. THE Project SHALL import `app/globals.css` exactly once within `app/layout.tsx` such that the imported styles apply to every route rendered by the application.
4. WHEN the Developer applies a TailwindCSS utility class that is covered by the configured content paths to an element, THE Build_System SHALL include the corresponding CSS rules in the generated build output.
5. IF a TailwindCSS utility class is applied to an element in a file not covered by the configured content paths, THEN THE Build_System SHALL omit the corresponding CSS rules from the generated build output.
6. IF the Tailwind_System configuration cannot be parsed or the build fails, THEN THE Build_System SHALL report an error message identifying the failing configuration or file, retain the existing source files unchanged, and terminate with a non-zero exit status.
7. THE Project SHALL include a shared utility function in `lib/utils.ts` that accepts a variadic list of class name values and returns a single merged class name string in which conflicting TailwindCSS utility classes are resolved to the last-specified value.

### Requirement 3: Provide CopilotKit Runtime Endpoint

**User Story:** As a Developer, I want a CopilotKit runtime endpoint, so that the frontend can communicate with the agent runtime through a defined API route.

#### Acceptance Criteria

1. THE CopilotKit_Endpoint SHALL be located at `app/api/copilotkit/route.ts`.
2. THE CopilotKit_Endpoint SHALL export a POST handler that returns an HTTP response.
3. WHEN a POST request is sent to `/api/copilotkit` and all required environment variables are present, THE CopilotKit_Endpoint SHALL respond with an HTTP status code in the 200-299 success range.
4. WHEN a POST request is sent to `/api/copilotkit`, THE CopilotKit_Endpoint SHALL return a response or begin streaming within 30 seconds.
5. THE CopilotKit_Provider SHALL wrap the application content in `app/layout.tsx` and reference the `/api/copilotkit` runtime URL.
6. WHILE one or more required CopilotKit environment variables are missing or empty at startup, THE CopilotKit_Endpoint SHALL reject all requests with a 5xx status and an error response body that names each missing variable, without performing partial processing.
7. THE Environment_Template SHALL document every environment variable required by the CopilotKit_Endpoint by listing each one by name.

### Requirement 4: Provide PDF Parsing Utility

**User Story:** As a Developer, I want a PDF parsing utility, so that PDF documents can be converted into extractable, chunked text for the learning agent.

#### Acceptance Criteria

1. THE PDF_Parser SHALL be located at `lib/pdf/parser.ts`.
2. WHEN a valid PDF document is provided to the PDF_Parser, THE PDF_Parser SHALL return the extracted text content as a single string that preserves the original character order.
3. WHEN a valid PDF document containing no extractable text is provided to the PDF_Parser, THE PDF_Parser SHALL return an empty string.
4. WHEN extracted text and a chunk size (a positive integer between 1 and 100000 characters inclusive) are provided to the PDF_Parser, THE PDF_Parser SHALL divide the text into an ordered collection of contiguous, non-empty chunks that each do not exceed the specified chunk size.
5. IF an invalid or corrupt PDF document is provided to the PDF_Parser, THEN THE PDF_Parser SHALL return an error indicating parse failure, and SHALL NOT return partial text content.
6. IF a chunk size outside the range of 1 to 100000 characters inclusive is provided to the PDF_Parser chunking function, THEN THE PDF_Parser SHALL return an error indicating an invalid chunk size, and SHALL NOT return any chunks.
7. FOR ALL non-empty extracted text and any valid chunk size, concatenating the chunks produced by the PDF_Parser in their returned order SHALL reproduce the original extracted text content exactly, inserting or removing no characters (round-trip property).
8. WHEN empty input text is provided to the PDF_Parser chunking function, THE PDF_Parser SHALL return an empty collection of chunks.

### Requirement 5: Provide PDF Ingestion Endpoint

**User Story:** As a Developer, I want a PDF ingestion endpoint, so that uploaded PDF files can be parsed server-side and returned as structured text.

#### Acceptance Criteria

1. THE PDF_Endpoint SHALL be located at `app/api/parse-pdf/route.ts`.
2. THE PDF_Endpoint SHALL export a POST handler that accepts a single uploaded PDF file with a maximum accepted file size of 10 MB.
3. WHEN a file is uploaded to `/api/parse-pdf`, THE PDF_Endpoint SHALL validate, before any parsing occurs, that the file is present, that its size is greater than 0 bytes and does not exceed 10 MB, and that its declared content type is `application/pdf`.
4. WHEN the uploaded file is confirmed to be a valid PDF, THE PDF_Endpoint SHALL invoke the PDF_Parser and respond within 30 seconds with the extracted text content and an HTTP 200 status.
5. IF a request to `/api/parse-pdf` contains no file, THEN THE PDF_Endpoint SHALL respond with an HTTP 400 status and an error message indicating that no file was provided, without invoking the PDF_Parser.
6. IF the uploaded file fails PDF format validation, exceeds 10 MB, or is 0 bytes, THEN THE PDF_Endpoint SHALL respond with an HTTP 422 status and an error message indicating the specific validation failure, without invoking the PDF_Parser.
7. IF the PDF_Parser fails to process a validated PDF file, THEN THE PDF_Endpoint SHALL respond with an HTTP 500 status and an error message indicating that parsing failed, and SHALL NOT return partial text content.
8. IF the PDF_Parser completes but extracts no text content from a validated PDF file, THEN THE PDF_Endpoint SHALL respond with an HTTP 422 status and an error message indicating that no extractable text was found.

### Requirement 6: Document Environment Configuration

**User Story:** As a Developer, I want an environment variable template, so that I know which configuration values are required to run the Project locally.

#### Acceptance Criteria

1. THE Project SHALL include an `.env.example` file at the repository root.
2. THE Environment_Template SHALL list every environment variable required by the CopilotKit_Endpoint, where each variable is expressed as a `NAME=value` pair on its own line and no required variable is omitted.
3. THE Environment_Template SHALL assign each listed variable a non-empty placeholder value that is a descriptive token (for example, a bracketed or angle-bracketed label) rather than a real credential.
4. THE Environment_Template SHALL exclude real secret values, such that no listed value matches a valid, usable credential for any external service.
5. THE Environment_Template SHALL include, for each listed variable, a preceding comment line describing the variable's purpose and whether it is required or optional.
