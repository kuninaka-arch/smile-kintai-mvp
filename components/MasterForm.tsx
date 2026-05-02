"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type MasterKind = "department" | "employmentType" | "position" | "role" | "leaveType";

export function MasterForm({
  kind,
  mode,
  item
}: {
  kind: MasterKind;
  mode: "create" | "edit";
  item?: {
    id: string;
    code: string;
    name: string;
    description?: string | null;
    allowHourly?: boolean;
    sortOrder: number;
    isActive: boolean;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(mode === "create");
  const [code, setCode] = useState(item?.code ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [allowHourly, setAllowHourly] = useState(Boolean(item?.allowHourly));
  const [sortOrder, setSortOrder] = useState(String(item?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [message, setMessage] = useState("");

  const pathMap = {
    department: "/api/admin/masters/departments",
    employmentType: "/api/admin/masters/employment-types",
    position: "/api/admin/masters/positions",
    role: "/api/admin/masters/roles",
    leaveType: "/api/admin/masters/leave-types"
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const res = await fetch(mode === "create" ? pathMap[kind] : `${pathMap[kind]}/${item?.id}`, {
      method: mode === "create" ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, name, description, allowHourly, sortOrder: Number(sortOrder), isActive })
    });

    if (res.ok) {
      setMessage(mode === "create" ? "登録しました。" : "更新しました。");
      if (mode === "create") {
        setCode("");
        setName("");
        setDescription("");
        setAllowHourly(false);
        setSortOrder("0");
        setIsActive(true);
      } else {
        setOpen(false);
      }
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "保存に失敗しました。");
    }
  }

  if (mode === "edit" && !open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-black">
        編集
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {mode === "edit" && (
        <div className="mb-3 flex items-center justify-between">
          <p className="font-black">編集</p>
          <button type="button" onClick={() => setOpen(false)} className="text-xs font-bold text-slate-400">
            閉じる
          </button>
        </div>
      )}

      {kind === "role" ? (
        <label className="block">
          <span className="text-xs font-black text-slate-500">権限</span>
          <select value={code} onChange={(e) => setCode(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" required>
            <option value="">選択してください</option>
            <option value="ADMIN">管理者</option>
            <option value="EMPLOYEE">社員</option>
          </select>
        </label>
      ) : (
        <Field label="コード" value={code} onChange={setCode} />
      )}
      <Field label="名称" value={name} onChange={setName} />
      {kind === "role" && <Field label="説明" value={description} onChange={setDescription} required={false} />}
      {kind === "leaveType" && (
        <label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm font-bold">
          <input type="checkbox" checked={allowHourly} onChange={(e) => setAllowHourly(e.target.checked)} />
          時間単位で取得できる
        </label>
      )}
      <Field label="表示順" value={sortOrder} onChange={setSortOrder} type="number" />

      <label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm font-bold">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        有効
      </label>

      <button className="w-full rounded-xl bg-blue-600 px-4 py-3 font-black text-white">
        {mode === "create" ? "登録する" : "更新する"}
      </button>

      {message && (
        <p className="rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-700">
          {message}
        </p>
      )}
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = true
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border px-3 py-2"
      />
    </label>
  );
}
