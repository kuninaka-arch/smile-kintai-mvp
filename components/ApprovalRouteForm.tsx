"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Option = { id: string; name: string; code?: string; email?: string };
type Approver = {
  approverType: "USER" | "ROLE" | "DEPARTMENT_MANAGER" | "COMPANY_ADMIN";
  userId?: string;
  roleMasterId?: string;
  departmentId?: string;
};
type Step = {
  stepOrder: number;
  name: string;
  requirement: "ANY_ONE" | "ALL_REQUIRED";
  approvers: Approver[];
};
type RouteValue = {
  id: string;
  name: string;
  requestType: string;
  departmentId?: string | null;
  description?: string | null;
  isDefault: boolean;
  isActive: boolean;
  steps: Step[];
};

const requestTypeOptions = [
  ["ATTENDANCE_CORRECTION", "打刻修正"],
  ["OVERTIME", "残業"],
  ["HOLIDAY_WORK", "休日出勤"],
  ["NIGHT_WORK", "深夜勤務"],
  ["PAID_LEAVE", "有休"],
  ["SUBSTITUTE_LEAVE", "代休"],
  ["MATERNITY_LEAVE", "産休"],
  ["CHILDCARE_LEAVE", "育休"],
  ["SHORT_TIME_WORK", "時短勤務"]
];

function emptyStep(order: number): Step {
  return {
    stepOrder: order,
    name: `${order}次承認`,
    requirement: "ANY_ONE",
    approvers: [{ approverType: "COMPANY_ADMIN" }]
  };
}

function normalizeSteps(route?: RouteValue): Step[] {
  if (!route?.steps?.length) return [emptyStep(1)];
  return route.steps.map((step, index) => ({
    stepOrder: step.stepOrder ?? index + 1,
    name: step.name,
    requirement: step.requirement,
    approvers: step.approvers?.length ? step.approvers : [{ approverType: "COMPANY_ADMIN" }]
  }));
}

export function ApprovalRouteForm({
  route,
  departments,
  users,
  roles
}: {
  route?: RouteValue;
  departments: Option[];
  users: Option[];
  roles: Option[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!route);
  const [name, setName] = useState(route?.name ?? "");
  const [requestType, setRequestType] = useState(route?.requestType ?? "ATTENDANCE_CORRECTION");
  const [departmentId, setDepartmentId] = useState(route?.departmentId ?? "");
  const [description, setDescription] = useState(route?.description ?? "");
  const [isDefault, setIsDefault] = useState(route?.isDefault ?? true);
  const [isActive, setIsActive] = useState(route?.isActive ?? true);
  const [steps, setSteps] = useState<Step[]>(normalizeSteps(route));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function updateStep(index: number, next: Partial<Step>) {
    setSteps((current) => current.map((step, i) => (i === index ? { ...step, ...next } : step)));
  }

  function updateApprover(stepIndex: number, approverIndex: number, next: Partial<Approver>) {
    setSteps((current) =>
      current.map((step, i) =>
        i === stepIndex
          ? {
              ...step,
              approvers: step.approvers.map((approver, j) => (j === approverIndex ? { ...approver, ...next } : approver))
            }
          : step
      )
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage("");

    const res = await fetch(route ? `/api/admin/approval-routes/${route.id}` : "/api/admin/approval-routes", {
      method: route ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, requestType, departmentId, description, isDefault, isActive, steps })
    });

    setSaving(false);
    if (res.ok) {
      setMessage(route ? "承認ルートを更新しました。" : "承認ルートを作成しました。");
      if (!route) {
        setName("");
        setDescription("");
        setSteps([emptyStep(1)]);
      }
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "保存に失敗しました。");
    }
  }

  async function remove() {
    if (!route || saving) return;
    setSaving(true);
    setMessage("");
    const res = await fetch(`/api/admin/approval-routes/${route.id}`, { method: "DELETE" });
    setSaving(false);
    if (res.ok) {
      setMessage("承認ルートを削除しました。");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "削除に失敗しました。");
    }
  }

  if (route && !open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-black">
        編集
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {route && (
        <div className="flex items-center justify-between">
          <p className="font-black">承認ルート編集</p>
          <button type="button" onClick={() => setOpen(false)} className="text-xs font-bold text-slate-400">
            閉じる
          </button>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="ルート名" value={name} onChange={setName} />
        <label className="block">
          <span className="text-xs font-black text-slate-500">申請種別</span>
          <select value={requestType} onChange={(e) => setRequestType(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2">
            {requestTypeOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-black text-slate-500">対象部署</span>
        <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2">
          <option value="">全社共通</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>{department.name}</option>
          ))}
        </select>
      </label>

      <Field label="説明" value={description} onChange={setDescription} required={false} />

      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
          既定ルート
        </label>
        <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          有効
        </label>
      </div>

      <div className="space-y-3">
        {steps.map((step, stepIndex) => (
          <div key={stepIndex} className="rounded-2xl border border-slate-200 p-3">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="順番" value={String(step.stepOrder)} onChange={(value) => updateStep(stepIndex, { stepOrder: Number(value) })} type="number" />
              <Field label="ステップ名" value={step.name} onChange={(value) => updateStep(stepIndex, { name: value })} />
              <label className="block">
                <span className="text-xs font-black text-slate-500">承認条件</span>
                <select value={step.requirement} onChange={(e) => updateStep(stepIndex, { requirement: e.target.value as Step["requirement"] })} className="mt-1 w-full rounded-xl border px-3 py-2">
                  <option value="ANY_ONE">誰か1人</option>
                  <option value="ALL_REQUIRED">全員承認</option>
                </select>
              </label>
            </div>

            <div className="mt-3 space-y-2">
              {step.approvers.map((approver, approverIndex) => (
                <div key={approverIndex} className="grid gap-2 rounded-xl bg-slate-50 p-3 md:grid-cols-4">
                  <select
                    value={approver.approverType}
                    onChange={(e) => updateApprover(stepIndex, approverIndex, { approverType: e.target.value as Approver["approverType"], userId: "", roleMasterId: "", departmentId: "" })}
                    className="rounded-xl border px-3 py-2"
                  >
                    <option value="COMPANY_ADMIN">会社管理者</option>
                    <option value="DEPARTMENT_MANAGER">部署上長</option>
                    <option value="USER">ユーザー指定</option>
                    <option value="ROLE">ロール指定</option>
                  </select>
                  <select value={approver.userId ?? ""} onChange={(e) => updateApprover(stepIndex, approverIndex, { userId: e.target.value })} className="rounded-xl border px-3 py-2" disabled={approver.approverType !== "USER"}>
                    <option value="">ユーザー</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>{user.name}</option>
                    ))}
                  </select>
                  <select value={approver.roleMasterId ?? ""} onChange={(e) => updateApprover(stepIndex, approverIndex, { roleMasterId: e.target.value })} className="rounded-xl border px-3 py-2" disabled={approver.approverType !== "ROLE"}>
                    <option value="">ロール</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                  <select value={approver.departmentId ?? ""} onChange={(e) => updateApprover(stepIndex, approverIndex, { departmentId: e.target.value })} className="rounded-xl border px-3 py-2" disabled={approver.approverType !== "DEPARTMENT_MANAGER"}>
                    <option value="">部署</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>{department.name}</option>
                    ))}
                  </select>
                </div>
              ))}
              <button type="button" onClick={() => updateStep(stepIndex, { approvers: [...step.approvers, { approverType: "COMPANY_ADMIN" }] })} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">
                承認者を追加
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => setSteps((current) => [...current, emptyStep(current.length + 1)])} className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-black">
          ステップを追加
        </button>
        <button disabled={saving} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60">
          {saving ? "保存中..." : route ? "更新する" : "作成する"}
        </button>
        {route && (
          <button type="button" disabled={saving} onClick={remove} className="rounded-xl bg-red-50 px-4 py-3 text-sm font-black text-red-700 disabled:cursor-wait disabled:opacity-60">
            削除
          </button>
        )}
      </div>

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
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black text-slate-500">{label}</span>
      <input type={type} value={value} required={required} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
    </label>
  );
}
