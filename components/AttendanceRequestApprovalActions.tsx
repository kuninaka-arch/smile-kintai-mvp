"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CorrectionStatus, RequestStatus, RequestType } from "@prisma/client";

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

const correctionStatusLabels: Record<CorrectionStatus, string> = {
  PENDING: "申請中",
  APPROVED: "承認済み",
  REJECTED: "却下"
};

function InfoItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-black text-slate-500">{label}</p>
      <p className={`mt-1 break-words text-sm font-bold text-slate-900 ${mono ? "font-mono" : ""}`}>{value || "-"}</p>
    </div>
  );
}

async function readErrorMessage(response: Response) {
  try {
    const data = (await response.json()) as { error?: unknown; message?: unknown };
    if (typeof data.error === "string") return data.error;
    if (typeof data.message === "string") return data.message;
  } catch {
    // Non-JSON responses fall through to the generic message.
  }
  return "承認処理に失敗しました。時間をおいて再度お試しください。";
}

export function AttendanceRequestApprovalActions({
  requestType,
  status,
  legacyCorrectionRequestId,
  legacyCorrectionStatus
}: {
  requestType: RequestType;
  status: RequestStatus;
  legacyCorrectionRequestId: string;
  legacyCorrectionStatus: CorrectionStatus | null;
}) {
  const router = useRouter();
  const [loadingStatus, setLoadingStatus] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAttendanceCorrection = requestType === "ATTENDANCE_CORRECTION";
  const isPending = status === "PENDING";
  const legacyCorrectionStatusLabel = legacyCorrectionStatus ? correctionStatusLabels[legacyCorrectionStatus] ?? legacyCorrectionStatus : "-";
  const statusMismatched = !!legacyCorrectionStatus && status !== legacyCorrectionStatus;
  const canOperate = isAttendanceCorrection && isPending && !!legacyCorrectionRequestId && legacyCorrectionStatus === "PENDING";
  const isLoading = loadingStatus !== null;
  const panelClassName = canOperate ? "border-orange-200 bg-orange-50" : "border-slate-200 bg-white";

  async function submit(nextStatus: "APPROVED" | "REJECTED") {
    if (!canOperate || isLoading) return;
    setLoadingStatus(nextStatus);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/corrections/${legacyCorrectionRequestId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });

      if (!response.ok) {
        setError(await readErrorMessage(response));
        return;
      }

      setMessage(nextStatus === "APPROVED" ? "承認しました。" : "却下しました。");
      router.refresh();
    } catch {
      setError("通信に失敗しました。ネットワーク状態を確認して再度お試しください。");
    } finally {
      setLoadingStatus(null);
    }
  }

  return (
    <section className={`rounded-3xl border p-5 shadow-sm ${panelClassName}`}>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900">承認操作</h2>
          <p className="mt-1 text-sm font-bold text-slate-600">
            打刻修正申請のみ、既存の打刻修正承認APIを使って承認・却下できます。
          </p>
        </div>
        <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${statusClassNames[status]}`}>
          {statusLabels[status] ?? status}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <InfoItem label="共通申請ステータス" value={statusLabels[status] ?? status} />
        <InfoItem label="既存打刻修正申請ステータス" value={legacyCorrectionStatusLabel} />
        <InfoItem label="申請種別" value={requestTypeLabels[requestType] ?? requestType} />
        <InfoItem label="既存申請ID" value={legacyCorrectionRequestId || "-"} mono />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          disabled={!canOperate || isLoading}
          onClick={() => submit("APPROVED")}
          className={`rounded-xl px-5 py-2.5 text-sm font-black text-white ${
            canOperate && !isLoading ? "bg-green-600 hover:bg-green-700" : "cursor-not-allowed bg-green-600 opacity-45"
          }`}
        >
          {loadingStatus === "APPROVED" ? "処理中..." : "承認"}
        </button>
        <button
          disabled={!canOperate || isLoading}
          onClick={() => submit("REJECTED")}
          className={`rounded-xl px-5 py-2.5 text-sm font-black text-white ${
            canOperate && !isLoading ? "bg-red-600 hover:bg-red-700" : "cursor-not-allowed bg-red-600 opacity-45"
          }`}
        >
          {loadingStatus === "REJECTED" ? "処理中..." : "却下"}
        </button>
        {isLoading && <span className="text-sm font-bold text-slate-600">処理中です。しばらくお待ちください。</span>}
      </div>

      <div className="mt-4 rounded-2xl bg-white/70 p-4 text-sm font-bold leading-6 text-slate-700">
        {!isAttendanceCorrection && <p>この申請種別の共通承認UIはまだ未対応です。</p>}
        {isAttendanceCorrection && !isPending && <p>この申請は処理済みです。</p>}
        {isAttendanceCorrection && isPending && !legacyCorrectionRequestId && <p>既存申請IDがないため、この画面からは操作できません。</p>}
        {isAttendanceCorrection && isPending && legacyCorrectionRequestId && !legacyCorrectionStatus && (
          <p>対応する既存の打刻修正申請が見つかりません。この画面からは承認・却下できません。</p>
        )}
        {statusMismatched && <p className="mt-2 text-amber-700">共通申請と既存申請のステータスが一致していません。既存申請側を正として確認してください。</p>}
        {isAttendanceCorrection && isPending && legacyCorrectionStatus && legacyCorrectionStatus !== "PENDING" && (
          <p>既存申請はすでに処理済みです。この画面からは承認・却下できません。</p>
        )}
        {canOperate && <p>この操作は既存の打刻修正申請APIを呼び出します。AttendanceRequestは既存API側のsoft同期で更新されます。</p>}
      </div>

      {message && <p className="mt-3 rounded-2xl bg-green-50 p-3 text-sm font-black text-green-700">{message}</p>}
      {error && <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-black text-red-700">{error}</p>}
    </section>
  );
}
