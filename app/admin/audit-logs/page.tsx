import Link from "next/link";
import { Prisma } from "@prisma/client";
import { AdminSidebar } from "@/components/AdminSidebar";
import { requireAdmin } from "@/components/RequireAuth";
import { prisma } from "@/lib/prisma";

const pageSize = 50;

const actionLabels: Record<string, string> = {
  CREATE_CORRECTION: "打刻修正申請",
  APPROVE_CORRECTION: "打刻修正承認",
  REJECT_CORRECTION: "打刻修正却下",
  CREATE_LEAVE: "休暇申請",
  APPROVE_LEAVE: "休暇承認",
  REJECT_LEAVE: "休暇却下",
  SAVE_SHIFT_BULK: "シフト一括保存",
  EXPORT_REPORT: "帳票出力",
  UPDATE_COMPANY: "会社設定変更",
  CREATE_EMPLOYEE: "社員追加",
  UPDATE_EMPLOYEE: "社員変更",
  CREATE_WORK_PATTERN: "勤務パターン追加",
  UPDATE_WORK_PATTERN: "勤務パターン変更",
  SAVE_STAFFING_RULES: "人員配置基準変更",
  SAVE_FTE_RULE: "常勤換算基準変更",
  SEED_QUALIFICATIONS: "標準資格追加",
  CREATE_QUALIFICATION: "資格マスタ追加",
  UPDATE_QUALIFICATION: "資格マスタ変更",
  ASSIGN_QUALIFICATION: "スタッフ資格付与",
  REMOVE_QUALIFICATION: "スタッフ資格解除",
  SAVE_QUALIFICATION_RULES: "資格別必要人数変更",
  CREATE_FAQ: "FAQ追加",
  UPDATE_FAQ: "FAQ編集",
  DELETE_FAQ: "FAQ削除"
};

const targetTypeLabels: Record<string, string> = {
  CORRECTION: "打刻修正",
  LEAVE: "休暇申請",
  SHIFT: "シフト",
  REPORT: "帳票",
  COMPANY: "会社",
  EMPLOYEE: "社員",
  WORK_PATTERN: "勤務パターン",
  STAFFING_RULE: "人員配置基準",
  FTE_RULE: "常勤換算基準",
  QUALIFICATION: "資格マスタ",
  USER_QUALIFICATION: "スタッフ資格",
  QUALIFICATION_RULE: "資格別必要人数",
  AI_FAQ: "AI問い合わせFAQ"
};

function labelFor(map: Record<string, string>, value: string | null | undefined) {
  if (!value) return "-";
  return map[value] ?? value;
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function tokyoDateStart(value: string) {
  return new Date(`${value}T00:00:00+09:00`);
}

function tokyoDateEnd(value: string) {
  return new Date(`${value}T23:59:59.999+09:00`);
}

function prettyJson(value: unknown) {
  if (value === null || value === undefined) return "なし";
  return JSON.stringify(value, null, 2);
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  return search.toString();
}

export default async function AuditLogsPage({
  searchParams
}: {
  searchParams: {
    from?: string;
    to?: string;
    userId?: string;
    action?: string;
    targetType?: string;
    page?: string;
  };
}) {
  const session = await requireAdmin();
  const page = Math.max(1, Number(searchParams.page ?? 1) || 1);

  const where: Prisma.AuditLogWhereInput = {
    companyId: session.user.companyId
  };

  if (searchParams.from || searchParams.to) {
    where.createdAt = {};
    if (searchParams.from) where.createdAt.gte = tokyoDateStart(searchParams.from);
    if (searchParams.to) where.createdAt.lte = tokyoDateEnd(searchParams.to);
  }
  if (searchParams.userId) where.actorUserId = searchParams.userId;
  if (searchParams.action) where.action = searchParams.action;
  if (searchParams.targetType) where.targetType = searchParams.targetType;

  const [logs, total, users] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.auditLog.count({ where }),
    prisma.user.findMany({
      where: { companyId: session.user.companyId },
      select: { id: true, name: true, email: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }]
    })
  ]);

  const userMap = new Map(users.map((user) => [user.id, user]));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const baseParams = {
    from: searchParams.from,
    to: searchParams.to,
    userId: searchParams.userId,
    action: searchParams.action,
    targetType: searchParams.targetType
  };

  return (
    <main className="min-h-screen bg-slate-100">
      <AdminSidebar active="audit-logs" />

      <section className="lg:ml-64">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-black text-blue-700">監査・内部統制</p>
              <h1 className="text-2xl font-black text-slate-900">監査ログ</h1>
              <p className="mt-1 text-sm text-slate-500">重要操作の操作者、日時、変更内容を確認できます。</p>
            </div>
            <Link href="/admin" className="rounded-xl border bg-white px-4 py-2 text-sm font-black text-slate-700">
              ダッシュボードへ
            </Link>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-5 py-6">
          <section className="mb-5 rounded-3xl bg-white p-5 shadow-sm">
            <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <label className="text-sm font-bold text-slate-700">
                開始日
                <input name="from" type="date" defaultValue={searchParams.from ?? ""} className="mt-1 w-full rounded-xl border px-3 py-2" />
              </label>
              <label className="text-sm font-bold text-slate-700">
                終了日
                <input name="to" type="date" defaultValue={searchParams.to ?? ""} className="mt-1 w-full rounded-xl border px-3 py-2" />
              </label>
              <label className="text-sm font-bold text-slate-700">
                操作者
                <select name="userId" defaultValue={searchParams.userId ?? ""} className="mt-1 w-full rounded-xl border px-3 py-2">
                  <option value="">すべて</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-bold text-slate-700">
                操作種別
                <select name="action" defaultValue={searchParams.action ?? ""} className="mt-1 w-full rounded-xl border px-3 py-2">
                  <option value="">すべて</option>
                  {Object.entries(actionLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-bold text-slate-700">
                対象種別
                <select name="targetType" defaultValue={searchParams.targetType ?? ""} className="mt-1 w-full rounded-xl border px-3 py-2">
                  <option value="">すべて</option>
                  {Object.entries(targetTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end gap-2">
                <button className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white">検索</button>
                <Link href="/admin/audit-logs" className="rounded-xl border px-4 py-2.5 text-sm font-black text-slate-700">
                  解除
                </Link>
              </div>
            </form>
          </section>

          <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">操作履歴一覧</h2>
                <p className="text-sm text-slate-500">全{total}件中 {logs.length}件を表示しています。</p>
              </div>
              <div className="flex items-center gap-2 text-sm font-bold">
                <Link
                  href={`/admin/audit-logs?${buildQuery({ ...baseParams, page: Math.max(1, page - 1) })}`}
                  className={`rounded-xl border px-4 py-2 ${page <= 1 ? "pointer-events-none opacity-40" : "bg-white text-slate-700"}`}
                >
                  前へ
                </Link>
                <span className="rounded-xl bg-slate-100 px-4 py-2 text-slate-700">
                  {page} / {totalPages}
                </span>
                <Link
                  href={`/admin/audit-logs?${buildQuery({ ...baseParams, page: Math.min(totalPages, page + 1) })}`}
                  className={`rounded-xl border px-4 py-2 ${page >= totalPages ? "pointer-events-none opacity-40" : "bg-white text-slate-700"}`}
                >
                  次へ
                </Link>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="p-4">操作日時</th>
                    <th className="p-4">操作者</th>
                    <th className="p-4">操作内容</th>
                    <th className="p-4">対象種別</th>
                    <th className="p-4">対象ID</th>
                    <th className="p-4">IPアドレス</th>
                    <th className="p-4">user agent</th>
                    <th className="p-4">詳細</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const actor = log.actorUserId ? userMap.get(log.actorUserId) : null;
                    return (
                      <tr key={log.id} className="border-t align-top hover:bg-slate-50">
                        <td className="p-4 font-bold text-slate-900">{formatDateTime(log.createdAt)}</td>
                        <td className="p-4">
                          <p className="font-black text-slate-900">{actor?.name ?? "不明"}</p>
                          <p className="text-xs font-bold text-slate-500">{actor?.email ?? log.actorUserId ?? "-"}</p>
                        </td>
                        <td className="p-4">
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                            {labelFor(actionLabels, log.action)}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-slate-700">{labelFor(targetTypeLabels, log.targetType)}</td>
                        <td className="max-w-[180px] truncate p-4 font-mono text-xs text-slate-600">{log.targetId ?? "-"}</td>
                        <td className="p-4 font-mono text-xs text-slate-600">{log.ipAddress ?? "-"}</td>
                        <td className="max-w-[260px] truncate p-4 text-xs text-slate-500" title={log.userAgent ?? ""}>
                          {log.userAgent ?? "-"}
                        </td>
                        <td className="p-4">
                          <details className="group">
                            <summary className="cursor-pointer rounded-xl bg-slate-900 px-3 py-2 text-center text-xs font-black text-white">
                              詳細
                            </summary>
                            <div className="mt-3 grid gap-3 rounded-2xl bg-slate-50 p-3">
                              <div>
                                <p className="mb-1 text-xs font-black text-slate-500">beforeJson</p>
                                <pre className="max-h-72 overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100">{prettyJson(log.beforeJson)}</pre>
                              </div>
                              <div>
                                <p className="mb-1 text-xs font-black text-slate-500">afterJson</p>
                                <pre className="max-h-72 overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100">{prettyJson(log.afterJson)}</pre>
                              </div>
                              <div className="grid gap-2 text-xs font-bold text-slate-600 md:grid-cols-2">
                                <p>IPアドレス: {log.ipAddress ?? "-"}</p>
                                <p>user agent: {log.userAgent ?? "-"}</p>
                              </div>
                            </div>
                          </details>
                        </td>
                      </tr>
                    );
                  })}

                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-10 text-center font-bold text-slate-500">
                        条件に一致する監査ログはありません。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
