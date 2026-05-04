"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Qualification = {
  id: string;
  name: string;
  requiredCount: number;
};

type UserOption = {
  id: string;
  name: string;
  department: string | null;
  qualifications: { id: string; qualificationId: string; name: string }[];
};

export function CareQualificationsManager({
  qualifications,
  users
}: {
  qualifications: Qualification[];
  users: UserOption[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [userId, setUserId] = useState(users[0]?.id ?? "");
  const [qualificationId, setQualificationId] = useState(qualifications[0]?.id ?? "");
  const [requiredCounts, setRequiredCounts] = useState<Record<string, number>>(
    Object.fromEntries(qualifications.map((qualification) => [qualification.id, qualification.requiredCount]))
  );
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedUser = useMemo(() => users.find((user) => user.id === userId), [userId, users]);

  async function post(body: Record<string, unknown>) {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/admin/care/qualifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    setSaving(false);

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.error ?? "保存に失敗しました。");
      return false;
    }

    setMessage(data.message ?? "保存しました。");
    router.refresh();
    return true;
  }

  async function createQualification(e: React.FormEvent) {
    e.preventDefault();
    const ok = await post({ action: "createQualification", name });
    if (ok) setName("");
  }

  async function seedDefaults() {
    await post({ action: "seedDefaults" });
  }

  async function assignQualification(e: React.FormEvent) {
    e.preventDefault();
    await post({ action: "assignQualification", userId, qualificationId });
  }

  async function removeUserQualification(userQualificationId: string) {
    await post({ action: "removeUserQualification", userQualificationId });
  }

  async function saveRules(e: React.FormEvent) {
    e.preventDefault();
    await post({
      action: "saveRules",
      rules: qualifications.map((qualification) => ({
        qualificationId: qualification.id,
        requiredCount: Number(requiredCounts[qualification.id] ?? 0)
      }))
    });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <section className="space-y-5">
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900">資格マスタ</h2>
              <p className="text-sm text-slate-500">施設で使う資格を登録します。</p>
            </div>
            <button type="button" onClick={seedDefaults} disabled={saving} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white disabled:opacity-60">
              標準追加
            </button>
          </div>
          <form onSubmit={createQualification} className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="介護福祉士" className="min-w-0 flex-1 rounded-xl border px-3 py-2" />
            <button disabled={saving || !name.trim()} className="rounded-xl bg-blue-600 px-4 py-2 font-black text-white disabled:opacity-60">
              追加
            </button>
          </form>
          <div className="mt-4 flex flex-wrap gap-2">
            {qualifications.map((qualification) => (
              <span key={qualification.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                {qualification.name}
              </span>
            ))}
            {qualifications.length === 0 && <p className="text-sm font-bold text-slate-500">資格が未登録です。</p>}
          </div>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-900">スタッフ保有資格</h2>
          <p className="text-sm text-slate-500">スタッフに複数資格を登録できます。</p>
          <form onSubmit={assignQualification} className="mt-4 space-y-3">
            <select value={userId} onChange={(e) => setUserId(e.target.value)} className="w-full rounded-xl border px-3 py-2">
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}（{user.department ?? "-"}）
                </option>
              ))}
            </select>
            <select value={qualificationId} onChange={(e) => setQualificationId(e.target.value)} className="w-full rounded-xl border px-3 py-2">
              {qualifications.map((qualification) => (
                <option key={qualification.id} value={qualification.id}>
                  {qualification.name}
                </option>
              ))}
            </select>
            <button disabled={saving || !userId || !qualificationId} className="w-full rounded-xl bg-blue-600 px-4 py-3 font-black text-white disabled:opacity-60">
              資格を付与
            </button>
          </form>

          {selectedUser && (
            <div className="mt-4 rounded-2xl bg-slate-50 p-3">
              <p className="mb-2 text-xs font-black text-slate-500">{selectedUser.name} の資格</p>
              <div className="flex flex-wrap gap-2">
                {selectedUser.qualifications.map((qualification) => (
                  <button
                    key={qualification.id}
                    type="button"
                    onClick={() => removeUserQualification(qualification.id)}
                    className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200 hover:bg-red-50 hover:text-red-700"
                  >
                    {qualification.name} ×
                  </button>
                ))}
                {selectedUser.qualifications.length === 0 && <p className="text-sm font-bold text-slate-500">未登録</p>}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-slate-900">資格別必要人数</h2>
        <p className="text-sm text-slate-500">会社全体で1日に必要な資格者数を設定します。</p>
        <form onSubmit={saveRules} className="mt-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            {qualifications.map((qualification) => (
              <label key={qualification.id} className="rounded-2xl border bg-slate-50 p-4">
                <span className="text-sm font-black text-slate-700">{qualification.name}</span>
                <input
                  type="number"
                  min="0"
                  value={requiredCounts[qualification.id] ?? 0}
                  onChange={(e) => setRequiredCounts((prev) => ({ ...prev, [qualification.id]: Number(e.target.value) }))}
                  className="mt-2 w-full rounded-xl border px-3 py-2 text-lg font-black"
                />
              </label>
            ))}
          </div>
          <button disabled={saving || qualifications.length === 0} className="rounded-xl bg-blue-600 px-5 py-3 font-black text-white disabled:opacity-60">
            必要人数を保存
          </button>
        </form>
      </section>

      {message && <p className="xl:col-span-2 rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-700">{message}</p>}
    </div>
  );
}
