import { apiError, requireCompanyUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const auth = await requireCompanyUser();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json().catch(() => ({}));
  const conversationId = String(body.conversationId ?? "");
  const resolved = Boolean(body.resolved);

  const conversation = await prisma.aiHelpConversation.findFirst({
    where: {
      id: conversationId,
      companyId: session.user.companyId,
      userId: session.user.id
    },
    select: { id: true }
  });
  if (!conversation) return apiError("問い合わせ履歴が見つかりません。", 404);

  await prisma.aiHelpConversation.update({
    where: { id: conversation.id },
    data: { resolved }
  });

  return Response.json({ ok: true });
}
