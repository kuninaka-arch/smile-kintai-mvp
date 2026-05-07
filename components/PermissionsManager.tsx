"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Role = { id: string; code: string; name: string };
type User = { id: string; name: string; email: string };
type Department = { id: string; name: string };
type RolePermission = {
  id: string;
  roleMasterId: string;
  feature: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canExportCsv: boolean;
  canExportPdf: boolean;
  canExportExcel: boolean;
  canManagePermission: boolean;
};
type UserDepartmentPermission = {
  id: string;
  userId: string;
  departmentId?: string | null;
  scope: "SELF" | "OWN_DEPARTMENT" | "SELECTED_DEPARTMENTS" | "ALL_COMPANY";
  canView: boolean;
  canEdit: boolean;
  canApprove: boolean;
  canExport: boolean;
};

const features = [
  ["attendance", "勤怠"],
  ["requests", "申請"],
  ["approval", "承認"],
  ["leaves", "休暇"],
  ["shifts", "シフト"],
  ["exports", "出力"],
  ["masters", "マスタ"],
  ["auditLogs", "監査ログ"],
  ["permissions", "権限"]
];

const operationFields = [
  ["canView", "閲覧"],
  ["canCreate", "登録"],
  ["canEdit", "編集"],
  ["canDelete", "削除"],
  ["canApprove", "承認"],
  ["canExportCsv", "CSV"],
  ["canExportPdf", "PDF"],
  ["canExportExcel", "Excel"],
  ["canManagePermission", "権限変更"]
] as const;

export function PermissionsManager({
  roles,
  users,
  departments,
  rolePermissions,
  userDepartmentPermissions
}: {
  roles: Role[];
  users: User[];
  departments: Department[];
  rolePermissions: RolePermission[];
  userDepartmentPermissions: UserDepartmentPermission[];
}) {
  const router = useRouter();
  const [savingKey, setSavingKey] = useState("");
  const [message, setMessage] = useState("");
  const [userId, setUserId] = useState(users[0]?.id ?? "");
  const [departmentId, setDepartmentId] = useState("");
  const [scope, setScope] = useState<UserDepartmentPermission["scope"]>("SELF");
  const [canView, setCanView] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [canApprove, setCanApprove] = useState(false);
  const [canExport, setCanExport] = useState(false);

  function findPermission(roleMasterId: string, feature: string) {
    return rolePermissions.find((permission) => permission.roleMasterId === roleMasterId && permission.feature === feature);
  }

  async function saveRolePermission(role: Role, feature: string, field: (typeof operationFields)[number][0], checked: boolean) {
    const key = `${role.id}:${feature}:${field}`;
    if (savingKey) return;
    setSavingKey(key);
    setMessage("");
    const current = findPermission(role.id, feature);
    const payload = {
      roleMasterId: role.id,
      feature,
      canView: current?.canView ?? false,
      canCreate: current?.canCreate ?? false,
      canEdit: current?.canEdit ?? false,
      canDelete: current?.canDelete ?? false,
      canApprove: current?.canApprove ?? false,
      canExportCsv: current?.canExportCsv ?? false,
      canExportPdf: current?.canExportPdf ?? false,
      canExportExcel: current?.canExportExcel ?? false,
      canManagePermission: current?.canManagePermission ?? false,
      [field]: checked
    };

    const res = await fetch("/api/admin/permissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    setSavingKey("");
    if (res.ok) {
      setMessage("ロール権限を保存しました。");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "ロール権限の保存に失敗しました。");
    }
  }

  async function saveUserDepartmentPermission(e: React.FormEvent) {
    e.preventDefault();
    if (savingKey) return;
    setSavingKey("user-department");
    setMessage("");
    const res = await fetch("/api/admin/user-department-permissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, departmentId, scope, canView, canEdit, canApprove, canExport })
    });

    setSavingKey("");
    if (res.ok) {
      setMessage("ユーザー部署権限を保存しました。");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "ユーザー部署権限の保存に失敗しました。");
    }
  }

  async function deleteUserDepartmentPermission(id: string) {
    if (savingKey) return;
    setSavingKey(id);
    setMessage("");
    const res = await fetch("/api/admin/user-department-permissions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    setSavingKey("");
    if (res.ok) {
      setMessage("ユーザー部署権限を削除しました。");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "削除に失敗しました。");
    }
  }

  return (
    <div className="space-y-6">
      {message && <p className="rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-700">{message}</p>}

      <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
        <div className="border-b p-5">
          <h2 className="text-lg font-black">ロール別権限</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="p-3">ロール</th>
                <th className="p-3">機能</th>
                {operationFields.map(([, label]) => (
                  <th key={label} className="p-3 text-center">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roles.flatMap((role) =>
                features.map(([feature, label]) => {
                  const permission = findPermission(role.id, feature);
                  return (
                    <tr key={`${role.id}-${feature}`} className="border-t">
                      <td className="p-3 font-black">{role.name}</td>
                      <td className="p-3">{label}</td>
                      {operationFields.map(([field]) => {
                        const key = `${role.id}:${feature}:${field}`;
                        return (
                          <td key={field} className="p-3 text-center">
                            <input
                              type="checkbox"
                              disabled={Boolean(savingKey)}
                              checked={Boolean(permission?.[field])}
                              onChange={(e) => saveRolePermission(role, feature, field, e.target.checked)}
                              aria-label={`${role.name} ${label} ${field}`}
                            />
                            {savingKey === key && <span className="ml-1 text-[10px] font-bold text-blue-600">保存中</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <form onSubmit={saveUserDepartmentPermission} className="rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-black">ユーザー部署権限を追加</h2>
          <div className="space-y-3">
            <Select label="ユーザー" value={userId} onChange={setUserId} options={users.map((user) => ({ value: user.id, label: `${user.name} / ${user.email}` }))} />
            <Select label="部署" value={departmentId} onChange={setDepartmentId} options={[{ value: "", label: "部署指定なし" }, ...departments.map((department) => ({ value: department.id, label: department.name }))]} />
            <Select
              label="部署スコープ"
              value={scope}
              onChange={(value) => setScope(value as UserDepartmentPermission["scope"])}
              options={[
                { value: "SELF", label: "自分のみ" },
                { value: "OWN_DEPARTMENT", label: "所属部署のみ" },
                { value: "SELECTED_DEPARTMENTS", label: "指定部署" },
                { value: "ALL_COMPANY", label: "全社" }
              ]}
            />
            <label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm font-bold">
              <input type="checkbox" checked={canView} onChange={(e) => setCanView(e.target.checked)} />
              閲覧
            </label>
            <label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm font-bold">
              <input type="checkbox" checked={canEdit} onChange={(e) => setCanEdit(e.target.checked)} />
              編集
            </label>
            <label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm font-bold">
              <input type="checkbox" checked={canApprove} onChange={(e) => setCanApprove(e.target.checked)} />
              承認
            </label>
            <label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm font-bold">
              <input type="checkbox" checked={canExport} onChange={(e) => setCanExport(e.target.checked)} />
              出力
            </label>
            <button disabled={savingKey === "user-department"} className="w-full rounded-xl bg-blue-600 px-4 py-3 font-black text-white disabled:cursor-wait disabled:opacity-60">
              {savingKey === "user-department" ? "保存中..." : "保存する"}
            </button>
          </div>
        </form>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
          <div className="border-b p-5">
            <h2 className="text-lg font-black">ユーザー別部署権限一覧</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="p-4">ユーザー</th>
                  <th className="p-4">部署</th>
                  <th className="p-4">スコープ</th>
                  <th className="p-4">操作</th>
                  <th className="p-4">削除</th>
                </tr>
              </thead>
              <tbody>
                {userDepartmentPermissions.map((permission) => {
                  const user = users.find((item) => item.id === permission.userId);
                  const department = departments.find((item) => item.id === permission.departmentId);
                  return (
                    <tr key={permission.id} className="border-t">
                      <td className="p-4 font-black">{user?.name ?? permission.userId}</td>
                      <td className="p-4">{department?.name ?? "指定なし"}</td>
                      <td className="p-4">{permission.scope}</td>
                      <td className="p-4">
                        {[
                          permission.canView ? "閲覧" : "",
                          permission.canEdit ? "編集" : "",
                          permission.canApprove ? "承認" : "",
                          permission.canExport ? "出力" : ""
                        ].filter(Boolean).join(" / ") || "-"}
                      </td>
                      <td className="p-4">
                        <button type="button" disabled={Boolean(savingKey)} onClick={() => deleteUserDepartmentPermission(permission.id)} className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-700 disabled:cursor-wait disabled:opacity-60">
                          {savingKey === permission.id ? "削除中..." : "削除"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="text-xs font-black text-slate-500">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2">
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
