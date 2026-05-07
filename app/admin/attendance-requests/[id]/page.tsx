import Link from "next/link";
import { notFound } from "next/navigation";
import { RequestStatus, RequestType } from "@prisma/client";
import { AdminSidebar } from "@/components/AdminSidebar";
import { requireAdmin } from "@/components/RequireAuth";
import { prisma } from "@/lib/prisma";

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
  if (value === null || value === undefined) return "";
  return String(value);
}

function prettyJson(value: unknown) {
  if (value === null || value === undefined) return "なし";
  return JSON.stringify(value, null, 2);
}

function InfoItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-black text-slate-500">{label}</p>
      <p className={`mt-1 break-words text-sm font-bold text-slate-900 ${mono ? "font-mono" : ""}`}>{value || "-"}</p>
    </div>
  );
}

function ApprovalOperationPanel({
  requestType,
  status,
  legacyCorrectionRequestId
}: {
  requestType: RequestType;
  status: RequestStatus;
  legacyCorrectionRequestId: string;
}) {
  const isAttendanceCorrection = requestType === "ATTENDANCE_CORRECTION";
  const isPending = status === "PENDING";
  const panelClassName =
    isAttendanceCorrection && isPending
      ? "border-orange-200 bg-orange-50"
      : "border-slate-200 bg-white";

  return (
    <section className={`rounded-3xl border p-5 shadow-sm ${panelClassName}`}>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900">承認操作</h2>
          <p className="mt-1 text-sm font-bold text-slate-600">
            現在は閲覧専用です。共通申請詳細からの承認・却下は次Phaseで有効化予定です。
          </p>
        </div>
        <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${statusClassNames[status]}`}>
          {statusLabels[status] ?? status}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <InfoItem label="現在のステータス" value={statusLabels[status] ?? status} />
        <InfoItem label="申請種別" value={requestTypeLabels[requestType] ?? requestType} />
        <InfoItem label="既存申請ID" value={legacyCorrectionRequestId || "-"} mono />
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button disabled className="cursor-not-allowed rounded-xl bg-green-600 px-5 py-2.5 text-sm font-black text-white opacity-45">
          承認
        </button>
        <button disabled className="cursor-not-allowed rounded-xl bg-red-600 px-5 py-2.5 text-sm font-black text-white opacity-45">
          却下
        </button>
      </div>

      <div className="mt-4 rounded-2xl bg-white/70 p-4 text-sm font-bold leading-6 text-slate-700">
        {!isAttendanceCorrection && <p>この申請種別の共通承認UIはまだ未対応です。</p>}
        {isAttendanceCorrection && !isPending && <p>この申請は処理済みです。</p>}
        {isAttendanceCorrection && isPending && (
          <p>打刻修正申請の承認・却下は、既存の打刻修正申請画面から行ってください。</p>
        )}
      </div>
    </section>
  );
}

export default async function AttendanceRequestDetailPage({ params }: { params: { id: string } }) {
  const session = await requireAdmin();
  const request = await prisma.attendanceRequest.findFirst({
    where: {
      id: params.id,
      companyId: session.user.companyId
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          department: true,
          departmentMaster: {
            select: { id: true, code: true, name: true }
          }
        }
      },
      approvalHistories: {
        include: {
          actorUser: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (!request) notFound();

  const departmentName = request.user.departmentMaster?.name ?? request.user.department ?? "-";
  const approvalRouteId = getPayloadValue(request.payloadJson, "approvalRouteId");
  const approvalRouteName = getPayloadValue(request.payloadJson, "approvalRouteName");
  const approvalRouteMatchType = getPayloadValue(request.payloadJson, "approvalRouteMatchType");
  const payloadDepartmentId = getPayloadValue(request.payloadJson, "departmentId");
  const source = getPayloadValue(request.payloadJson, "source");
  const legacyCorrectionRequestId = getPayloadValue(request.payloadJson, "legacyCorrectionRequestId");
  const requestedType = getPayloadValue(request.payloadJson, "requestedType");
  const requestedTimeText = getPayloadValue(request.payloadJson, "requestedTimeText");
  const reason = getPayloadValue(request.payloadJson, "reason");

  return (
    <main className="min-h-screen bg-slate-100">
      <AdminSidebar active="attendance-requests" />

      <section className="lg:ml-64">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-black text-blue-700">共通申請基盤</p>
              <h1 className="text-2xl font-black text-slate-900">共通申請詳細</h1>
              <p className="mt-1 text-sm text-slate-500">AttendanceRequest の内容、payloadJson、ApprovalHistory を閲覧専用で確認します。</p>
            </div>
            <Link href="/admin/attendance-requests" className="rounded-xl border bg-white px-4 py-2 text-sm font-black text-slate-700">
              一覧へ戻る
            </Link>
          </div>
        </header>

        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6">
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">基本情報</h2>
                <p className="text-sm text-slate-500">申請の状態と対象情報を確認できます。</p>
              </div>
              <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${statusClassNames[request.status]}`}>
                {statusLabels[request.status] ?? request.status}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <InfoItem label="申請ID" value={request.id} mono />
              <InfoItem label="申請日時" value={formatDateTime(request.submittedAt ?? request.createdAt)} />
              <InfoItem label="申請者" value={`${request.user.name} / ${request.user.email}`} />
              <InfoItem label="部署" value={departmentName} />
              <InfoItem label="申請種別" value={requestTypeLabels[request.requestType] ?? request.requestType} />
              <InfoItem label="ステータス" value={statusLabels[request.status] ?? request.status} />
              <InfoItem label="対象日" value={formatDate(request.targetDate)} />
              <InfoItem label="タイトル" value={request.title ?? "-"} />
              <InfoItem label="現在ステップ" value={request.currentStepOrder ? String(request.currentStepOrder) : "-"} />
              <InfoItem label="解決日時" value={formatDateTime(request.resolvedAt)} />
            </div>
          </section>

          <ApprovalOperationPanel requestType={request.requestType} status={request.status} legacyCorrectionRequestId={legacyCorrectionRequestId} />

          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-black text-slate-900">承認ルート情報</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <InfoItem label="承認ルートID" value={approvalRouteId} mono />
              <InfoItem label="承認ルート名" value={approvalRouteName} />
              <InfoItem label="承認ルート判定種別" value={approvalRouteMatchType} />
              <InfoItem label="departmentId" value={payloadDepartmentId} mono />
            </div>
          </section>

          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-black text-slate-900">既存申請情報</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <InfoItem label="source" value={source} />
              <InfoItem label="legacyCorrectionRequestId" value={legacyCorrectionRequestId} mono />
              <InfoItem label="requestedType" value={requestedType} />
              <InfoItem label="requestedTimeText" value={requestedTimeText} />
              <div className="rounded-2xl bg-slate-50 p-4 md:col-span-2">
                <p className="text-xs font-black text-slate-500">reason</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm font-bold text-slate-900">{reason || "-"}</p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-black text-slate-900">ApprovalHistory</h2>
            <div className="grid gap-3">
              {request.approvalHistories.map((history) => (
                <div key={history.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2 font-black text-slate-900">
                    <span>{formatDateTime(history.createdAt)}</span>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">{actionLabels[history.action] ?? history.action}</span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm font-bold text-slate-600 md:grid-cols-2 xl:grid-cols-4">
                    <p>操作者: {history.actorUser?.name ?? "-"}</p>
                    <p>
                      ステータス: {history.fromStatus ?? "-"} → {history.toStatus ?? "-"}
                    </p>
                    <p>stepOrder: {history.stepOrder ?? "-"}</p>
                    <p>comment: {history.comment ?? "-"}</p>
                  </div>
                </div>
              ))}
              {request.approvalHistories.length === 0 && (
                <p className="rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500">履歴はまだありません。</p>
              )}
            </div>
          </section>

          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <details>
              <summary className="cursor-pointer text-lg font-black text-slate-900">payloadJson全文</summary>
              <pre className="mt-4 max-h-[520px] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">{prettyJson(request.payloadJson)}</pre>
            </details>
          </section>
        </div>
      </section>
    </main>
  );
}
