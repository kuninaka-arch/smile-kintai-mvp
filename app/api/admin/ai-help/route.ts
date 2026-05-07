import { logAction } from "@/lib/audit-log";
import { apiError, requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { session } = auth;
  const companyId = session.user.companyId;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");

  if (action === "createFaq" || action === "updateFaq") {
    const id = String(body.id ?? "");
    const question = String(body.question ?? "").trim();
    const answer = String(body.answer ?? "").trim();
    const keywords = String(body.keywords ?? "").trim() || null;
    const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;
    const isActive = body.isActive === undefined ? true : Boolean(body.isActive);
    if (!question || !answer) return apiError("質問と回答を入力してください。", 400);

    if (action === "updateFaq") {
      const before = await prisma.aiHelpFaq.findFirst({ where: { id, companyId } });
      if (!before) return apiError("FAQが見つかりません。", 404);
      const faq = await prisma.aiHelpFaq.update({
        where: { id: before.id },
        data: { question, answer, keywords, sortOrder, isActive }
      });
      await logAction({
        request: req,
        userId: session.user.id,
        companyId,
        action: "UPDATE_FAQ",
        targetType: "AI_FAQ",
        targetId: faq.id,
        before,
        after: faq
      });
      return Response.json({ ok: true, message: "FAQを更新しました。", faq });
    }

    const faq = await prisma.aiHelpFaq.create({
      data: { companyId, question, answer, keywords, sortOrder, isActive }
    });
    await logAction({
      request: req,
      userId: session.user.id,
      companyId,
      action: "CREATE_FAQ",
      targetType: "AI_FAQ",
      targetId: faq.id,
      after: faq
    });
    return Response.json({ ok: true, message: "FAQを追加しました。", faq });
  }

  if (action === "deleteFaq") {
    const id = String(body.id ?? "");
    const before = await prisma.aiHelpFaq.findFirst({ where: { id, companyId } });
    if (!before) return apiError("FAQが見つかりません。", 404);
    await prisma.aiHelpFaq.delete({ where: { id: before.id } });
    await logAction({
      request: req,
      userId: session.user.id,
      companyId,
      action: "DELETE_FAQ",
      targetType: "AI_FAQ",
      targetId: before.id,
      before,
      after: null
    });
    return Response.json({ ok: true, message: "FAQを削除しました。" });
  }

  if (action === "createFaqFromUnanswered") {
    const unansweredId = String(body.unansweredId ?? "");
    const answer = String(body.answer ?? "").trim();
    const keywords = String(body.keywords ?? "").trim() || null;
    if (!answer) return apiError("回答を入力してください。", 400);

    const unanswered = await prisma.aiHelpUnansweredQuestion.findFirst({ where: { id: unansweredId, companyId } });
    if (!unanswered) return apiError("未回答質問が見つかりません。", 404);

    const [faq] = await prisma.$transaction([
      prisma.aiHelpFaq.create({
        data: { companyId, question: unanswered.question, answer, keywords }
      }),
      prisma.aiHelpUnansweredQuestion.update({
        where: { id: unanswered.id },
        data: { resolved: true }
      })
    ]);
    await logAction({
      request: req,
      userId: session.user.id,
      companyId,
      action: "CREATE_FAQ",
      targetType: "AI_FAQ",
      targetId: faq.id,
      after: faq,
      meta: { fromUnansweredQuestionId: unanswered.id }
    });
    return Response.json({ ok: true, message: "未回答質問からFAQを作成しました。", faq });
  }

  if (action === "resolveUnanswered") {
    const unansweredId = String(body.unansweredId ?? "");
    const before = await prisma.aiHelpUnansweredQuestion.findFirst({ where: { id: unansweredId, companyId } });
    if (!before) return apiError("未回答質問が見つかりません。", 404);
    await prisma.aiHelpUnansweredQuestion.update({
      where: { id: before.id },
      data: { resolved: true }
    });
    return Response.json({ ok: true, message: "未回答質問を解決済みにしました。" });
  }

  return apiError("操作種別が正しくありません。", 400);
}
