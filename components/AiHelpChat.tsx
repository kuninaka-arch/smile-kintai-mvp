"use client";

import { useState } from "react";

type FaqCard = {
  id: string;
  question: string;
  answer: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  conversationId?: string;
  source?: "FAQ" | "PENDING";
};

export function AiHelpChat({ faqCards }: { faqCards: FaqCard[] }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "こんにちは。勤怠管理システムの操作で困っていることを入力してください。FAQを確認して回答します。"
    }
  ]);
  const [sending, setSending] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");

  async function ask(nextQuestion: string) {
    const trimmed = nextQuestion.trim();
    if (!trimmed || sending) return;

    setFeedbackMessage("");
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", text: trimmed }]);
    setQuestion("");
    setSending(true);

    const res = await fetch("/api/ai-help/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: trimmed })
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        text: res.ok ? data.answer : data.error ?? "回答の作成に失敗しました。",
        conversationId: data.conversationId,
        source: data.source
      }
    ]);
  }

  async function sendFeedback(conversationId: string, resolved: boolean) {
    const res = await fetch("/api/ai-help/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, resolved })
    });
    setFeedbackMessage(res.ok ? "フィードバックを保存しました。" : "フィードバックの保存に失敗しました。");
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <section className="rounded-3xl bg-white p-4 shadow-sm md:p-5">
        <div className="mb-4 border-b pb-4">
          <h2 className="text-lg font-black text-slate-900">AI問い合わせ</h2>
          <p className="mt-1 text-sm text-slate-500">現在はFAQ検索をもとに回答します。回答できない質問は管理者確認用に保存されます。</p>
        </div>

        <div className="max-h-[56vh] space-y-3 overflow-y-auto rounded-2xl bg-slate-50 p-3">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${message.role === "user" ? "bg-blue-600 text-white" : "bg-white text-slate-800"}`}>
                <p className="whitespace-pre-wrap">{message.text}</p>
                {message.role === "assistant" && message.source && (
                  <p className="mt-2 text-xs font-bold text-slate-400">{message.source === "FAQ" ? "FAQから回答" : "未回答として保存"}</p>
                )}
                {message.role === "assistant" && message.conversationId && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => sendFeedback(message.conversationId!, true)} className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
                      解決した
                    </button>
                    <button onClick={() => sendFeedback(message.conversationId!, false)} className="rounded-full bg-orange-100 px-3 py-1 text-xs font-black text-orange-700">
                      解決しなかった
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {sending && <p className="text-sm font-bold text-slate-500">回答を確認しています...</p>}
        </div>

        {feedbackMessage && <p className="mt-3 rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-700">{feedbackMessage}</p>}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
          className="mt-4 flex flex-col gap-3 sm:flex-row"
        >
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            placeholder="例：有給申請はどうやる？"
            className="min-h-[56px] flex-1 rounded-2xl border px-4 py-3 text-base outline-none focus:border-blue-500"
          />
          <button disabled={sending || !question.trim()} className="rounded-2xl bg-blue-600 px-6 py-3 font-black text-white disabled:opacity-60">
            質問する
          </button>
        </form>
      </section>

      <aside className="rounded-3xl bg-white p-4 shadow-sm md:p-5">
        <h2 className="text-lg font-black text-slate-900">よくある質問</h2>
        <div className="mt-4 space-y-3">
          {faqCards.map((faq) => (
            <button key={faq.id} onClick={() => ask(faq.question)} className="w-full rounded-2xl border bg-slate-50 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50">
              <p className="font-black text-slate-900">{faq.question}</p>
              <p className="mt-1 line-clamp-2 text-sm text-slate-500">{faq.answer}</p>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
