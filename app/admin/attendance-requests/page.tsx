import Link from "next/link";
import { Prisma, RequestStatus, RequestType } from "@prisma/client";
import { AdminSidebar } from "@/components/AdminSidebar";
import { requireAdmin } from "@/components/RequireAuth";
import { prisma } from "@/lib/prisma";

const pageSize = 50;

const requestTypeLabels: Record<RequestType, string> = {
  ATTENDANCE_CORRECTION: "打刻修正",
  OVERTIME: "残業",
  HOLIDAY_WORK: "休日出勤",
  NIGHT_WORK: "深夜勤務",
  PAID_LEAVE: "有休",
  SUBSTITUTE_LEAVE: "代休",
  MATERNITY_LEAVE: "産休",
  CHILDCARE_LEAVE: "育休",
  SHORT_TIME_WORK: "時短勤務"
};

const statusLabels: Record<RequestStatus, string> = {
  DRAFT: "下書き",
  PENDING: "申請中",
  APPROVED: "承認済み",
  REJECTED: "却下",
  RETURNED: "差戻し",
  CANCELED: "取消"
};

const statusClassNames: Record<RequestStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  PENDING: "bg-orange-50 text-orange-700",
  APPROVED: "bg-green-50 text-green-700",
  REJECTED: "bg-red-50 text-red-700",
  RETURNED: "bg-yellow-50 text-yellow-700",
  CANCELED: "bg-slate-100 text-slate-500"
};

const actionLabels: Record<string, string> = {
  CREATE: "作成",
  SUBMIT: "提出",
  APPROVE: "承認",
  REJECT: "却下",
  RETURN: "差戻し",
  CANCEL: "取消",
  UPDATE: "更新"
};

function formatDateTime(date: Date | null | undefined) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatDate(date: Date | null | undefined) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function getPayloadValue(payloadJson: unknown, key: string): string {
  if (!payloadJson || typeof payloadJson !== "object" || Array.isArray(payloadJson)) return "";
  const value = (payloadJson as Record<string, unknown>)[key];
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
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

function isRequestType(value: string | undefined): value is RequestType {
  return !!value && Object.values(RequestType).includes(value as RequestType);
}

function isRequestStatus(value: string | undefined): value is RequestStatus {
  return !!value && Object.values(RequestStatus).includes(value as RequestStatus);
}

export default async function AttendanceRequestsPage({
  searchParams
}: {
  searchParams: {
    requestType?: string;
    status?: string;
    page?: string;
  };
}) {
  const session = await requireAdmin();
  const page = Math.max(1, Number(searchParams.page ?? 1) || 1);

  const where: Prisma.AttendanceRequestWhereInput = {
    companyId: session.user.companyId
  };
  const selectedRequestType = isRequestType(searchParams.requestType) ? searchParams.requestType : undefined;
  const selectedStatus = isRequestStatus(searchParams.status) ? searchParams.status : undefined;

  if (selectedRequestType) where.requestType = selectedRequestType;
  if (selectedStatus) where.status = selectedStatus;

  const [requests, total] = await Promise.all([
    prisma.attendanceRequest.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            departmentMaster: { select: { id: true, code: true, name: true } }
          }
        },
        approvalHistories: {
          include: {
            actorUser: { select: { id: true, name: true, email: true } }
          },
          orderBy: { createdAt: "asc" }
        }
      },
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.attendanceRequest.count({ where })
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const baseParams = {
    requestType: selectedRequestType,
    status: selectedStatus
  };

  return (
    <main className="min-h-screen bg-slate-100">
      <AdminSidebar active="attendance-requests" />

      <section className="lg:ml-64">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-black text-blue-700">共通申請基盤</p>
              <h1 className="text-2xl font-black text-slate-900">共通申請一覧</h1>
              <p className="mt-1 text-sm text-slate-500">AttendanceRequest に併記録された申請を閲覧専用で確認できます。</p>
            </div>
            <Link href="/admin" className="rounded-xl border bg-white px-4 py-2 text-sm font-black text-slate-700">
              ダッシュボードへ
            </Link>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-5 py-6">
          <section className="mb-5 rounded-3xl bg-white p-5 shadow-sm">
            <form className="grid gap-3 md:grid-cols-3">
              <label className="text-sm font-bold text-slate-700">
                申請種別
                <select name="requestType" defaultValue={selectedRequestType ?? ""} className="mt-1 w-full rounded-xl border px-3 py-2">
                  <option value="">すべて</option>
                  {Object.entries(requestTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-bold text-slate-700">
                ステータス
                <select name="status" defaultValue={selectedStatus ?? ""} className="mt-1 w-full rounded-xl border px-3 py-2">
                  <option value="">すべて</option>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end gap-2">
                <button className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white">検索</button>
                <Link href="/admin/attendance-requests" className="rounded-xl border px-4 py-2.5 text-sm font-black text-slate-700">
                  解除
                </Link>
              </div>
            </form>
          </section>

          <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">申請一覧</h2>
                <p className="text-sm text-slate-500">全{total}件中 {requests.length}件を表示しています。</p>
                <p className="mt-1 text-xs font-bold text-slate-400">横にスクロールできます</p>
              </div>
              <div className="flex items-center gap-2 text-sm font-bold">
                <Link
                  href={`/admin/attendance-requests?${buildQuery({ ...baseParams, page: Math.max(1, page - 1) })}`}
                  className={`rounded-xl border px-4 py-2 ${page <= 1 ? "pointer-events-none opacity-40" : "bg-white text-slate-700"}`}
                >
                  前へ
                </Link>
                <span className="rounded-xl bg-slate-100 px-4 py-2 text-slate-700">
                  {page} / {totalPages}
                </span>
                <Link
                  href={`/admin/attendance-requests?${buildQuery({ ...baseParams, page: Math.min(totalPages, page + 1) })}`}
                  className={`rounded-xl border px-4 py-2 ${page >= totalPages ? "pointer-events-none opacity-40" : "bg-white text-slate-700"}`}
                >
                  次へ
                </Link>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1300px] text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="p-4">申請日時</th>
                    <th className="p-4">申請者</th>
                    <th className="p-4">部署</th>
                    <th className="p-4">申請種別</th>
                    <th className="p-4">ステータス</th>
                    <th className="p-4">対象日</th>
                    <th className="p-4">タイトル</th>
                    <th className="p-4">承認ルート</th>
                    <th className="p-4">現在ステップ</th>
                    <th className="p-4">既存申請ID</th>
                    <th className="p-4">詳細</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => {
                    const approvalRouteName = getPayloadValue(request.payloadJson, "approvalRouteName");
                    const legacyCorrectionRequestId = getPayloadValue(request.payloadJson, "legacyCorrectionRequestId");
                    const departmentName = request.user.departmentMaster?.name ?? request.user.department ?? "-";

                    return (
                      <tr key={request.id} className="border-t align-top hover:bg-slate-50">
                        <td className="p-4 font-bold text-slate-900">{formatDateTime(request.submittedAt ?? request.createdAt)}</td>
                        <td className="p-4">
                          <p className="font-black text-slate-900">{request.user.name}</p>
                          <p className="text-xs font-bold text-slate-500">{request.user.email}</p>
                        </td>
                        <td className="p-4 font-bold text-slate-700">{departmentName}</td>
                        <td className="p-4 font-bold text-slate-700">{requestTypeLabels[request.requestType] ?? request.requestType}</td>
                        <td className="p-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClassNames[request.status]}`}>
                            {statusLabels[request.status] ?? request.status}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-slate-700">{formatDate(request.targetDate)}</td>
                        <td className="max-w-[180px] p-4 font-bold text-slate-800">{request.title ?? "-"}</td>
                        <td className="max-w-[220px] p-4 font-bold text-slate-700">{approvalRouteName || "-"}</td>
                        <td className="p-4 font-mono text-xs text-slate-700">{request.currentStepOrder ?? "-"}</td>
                        <td className="max-w-[190px] truncate p-4 font-mono text-xs text-slate-600" title={legacyCorrectionRequestId}>
                          {legacyCorrectionRequestId || "-"}
                        </td>
                        <td className="p-4">
                          <Link
                            href={`/admin/attendance-requests/${request.id}`}
                            className="mb-2 inline-flex rounded-xl border bg-white px-3 py-2 text-center text-xs font-black text-slate-700"
                          >
                            詳細ページ
                          </Link>
                          <details className="group">
                            <summary className="cursor-pointer rounded-xl bg-slate-900 px-3 py-2 text-center text-xs font-black text-white">
                              詳細
                            </summary>
                            <div className="mt-3 grid min-w-[520px] gap-4 rounded-2xl bg-slate-50 p-4">
                              <div>
                                <p className="mb-2 text-xs font-black text-slate-500">payload概要</p>
                                <dl className="grid gap-2 text-xs font-bold text-slate-700 md:grid-cols-2">
                                  <div>
                                    <dt className="text-slate-400">source</dt>
                                    <dd>{getPayloadValue(request.payloadJson, "source") || "-"}</dd>
                                  </div>
                                  <div>
                                    <dt className="text-slate-400">legacyCorrectionRequestId</dt>
                                    <dd className="font-mono">{legacyCorrectionRequestId || "-"}</dd>
                                  </div>
                                  <div>
                                    <dt className="text-slate-400">requestedType</dt>
                                    <dd>{getPayloadValue(request.payloadJson, "requestedType") || "-"}</dd>
                                  </div>
                                  <div>
                                    <dt className="text-slate-400">requestedTimeText</dt>
                                    <dd>{getPayloadValue(request.payloadJson, "requestedTimeText") || "-"}</dd>
                                  </div>
                                  <div className="md:col-span-2">
                                    <dt className="text-slate-400">reason</dt>
                                    <dd>{getPayloadValue(request.payloadJson, "reason") || "-"}</dd>
                                  </div>
                                  <div>
                                    <dt className="text-slate-400">approvalRouteName</dt>
                                    <dd>{approvalRouteName || "-"}</dd>
                                  </div>
                                  <div>
                                    <dt className="text-slate-400">approvalRouteMatchType</dt>
                                    <dd>{getPayloadValue(request.payloadJson, "approvalRouteMatchType") || "-"}</dd>
                                  </div>
                                </dl>
                              </div>

                              <div>
                                <p className="mb-2 text-xs font-black text-slate-500">ApprovalHistory</p>
                                <div className="grid gap-2">
                                  {request.approvalHistories.map((history) => (
                                    <div key={history.id} className="rounded-2xl bg-white p-3 text-xs shadow-sm">
                                      <div className="flex flex-wrap items-center gap-2 font-black text-slate-900">
                                        <span>{formatDateTime(history.createdAt)}</span>
                                        <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">{actionLabels[history.action] ?? history.action}</span>
                                      </div>
                                      <div className="mt-2 grid gap-1 font-bold text-slate-600 md:grid-cols-2">
                                        <p>actor: {history.actorUser?.name ?? "-"}</p>
                                        <p>
                                          status: {history.fromStatus ?? "-"} → {history.toStatus ?? "-"}
                                        </p>
                                        <p>stepOrder: {history.stepOrder ?? "-"}</p>
                                        <p>comment: {history.comment ?? "-"}</p>
                                      </div>
                                    </div>
                                  ))}
                                  {request.approvalHistories.length === 0 && (
                                    <p className="rounded-2xl bg-white p-3 text-xs font-bold text-slate-500">履歴はまだありません。</p>
                                  )}
                                </div>
                              </div>

                              <div>
                                <p className="mb-2 text-xs font-black text-slate-500">payloadJson</p>
                                <pre className="max-h-72 overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100">{prettyJson(request.payloadJson)}</pre>
                              </div>
                            </div>
                          </details>
                        </td>
                      </tr>
                    );
                  })}

                  {requests.length === 0 && (
                    <tr>
                      <td colSpan={11} className="p-10 text-center font-bold text-slate-500">
                        共通申請はまだありません。
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
