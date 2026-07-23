export const ROUTES = {
  api: {
    session: "/api/sessions",
    agent: "/api/agent",
    evaluate: "/api/evaluate",
    uploadPdf: "/api/upload-pdf",
  },
};
export const PHASE = {
  idle: "idle",
  planning: "planning",
  awaitingApproval: "awaiting-approval",
  quizzing: "quizzing",
  completed: "completed",
};
