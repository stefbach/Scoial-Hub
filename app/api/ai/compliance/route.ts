export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { env, isAiConfigured } from "@/lib/env";
import { requireUser } from "@/lib/auth/guard";

type Platform = "facebook" | "instagram" | "linkedin";
type Verdict = "pass" | "warn" | "block";

interface RequestBody {
  text: string;
  platform: Platform;
}

interface ComplianceResult {
  verdict: Verdict;
  issues: string[];
  suggestion?: string;
  mock?: boolean;
}

const COMPLIANCE_SYSTEM_PROMPT = `
You are a specialist compliance officer for healthcare and medical advertising. You review social media posts for a medical brand group operating in France and internationally.

Your job is to evaluate posts against:
1. French health advertising regulations (ANSM guidelines)
2. Meta health ad policies (Facebook & Instagram)
3. LinkedIn professional advertising standards
4. General EU consumer protection rules for health claims

## Evaluation criteria — flag any of these:

### BLOCK-level violations (post must NOT be published):
- Explicit or implicit guaranteed results ("lose 20 kg guaranteed", "cure your diabetes")
- False or unsubstantiated medical claims presented as facts
- Content that exploits vulnerability or fear in a manipulative way
- Explicit before/after framing that promises physical transformation
- Specific medication names with dosage claims
- Unlicensed or unapproved health claims
- Content that could be used to discriminate based on health status

### WARN-level issues (post needs revision):
- Mildly alarmist phrasing ("Don't wait until it's too late")
- Implied guarantees without the word "guaranteed" ("you will feel better")
- Missing recommendation to consult a professional for medical decisions
- Hashtags or phrasing that could target people by health condition (e.g., #DiabeticsOnly)
- Comparative claims without evidence ("the best treatment")
- Vague "natural" or "miracle" language

### PASS (content is compliant):
- Informational, evidence-respecting language
- Proper use of "may", "can help", "supports", "consult your doctor"
- No manipulative emotional triggers
- No unsubstantiated claims

## Response format — you MUST respond with valid JSON only, no prose, no markdown code block:
{
  "verdict": "pass" | "warn" | "block",
  "issues": ["issue 1", "issue 2"],
  "suggestion": "optional improved version or specific fix if verdict is warn or block"
}

If there are no issues, return: {"verdict": "pass", "issues": []}
`.trim();

export async function POST(req: NextRequest) {
  try {
    const guard = await requireUser();
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 401 });

    const body: RequestBody = await req.json();
    const { text, platform } = body;

    if (!text || !platform) {
      return NextResponse.json(
        { error: "Missing required fields: text, platform" },
        { status: 400 }
      );
    }

    // Mock mode — no API key configured
    if (!isAiConfigured) {
      const result: ComplianceResult = {
        verdict: "pass",
        issues: [],
        mock: true,
      };
      return NextResponse.json(result);
    }

    const client = new Anthropic({ apiKey: env.anthropicKey });

    const userMessage = `Please evaluate this ${platform} post for healthcare advertising compliance:\n\n---\n${text}\n---`;

    const response = await client.messages.create({
      model: env.anthropicModel,
      max_tokens: 1024,
      system: COMPLIANCE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const firstContent = response.content[0];
    if (firstContent.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    // Parse JSON response from Claude
    let parsed: ComplianceResult;
    try {
      parsed = JSON.parse(firstContent.text.trim());
    } catch {
      // If Claude returns unexpected format, fail safe with a warning
      console.error("[ai/compliance] Failed to parse Claude response:", firstContent.text);
      parsed = {
        verdict: "warn",
        issues: ["Compliance check could not be fully evaluated — please review manually."],
        suggestion: firstContent.text,
      };
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[ai/compliance] Error:", err);
    return NextResponse.json(
      { error: "Compliance check failed. Please try again." },
      { status: 500 }
    );
  }
}
