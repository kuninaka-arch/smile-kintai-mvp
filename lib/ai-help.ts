import { prisma } from "@/lib/prisma";

export type AiHelpSource = "FAQ" | "PENDING";

export type AiHelpAnswer = {
  answer: string;
  source: AiHelpSource;
  conversationId: string;
  matchedFaqId?: string;
  unansweredQuestionId?: string;
};

export const defaultAiHelpFaqs = [
  {
    question: "打刻方法",
    answer: "打刻画面で「出勤」「退勤」「休憩開始」「休憩終了」を押してください。スマートフォンでも同じ画面から打刻できます。",
    keywords: "打刻,出勤,退勤,休憩,タイムカード"
  },
  {
    question: "夜勤登録方法",
    answer: "管理画面の「シフト管理」で夜勤の勤務パターンを選び、対象スタッフの日付セルに登録します。夜勤パターンの設定により、翌日の明けを自動表示できます。",
    keywords: "夜勤,明け,シフト,勤務パターン"
  },
  {
    question: "有給申請方法",
    answer: "メニューの「休暇・希望休」から申請できます。日付、休暇種別、理由を入力して送信してください。",
    keywords: "有給,休暇,希望休,申請"
  },
  {
    question: "シフト確認方法",
    answer: "スタッフは自分のシフトを打刻画面やシフト関連画面から確認できます。管理者は「シフト管理」から全体の月間シフトを確認できます。",
    keywords: "シフト,確認,勤務表"
  },
  {
    question: "加算資料の見方",
    answer: "介護メニューの「加算資料」で、人員配置不足、資格者配置不足、夜勤配置不足、常勤換算の概要を確認できます。",
    keywords: "加算資料,人員配置,資格者配置,常勤換算,夜勤体制"
  },
  {
    question: "PDF出力方法",
    answer: "「加算資料」画面のPDF出力ボタンを押すと、介護加算資料サマリーをPDFで出力できます。Excel出力も同じ画面から行えます。",
    keywords: "PDF,Excel,出力,帳票"
  },
  {
    question: "ログインできない",
    answer: "メールアドレスとパスワードを確認してください。解決しない場合は、管理者へパスワード再設定を依頼してください。",
    keywords: "ログイン,入れない,パスワード,メール"
  },
  {
    question: "パスワード再設定",
    answer: "現在は管理者による再設定運用です。ログインできない場合は、施設の管理者へ連絡してください。",
    keywords: "パスワード,再設定,変更"
  }
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[？?。．.、,]/g, "");
}

function scoreFaq(question: string, faq: { question: string; answer: string; keywords: string | null }) {
  const normalizedQuestion = normalize(question);
  const normalizedFaqQuestion = normalize(faq.question);
  const normalizedKeywords = normalize(faq.keywords ?? "");
  if (!normalizedQuestion) return 0;
  if (normalizedQuestion.includes(normalizedFaqQuestion) || normalizedFaqQuestion.includes(normalizedQuestion)) return 100;

  const keywords = (faq.keywords ?? "")
    .split(/[,\s、]+/)
    .map((keyword) => normalize(keyword))
    .filter(Boolean);
  let score = 0;
  for (const keyword of keywords) {
    if (normalizedQuestion.includes(keyword)) score += 20;
  }
  if (normalizedKeywords && normalizedQuestion.includes(normalizedKeywords)) score += 10;
  return score;
}

export async function getAiHelpFaqCards(companyId: string, limit = 8) {
  const faqs = await prisma.aiHelpFaq
    .findMany({
      where: { companyId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      take: limit
    })
    .catch(() => []);

  if (faqs.length > 0) {
    return faqs.map((faq) => ({ id: faq.id, question: faq.question, answer: faq.answer }));
  }

  return defaultAiHelpFaqs.slice(0, limit).map((faq, index) => ({
    id: `default-${index}`,
    question: faq.question,
    answer: faq.answer
  }));
}

export async function askAiHelp(question: string, companyId: string, userId?: string | null): Promise<AiHelpAnswer> {
  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) {
    throw new Error("質問を入力してください。");
  }

  const dbFaqs = await prisma.aiHelpFaq
    .findMany({
      where: { companyId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    })
    .catch(() => []);

  const combinedFaqs = [
    ...dbFaqs.map((faq) => ({ id: faq.id, question: faq.question, answer: faq.answer, keywords: faq.keywords, isDb: true })),
    ...defaultAiHelpFaqs.map((faq, index) => ({ id: `default-${index}`, question: faq.question, answer: faq.answer, keywords: faq.keywords, isDb: false }))
  ];

  const best = combinedFaqs
    .map((faq) => ({ faq, score: scoreFaq(trimmedQuestion, faq) }))
    .sort((a, b) => b.score - a.score)[0];

  if (best && best.score > 0) {
    const conversation = await prisma.aiHelpConversation.create({
      data: {
        companyId,
        userId: userId ?? null,
        question: trimmedQuestion,
        answer: best.faq.answer,
        matchedFaqId: best.faq.isDb ? best.faq.id : null
      }
    });

    return {
      answer: best.faq.answer,
      source: "FAQ",
      conversationId: conversation.id,
      matchedFaqId: best.faq.isDb ? best.faq.id : undefined
    };
  }

  const fallbackAnswer = "現在回答を準備しています。管理者が確認し、FAQへ追加できるようにしました。";
  const [unanswered, conversation] = await prisma.$transaction([
    prisma.aiHelpUnansweredQuestion.create({
      data: {
        companyId,
        userId: userId ?? null,
        question: trimmedQuestion
      }
    }),
    prisma.aiHelpConversation.create({
      data: {
        companyId,
        userId: userId ?? null,
        question: trimmedQuestion,
        answer: fallbackAnswer
      }
    })
  ]);

  return {
    answer: fallbackAnswer,
    source: "PENDING",
    conversationId: conversation.id,
    unansweredQuestionId: unanswered.id
  };
}
