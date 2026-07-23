const BASE = "http://localhost:3000";
const THREAD = "e2e-" + Date.now();

const PDF_TEXT = `Photosynthesis is the process by which green plants convert light energy into chemical energy. 
It occurs primarily in the chloroplasts of plant cells. The process involves two main stages: 
the light-dependent reactions and the Calvin cycle (light-independent reactions).

In the light-dependent reactions, water molecules are split using sunlight, producing oxygen, ATP, and NADPH.
These reactions occur in the thylakoid membranes of the chloroplast.

The Calvin cycle takes place in the stroma. It uses ATP and NADPH from the light reactions to fix 
carbon dioxide into glucose through a series of enzyme-catalyzed reactions. The key enzyme is RuBisCO,
which catalyzes the first step of carbon fixation.

Factors affecting photosynthesis include light intensity, carbon dioxide concentration, temperature,
and water availability. The rate of photosynthesis increases with light intensity up to a saturation point.`;

async function post(body) {
  const r = await fetch(`${BASE}/api/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}

async function main() {
  const out = [];

  // Step 1: Start the lesson
  out.push("=== STEP 1: Start lesson ===");
  const r1 = await post({
    action: "start",
    threadId: THREAD,
    pdfText: PDF_TEXT,
  });
  out.push(`Status: ${r1.status}`);
  if (r1.status !== 200) {
    out.push(`Error: ${JSON.stringify(r1.body)}`);
    finish(out);
    return;
  }
  out.push(`Plan title: ${r1.body.state?.lessonPlan?.title}`);
  out.push(`Difficulty: ${r1.body.state?.lessonPlan?.difficulty}`);
  out.push(`Objectives: ${r1.body.state?.lessonPlan?.objectives?.length}`);
  r1.body.state?.lessonPlan?.objectives?.forEach((o, i) =>
    out.push(`  ${i + 1}. ${o.title}`),
  );
  out.push(`Interrupt type: ${r1.body.interrupt?.value?.type}`);
  out.push("");

  if (r1.body.interrupt?.value?.type !== "plan-approval") {
    out.push("ERROR: Expected plan-approval interrupt");
    finish(out);
    return;
  }

  // Step 2: Approve the plan
  out.push("=== STEP 2: Approve plan ===");
  const r2 = await post({
    action: "resume",
    threadId: THREAD,
    resume: { approved: true },
  });
  out.push(`Status: ${r2.status}`);
  if (r2.status !== 200) {
    out.push(`Error: ${JSON.stringify(r2.body)}`);
    finish(out);
    return;
  }
  out.push(`isPlanApproved: ${r2.body.state?.isPlanApproved}`);
  out.push(`Questions generated: ${r2.body.state?.questions?.length}`);
  out.push(`Interrupt type: ${r2.body.interrupt?.value?.type}`);
  const q = r2.body.state?.questions?.[0];
  if (q) {
    out.push(`Q1: ${q.question}`);
    q.choices?.forEach((c) => out.push(`  [${c.id}] ${c.text}`));
    out.push(`  Correct: ${q.correctOptionId}`);
  }
  out.push("");

  if (!q) {
    out.push("ERROR: No questions generated");
    finish(out);
    return;
  }

  // Step 3: Submit a wrong answer
  out.push("=== STEP 3: Wrong answer ===");
  const wrongId = q.choices.find((c) => c.id !== q.correctOptionId)?.id;
  const r3 = await post({
    action: "resume",
    threadId: THREAD,
    resume: { selectedOptionId: wrongId },
  });
  out.push(`Status: ${r3.status}`);
  out.push(`Feedback correct: ${r3.body.state?.feedback?.isCorrect}`);
  out.push(`Hint: ${r3.body.state?.feedback?.hint}`);
  out.push(
    `Interrupt type: ${r3.body.interrupt?.value?.type} (should be answer-question for retry)`,
  );
  out.push("");

  // Step 4: Submit the correct answer
  out.push("=== STEP 4: Correct answer ===");
  const r4 = await post({
    action: "resume",
    threadId: THREAD,
    resume: { selectedOptionId: q.correctOptionId },
  });
  out.push(`Status: ${r4.status}`);
  out.push(`Feedback correct: ${r4.body.state?.feedback?.isCorrect}`);
  out.push(`Explanation: ${r4.body.state?.feedback?.explanation}`);
  out.push(
    `Interrupt type: ${r4.body.interrupt?.value?.type} (should be review-feedback)`,
  );
  out.push("");

  // Step 5: Continue past review
  out.push("=== STEP 5: Continue ===");
  const r5 = await post({
    action: "resume",
    threadId: THREAD,
    resume: { continue: true },
  });
  out.push(`Status: ${r5.status}`);
  out.push(`currentQuestionIndex: ${r5.body.state?.currentQuestionIndex}`);
  out.push(`isCompleted: ${r5.body.state?.isCompleted}`);
  out.push(`Interrupt type: ${r5.body.interrupt?.value?.type}`);
  out.push("");

  out.push("=== END-TO-END TEST COMPLETE ===");
  finish(out);
}

function finish(out) {
  const text = out.join("\n");
  console.log(text);
  require("fs").writeFileSync("_e2e_results.txt", text);
}

main().catch((e) => {
  const msg = "FATAL: " + (e.stack || e);
  console.error(msg);
  require("fs").writeFileSync("_e2e_results.txt", msg);
});
