"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Role = "ADMIN" | "EMPLOYEE";

type RoleMasterOption = {
  id: string;
  code: string;
  name: string;
};

type PositionOption = {
  id: string;
  code: string;
  name: string;
};

type EmployeeFormUser = {
  id: string;
  name: string;
  email: string;
  department: string;
  role: Role;
  roleMasterId: string | null;
  positionMasterId: string | null;
  jobType: string | null;
  isFullTime: boolean;
  monthlyScheduledMinutes: number | null;
  displayOrder: number;
};

export function EmployeeForm({
  mode,
  user,
  roleMasters,
  positions
}: {
  mode: "create" | "edit";
  user?: EmployeeFormUser;
  roleMasters: RoleMasterOption[];
  positions: PositionOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(mode === "create");
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [department, setDepartment] = useState(user?.department ?? "");
  const [displayOrder, setDisplayOrder] = useState(String(user?.displayOrder ?? ""));
  const [positionMasterId, setPositionMasterId] = useState(user?.positionMasterId ?? "");
  const [jobType, setJobType] = useState(user?.jobType ?? "");
  const [isFullTime, setIsFullTime] = useState(user?.isFullTime ?? false);
  const [monthlyScheduledHours, setMonthlyScheduledHours] = useState(
    user?.monthlyScheduledMinutes ? String(Math.round(user.monthlyScheduledMinutes / 60)) : ""
  );
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
      body: JSON.stringify({
        name,
        email,
        department,
        displayOrder,
        positionMasterId,
        jobType,
        isFullTime,
        monthlyScheduledHours,
        role,
        roleMasterId,
        password
      })
    });

    if (res.ok) {
      setMessage(mode === "create" ? "社員を追加しました。" : "社員情報を更新しました。");
      if (mode === "create") {
        setName("");
        setEmail("");
        setDepartment("");
        setDisplayOrder("");
        setPositionMasterId("");
        setJobType("");
        setIsFullTime(false);
        setMonthlyScheduledHours("");
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
      <Field label="表示順" value={displayOrder} onChange={setDisplayOrder} type="number" required={false} />
      <label className="block">
        <span className="text-xs font-black text-slate-500">職種</span>
        <input
          list="job-type-options"
          value={jobType}
          onChange={(e) => setJobType(e.target.value)}
          className="mt-1 w-full rounded-xl border px-3 py-2"
          placeholder="介護職員"
        />
        <datalist id="job-type-options">
          <option value="介護職員" />
          <option value="看護師" />
          <option value="機能訓練指導員" />
          <option value="生活相談員" />
          <option value="事務員" />
        </datalist>
      </label>
      <label className="flex items-center gap-2 rounded-xl border px-3 py-2">
        <input type="checkbox" checked={isFullTime} onChange={(e) => setIsFullTime(e.target.checked)} />
        <span className="text-sm font-black text-slate-700">常勤</span>
      </label>
      <Field label="月所定労働時間（時間）" value={monthlyScheduledHours} onChange={setMonthlyScheduledHours} type="number" required={false} />
      <label className="block">
        <span className="text-xs font-black text-slate-500">役職</span>
        <select value={positionMasterId} onChange={(e) => setPositionMasterId(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2">
          <option value="">未設定</option>
          {positions.map((position) => (
            <option key={position.id} value={position.id}>
              {position.name}
            </option>
          ))}
        </select>
      </label>
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
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border px-3 py-2"
        required={required}
      />
    </label>
  );
}
