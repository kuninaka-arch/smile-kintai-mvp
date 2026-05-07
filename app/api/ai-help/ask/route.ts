import { askAiHelp } from "@/lib/ai-help";
import { apiError, requireCompanyUser } from "@/lib/authz";

export async function POST(req: Request) {
  const auth = await requireCompanyUser();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json().catch(() => ({}));
  const question = String(body.question ?? "").trim();
  if (!question) return apiError("質問を入力してください。", 400);
  if (question.length > 500) return apiError("質問は500文字以内で入力してください。", 400);

  try {
    const result = await askAiHelp(question, session.user.companyId, session.user.id);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "回答の作成に失敗しました。", 500);
  }
}
