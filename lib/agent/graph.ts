import { END, MemorySaver, START, StateGraph } from "@langchain/langgraph";

import { AgentStateAnnotation, type AgentState } from "./state";
import {
  approvalNode,
  evaluatorNode,
  mcqGeneratorNode,
  plannerNode,
  reviewNode,
  summaryNode,
} from "./nodes";

/**
 * Assemble and compile the Memorang AI Learning Agent LangGraph workflow.
 *
 * Flow:
 *   START -> planner -> approval
 *     approval --(approved)--> mcqGenerator
 *     approval --(rejected)--> END
 *   mcqGenerator -> evaluator
 *     evaluator --(more questions / objectives)--> evaluator | mcqGenerator
 *     evaluator --(completed)--> END
 *
 * A `MemorySaver` checkpointer persists state between `interrupt()` pauses so
 * the HITL approval and per-question answer submissions can resume the graph.
 */

const PLANNER = "planner";
const APPROVAL = "approval";
const MCQ_GENERATOR = "mcqGenerator";
const EVALUATOR = "evaluator";
const REVIEW = "review";
const SUMMARY = "summarize";

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

/**
 * Route out of the evaluator node based on the latest answer feedback:
 * - incorrect -> back to the evaluator so the learner can retry with the hint.
 * - correct -> the review node, which shows the explanation before advancing.
 */
function routeAfterEvaluator(
  state: AgentState,
): typeof EVALUATOR | typeof REVIEW {
  return state.feedback?.isCorrect ? REVIEW : EVALUATOR;
}

/**
 * Route out of the review node (after the learner continues past a correct
 * answer):
 * - lesson complete -> summary
 * - current objective still has generated questions -> evaluator
 * - objective advanced (questions cleared) -> regenerate via mcqGenerator
 */
function routeAfterReview(
  state: AgentState,
): typeof EVALUATOR | typeof MCQ_GENERATOR | typeof SUMMARY {
  if (state.isCompleted) {
    return SUMMARY;
  }
  const hasPendingQuestion =
    state.questions.length > 0 &&
    state.currentQuestionIndex < state.questions.length;
  return hasPendingQuestion ? EVALUATOR : MCQ_GENERATOR;
}

function buildGraph() {
  const workflow = new StateGraph(AgentStateAnnotation)
    .addNode(PLANNER, plannerNode)
    .addNode(APPROVAL, approvalNode)
    .addNode(MCQ_GENERATOR, mcqGeneratorNode)
    .addNode(EVALUATOR, evaluatorNode)
    .addNode(REVIEW, reviewNode)
    .addNode(SUMMARY, summaryNode)
    .addEdge(START, PLANNER)
    .addEdge(PLANNER, APPROVAL)
    .addConditionalEdges(APPROVAL, routeAfterApproval, {
      [MCQ_GENERATOR]: MCQ_GENERATOR,
      [APPROVAL]: APPROVAL,
      [END]: END,
    })
    .addEdge(MCQ_GENERATOR, EVALUATOR)
    .addConditionalEdges(EVALUATOR, routeAfterEvaluator, {
      [EVALUATOR]: EVALUATOR,
      [REVIEW]: REVIEW,
    })
    .addConditionalEdges(REVIEW, routeAfterReview, {
      [EVALUATOR]: EVALUATOR,
      [MCQ_GENERATOR]: MCQ_GENERATOR,
      [SUMMARY]: SUMMARY,
    })
    .addEdge(SUMMARY, END);

  return workflow;
}

/** In-process checkpointer persisting state across HITL interrupts. */
export const checkpointer = new MemorySaver();

/**
 * The compiled Memorang learning agent graph, ready to be invoked or bound to
 * the CopilotKit runtime.
 */
export const agentGraph = buildGraph().compile({ checkpointer });

/** The graph's registered name, referenced by the CopilotKit runtime binding. */
export const AGENT_NAME = "memorang_learning_agent";
