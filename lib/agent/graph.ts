import { END, MemorySaver, START, StateGraph } from "@langchain/langgraph";

import { AgentStateAnnotation, type AgentState } from "./state";
import { approvalNode, mcqGeneratorNode, plannerNode } from "./nodes";

/**
 * Simplified Memorang AI Learning Agent LangGraph workflow.
 *
 * The graph is responsible ONLY for LLM-dependent operations:
 *   START -> planner -> approval
 *     approval --(approved)--> mcqGenerator -> END
 *     approval --(revise)----> approval (loop for revision)
 *     approval --(rejected)--> END
 *
 * Answer evaluation, attempt tracking, objective advancement, and summary
 * computation are handled client-side (no LLM needed for those).
 *
 * A `MemorySaver` checkpointer persists state between `interrupt()` pauses so
 * the HITL approval can resume the graph.
 */

const PLANNER = "planner";
const APPROVAL = "approval";
const MCQ_GENERATOR = "mcqGenerator";

/** Route out of the approval node based on the HITL decision. */
function routeAfterApproval(
  state: AgentState,
): typeof MCQ_GENERATOR | typeof APPROVAL | typeof END {
  if (state.isPlanApproved) return MCQ_GENERATOR;
  // Revised plan (not approved but plan exists) → loop back for review.
  if (state.lessonPlan) return APPROVAL;
  // Rejected (plan cleared) → end.
  return END;
}

function buildGraph() {
  const workflow = new StateGraph(AgentStateAnnotation)
    .addNode(PLANNER, plannerNode)
    .addNode(APPROVAL, approvalNode)
    .addNode(MCQ_GENERATOR, mcqGeneratorNode)
    .addEdge(START, PLANNER)
    .addEdge(PLANNER, APPROVAL)
    .addConditionalEdges(APPROVAL, routeAfterApproval, {
      [MCQ_GENERATOR]: MCQ_GENERATOR,
      [APPROVAL]: APPROVAL,
      [END]: END,
    })
    .addEdge(MCQ_GENERATOR, END);

  return workflow;
}

/** In-process checkpointer persisting state across HITL interrupts. */
export const checkpointer = new MemorySaver();

/**
 * The compiled Memorang learning agent graph, ready to be invoked.
 * After approval it generates MCQs for the first objective and returns.
 * Subsequent objectives' MCQs are generated via a standalone call.
 */
export const agentGraph = buildGraph().compile({ checkpointer });

/** The graph's registered name, referenced by the CopilotKit runtime binding. */
export const AGENT_NAME = "memorang_learning_agent";
