"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Role = "ADMIN" | "EMPLOYEE";

type RoleMasterOption = {
  id: string;
  code: string;
  name: string;
};

export function EmployeeForm({
  mode,
  user,
  roleMasters
}: {
  mode: "create" | "edit";
  user?: { id: string; name: string; email: string; department: string; role: Role; roleMasterId: string | null };
  roleMasters: RoleMasterOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(mode === "create");
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [department, setDepartment] = useState(user?.department ?? "");
  const [role, setRole] = useState<Role>(user?.role ?? "EMPLOYEE");
  const [roleMasterId, setRoleMasterId] = useState(user?.roleMasterId ?? roleMasters.find((item) => item.code === (user?.role ?? "EMPLOYEE"))?.id ?? "");
  const [password, setPassword] = useState("password123");
  const [message, setMessage] = useState("");

  function changeRoleMaster(nextRoleMasterId: string) {
    setRoleMasterId(nextRoleMasterId);
    const selectedRoleMaster = roleMasters.find((item) => item.id === nextRoleMasterId);
    setRole(selectedRoleMaster?.code === "ADMIN" ? "ADMIN" : "EMPLOYEE");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const res = await fetch(mode === "create" ? "/api/admin/employees" : `/api/admin/employees/${user?.id}`, {
      method: mode === "create" ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, department, role, roleMasterId, password })
    });

    if (res.ok) {
      setMessage(mode === "create" ? "社員を追加しました。" : "社員情報を更新しました。");
      if (mode === "create") {
        setName("");
        setEmail("");
        setDepartment("");
        setPassword("password123");
      }
      router.refresh();
      if (mode === "edit") setOpen(false);
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
      <Field label="氏名" value={name} onChange={setName} />
      <Field label="メール" value={email} onChange={setEmail} type="email" />
      <Field label="所属" value={department} onChange={setDepartment} />
      {mode === "create" && <Field label="初期パスワード" value={password} onChange={setPassword} type="password" />}
      <label className="block">
        <span className="text-xs font-black text-slate-500">権限</span>
        <select value={roleMasterId} onChange={(e) => changeRoleMaster(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2">
          <option value="">標準社員</option>
          {roleMasters.map((roleMaster) => (
            <option key={roleMaster.id} value={roleMaster.id}>
              {roleMaster.name}
            </option>
          ))}
        </select>
      </label>
      <button className="w-full rounded-xl bg-blue-600 px-4 py-3 font-black text-white">
        {mode === "create" ? "追加する" : "更新する"}
      </button>
      {message && <p className="rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-700">{message}</p>}
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border px-3 py-2"
        required
      />
    </label>
  );
}
