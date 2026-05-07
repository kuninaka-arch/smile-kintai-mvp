"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Faq = {
  id: string;
  question: string;
  answer: string;
  keywords: string | null;
  sortOrder: number;
  isActive: boolean;
};

type Unanswered = {
  id: string;
  question: string;
  createdAtLabel: string;
  userName: string;
  userEmail: string;
};

export function AiHelpAdminManager({ faqs, unanswered }: { faqs: Faq[]; unanswered: Unanswered[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Faq | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [keywords, setKeywords] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});

  function resetForm() {
    setEditing(null);
    setQuestion("");
    setAnswer("");
    setKeywords("");
    setSortOrder(0);
    setIsActive(true);
  }

  function startEdit(faq: Faq) {
    setEditing(faq);
    setQuestion(faq.question);
    setAnswer(faq.answer);
    setKeywords(faq.keywords ?? "");
    setSortOrder(faq.sortOrder);
    setIsActive(faq.isActive);
  }

  async function post(body: Record<string, unknown>) {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/admin/ai-help", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? data.message ?? "保存しました。" : data.error ?? "処理に失敗しました。");
    if (res.ok) {
      router.refresh();
      return true;
    }
    return false;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await post({
      action: editing ? "updateFaq" : "createFaq",
      id: editing?.id,
      question,
      answer,
      keywords,
      sortOrder,
      isActive
    });
    if (ok) resetForm();
  }

  async function deleteFaq(faq: Faq) {
    if (!confirm(`FAQ「${faq.question}」を削除しますか？`)) return;
    await post({ action: "deleteFaq", id: faq.id });
  }

  async function createFromUnanswered(item: Unanswered) {
    const draftAnswer = draftAnswers[item.id]?.trim();
    if (!draftAnswer) {
      setMessage("FAQへ追加する回答を入力してください。");
      return;
    }
    const ok = await post({
      action: "createFaqFromUnanswered",
      unansweredId: item.id,
      answer: draftAnswer,
      keywords: item.question
    });
    if (ok) setDraftAnswers((prev) => ({ ...prev, [item.id]: "" }));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-slate-900">{editing ? "FAQ編集" : "FAQ追加"}</h2>
        <p className="mt-1 text-sm text-slate-500">FAQに一致した質問は自動回答されます。</p>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block text-sm font-bold text-slate-700">
            質問
            <input value={question} onChange={(e) => setQuestion(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
          </label>
          <label className="block text-sm font-bold text-slate-700">
            回答
            <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={5} className="mt-1 w-full rounded-xl border px-3 py-2" />
          </label>
          <label className="block text-sm font-bold text-slate-700">
            キーワード
            <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="有給,休暇,申請" className="mt-1 w-full rounded-xl border px-3 py-2" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-bold text-slate-700">
              表示順
              <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className="mt-1 w-full rounded-xl border px-3 py-2" />
            </label>
            <label className="flex items-end gap-2 rounded-xl border px-3 py-2 text-sm font-bold text-slate-700">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              有効
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button disabled={saving || !question.trim() || !answer.trim()} className="rounded-xl bg-blue-600 px-5 py-3 font-black text-white disabled:opacity-60">
              {saving ? "保存中..." : editing ? "更新する" : "追加する"}
            </button>
            {editing && (
              <button type="button" onClick={resetForm} className="rounded-xl border px-5 py-3 font-black text-slate-700">
                キャンセル
              </button>
            )}
          </div>
        </form>
        {message && <p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-700">{message}</p>}
      </section>

      <section className="space-y-6">
        <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
          <div className="border-b p-5">
            <h2 className="text-lg font-black text-slate-900">FAQ一覧</h2>
            <p className="text-sm text-slate-500">{faqs.length}件登録されています。</p>
          </div>
          <div className="divide-y">
            {faqs.map((faq) => (
              <div key={faq.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-900">{faq.question}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{faq.answer}</p>
                    <p className="mt-2 text-xs font-bold text-slate-400">キーワード: {faq.keywords || "未設定"} / 表示順: {faq.sortOrder} / {faq.isActive ? "有効" : "無効"}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(faq)} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white">編集</button>
                    <button onClick={() => deleteFaq(faq)} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-black text-red-700">削除</button>
                  </div>
                </div>
              </div>
            ))}
            {faqs.length === 0 && <p className="p-8 text-center text-sm font-bold text-slate-500">FAQはまだ登録されていません。</p>}
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
          <div className="border-b p-5">
            <h2 className="text-lg font-black text-slate-900">未回答質問</h2>
            <p className="text-sm text-slate-500">FAQに一致しなかった質問です。回答を入力するとFAQへ追加できます。</p>
          </div>
          <div className="divide-y">
            {unanswered.map((item) => (
              <div key={item.id} className="p-5">
                <p className="font-black text-slate-900">{item.question}</p>
                <p className="mt-1 text-xs font-bold text-slate-400">{item.createdAtLabel} / {item.userName}（{item.userEmail}）</p>
                <textarea
                  value={draftAnswers[item.id] ?? ""}
                  onChange={(e) => setDraftAnswers((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  rows={3}
                  placeholder="この質問への回答を入力"
                  className="mt-3 w-full rounded-xl border px-3 py-2"
                />
                <button onClick={() => createFromUnanswered(item)} disabled={saving} className="mt-3 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white disabled:opacity-60">
                  FAQへ追加
                </button>
              </div>
            ))}
            {unanswered.length === 0 && <p className="p-8 text-center text-sm font-bold text-slate-500">未回答質問はありません。</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
