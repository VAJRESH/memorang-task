import { describe, expect, it, vi } from "vitest";
import fc from "fast-check";

// `./route` imports `@copilotkit/runtime` at module top-level. Mock the heavy
// runtime so the pure `findMissingEnvVars` function can be imported reliably in
// the test environment without pulling in the full runtime machinery.
vi.mock("@copilotkit/runtime", () => ({
  CopilotRuntime: class {},
  GoogleGenerativeAIAdapter: class {
    constructor(_opts: unknown) {}
  },
  copilotRuntimeNextJSAppRouterEndpoint: () => ({
    handleRequest: async () => new Response(),
  }),
}));

// The route imports the compiled LangGraph agent; mock it so the pure
// env-detection function can be imported without constructing the graph.
vi.mock("@/lib/agent/graph", () => ({
  AGENT_NAME: "memorang_learning_agent",
  agentGraph: { invoke: async () => ({}) },
}));

import { findMissingEnvVars, REQUIRED_COPILOT_ENV_VARS } from "./route";

/**
 * Feature: project-scaffolding, Property 2
 *
 * Property 2: Missing-env detection is exact.
 * For any environment map over the required var set, `findMissingEnvVars`
 * returns exactly the subset whose value is undefined, empty, or
 * whitespace-only — no present-and-non-empty var is reported, and no
 * absent-or-empty var is omitted.
 *
 * **Validates: Requirements 3.6**
 */
describe("findMissingEnvVars - Property 2: Missing-env detection is exact", () => {
  // A representative set of required variable names to exercise multi-var
  // behavior. Includes the real required vars plus extra synthetic names.
  const REQUIRED = [
    ...REQUIRED_COPILOT_ENV_VARS,
    "SECOND_REQUIRED_VAR",
    "THIRD_REQUIRED_VAR",
    "FOURTH_REQUIRED_VAR",
  ] as const;

  // The four states a variable's value can take.
  type VarState = "present" | "absent" | "empty" | "whitespace";

  const stateArb: fc.Arbitrary<VarState> = fc.constantFrom(
    "present",
    "absent",
    "empty",
    "whitespace",
  );

  // Non-empty, non-whitespace value for the "present" state.
  const presentValueArb = fc.string().filter((s) => s.trim().length > 0);

  // Whitespace-only value (at least one whitespace character).
  const whitespaceValueArb = fc
    .array(fc.constantFrom(" ", "\t", "\n", "\r", "\f", "\v"), {
      minLength: 1,
      maxLength: 5,
    })
    .map((chars) => chars.join(""));

  it("returns exactly the absent/empty/whitespace subset", () => {
    fc.assert(
      fc.property(
        // For each required var, pick a state and (if present) a value.
        fc.record(
          Object.fromEntries(
            REQUIRED.map((name) => [
              name,
              fc.record({
                state: stateArb,
                presentValue: presentValueArb,
                whitespaceValue: whitespaceValueArb,
              }),
            ]),
          ) as Record<
            string,
            fc.Arbitrary<{
              state: VarState;
              presentValue: string;
              whitespaceValue: string;
            }>
          >,
        ),
        (spec) => {
          const env = {} as NodeJS.ProcessEnv;
          const expectedMissing: string[] = [];

          for (const name of REQUIRED) {
            const { state, presentValue, whitespaceValue } = spec[name];
            switch (state) {
              case "present":
                env[name] = presentValue;
                break;
              case "absent":
                // Leave the key unset -> undefined.
                expectedMissing.push(name);
                break;
              case "empty":
                env[name] = "";
                expectedMissing.push(name);
                break;
              case "whitespace":
                env[name] = whitespaceValue;
                expectedMissing.push(name);
                break;
            }
          }

          const result = findMissingEnvVars(env, REQUIRED);

          // Order-insensitive deep equality between result and expected set.
          expect([...result].sort()).toEqual([...expectedMissing].sort());
        },
      ),
      { numRuns: 100 },
    );
  });
});
