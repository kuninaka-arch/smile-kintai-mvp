import Link from "next/link";
import { notFound } from "next/navigation";
import { RequestStatus, RequestType } from "@prisma/client";
import type { CorrectionStatus, LeaveRequestStatus } from "@prisma/client";
import { AdminSidebar } from "@/components/AdminSidebar";
import { AttendanceRequestApprovalActions } from "@/components/AttendanceRequestApprovalActions";
import { requireAdmin } from "@/components/RequireAuth";
import { resolveApprovalPermission } from "@/lib/approval-permissions";
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

const requirementLabels: Record<string, string> = {
  ANY_ONE: "誰か1人",
  ALL_REQUIRED: "全員承認"
};

const actionClassNames: Record<string, string> = {
  SUBMIT: "bg-blue-50 text-blue-700",
  APPROVE: "bg-green-50 text-green-700",
  REJECT: "bg-red-50 text-red-700",
  RETURN: "bg-yellow-50 text-yellow-700",
  CANCEL: "bg-slate-100 text-slate-600",
  CREATE: "bg-slate-100 text-slate-600",
  UPDATE: "bg-slate-100 text-slate-600"
};

const stepStateClassNames: Record<string, string> = {
  完了: "bg-green-50 text-green-700",
  承認待ち: "bg-orange-50 text-orange-700",
  却下: "bg-red-50 text-red-700",
  未到達: "bg-slate-100 text-slate-600"
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

function tokyoDateRange(date: Date) {
  const key = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
  const start = new Date(`${key}T00:00:00+09:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
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

function isLeaveRequestType(requestType: RequestType) {
  return ["PAID_LEAVE", "SUBSTITUTE_LEAVE", "MATERNITY_LEAVE", "CHILDCARE_LEAVE"].includes(requestType);
}

function formatLeaveDuration(unit: string | null | undefined, hours: number | null | undefined) {
  if (unit === "HOUR") return hours == null ? "時間休" : `${hours}時間`;
  return "1日";
}

function InfoItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-black text-slate-500">{label}</p>
      <p className={`mt-1 break-words text-sm font-bold text-slate-900 ${mono ? "font-mono" : ""}`}>{value || "-"}</p>
    </div>
  );
}

function Badge({ label, className }: { label: string; className: string }) {
  return <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${className}`}>{label}</span>;
}

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-black text-slate-900">{title}</h2>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
    </div>
  );
}

function formatActor(user: { name: string; email: string } | null | undefined) {
  if (!user) return "-";
  return `${user.name} / ${user.email}`;
}

function ApprovalPermissionDiagnosis({
  permission
}: {
  permission: Awaited<ReturnType<typeof resolveApprovalPermission>>;
}) {
  const matchedApprover = permission.matchedApprover;

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900">承認可否診断</h2>
          <p className="mt-1 text-sm font-bold text-slate-600">現在のログインユーザーが、この申請の現Stepを承認できるかを表示します。</p>
        </div>
        <span
          className={`w-fit rounded-full px-3 py-1 text-xs font-black ${
            permission.canApprove ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {permission.canApprove ? "承認可能" : "承認不可"}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <InfoItem label="canApprove" value={permission.canApprove ? "true / 承認可能" : "false / 承認不可"} />
        <InfoItem label="reason" value={permission.reason} />
        <InfoItem label="matchedApprover.approverType" value={matchedApprover?.approverType ?? "該当承認者なし"} />
        <InfoItem label="matchedApprover.approverId" value={matchedApprover?.approverId ?? "-"} mono />
        <InfoItem label="matchedApprover.delegatedFromUserId" value={matchedApprover?.delegatedFromUserId ?? "-"} mono />
        <InfoItem label="requirement" value={permission.requirement ?? "-"} />
        <InfoItem
          label="stepCompleteAfterThisAction"
          value={permission.stepCompleteAfterThisAction === undefined ? "-" : String(permission.stepCompleteAfterThisAction)}
        />
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
  const legacyLeaveRequestId = getPayloadValue(request.payloadJson, "legacyLeaveRequestId");
  const sourceId = getPayloadValue(request.payloadJson, "sourceId");
  const leaveRequestId = legacyLeaveRequestId || sourceId;
  const requestedType = getPayloadValue(request.payloadJson, "requestedType");
  const requestedTimeText = getPayloadValue(request.payloadJson, "requestedTimeText");
  const reason = getPayloadValue(request.payloadJson, "reason");
  const isLeaveRequest = source === "LEAVE_REQUEST" || isLeaveRequestType(request.requestType);

  const approvalRoute = approvalRouteId
    ? await prisma.approvalRoute.findFirst({
        where: {
          id: approvalRouteId,
          companyId: session.user.companyId
        },
        include: {
          steps: {
            include: {
              approvers: {
                include: {
                  user: {
                    select: { id: true, name: true, email: true }
                  },
                  roleMaster: {
                    select: { id: true, code: true, name: true }
                  },
                  department: {
                    select: { id: true, code: true, name: true }
                  }
                }
              }
            },
            orderBy: { stepOrder: "asc" }
          }
        }
      })
    : null;
  const roleMasterIds = Array.from(
    new Set(
      approvalRoute?.steps
        .flatMap((step) => step.approvers)
        .map((approver) => approver.roleMasterId)
        .filter((id): id is string => Boolean(id)) ?? []
    )
  );
  const roleApproverUsers = roleMasterIds.length
    ? await prisma.user.findMany({
        where: {
          companyId: session.user.companyId,
          roleMasterId: { in: roleMasterIds }
        },
        select: { id: true, name: true, email: true, roleMasterId: true },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }]
      })
    : [];
  const roleApproverUsersByRoleId = new Map<string, typeof roleApproverUsers>();
  for (const user of roleApproverUsers) {
    if (!user.roleMasterId) continue;
    roleApproverUsersByRoleId.set(user.roleMasterId, [...(roleApproverUsersByRoleId.get(user.roleMasterId) ?? []), user]);
  }

  const legacyCorrectionRequest = legacyCorrectionRequestId
    ? await prisma.attendanceCorrectionRequest.findFirst({
        where: {
          id: legacyCorrectionRequestId,
          companyId: session.user.companyId
        },
        select: {
          id: true,
          status: true,
          targetDate: true,
          requestedType: true,
          requestedAt: true
        }
      })
    : null;
  const legacyCorrectionStatus: CorrectionStatus | null = legacyCorrectionRequest?.status ?? null;

  const leaveRequest =
    isLeaveRequest && leaveRequestId
      ? await prisma.leaveRequest.findFirst({
          where: {
            id: leaveRequestId,
            companyId: session.user.companyId
          },
          include: {
            leaveType: true,
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
            }
          }
        })
      : null;
  const legacyLeaveRequestStatus: LeaveRequestStatus | null = leaveRequest?.status ?? null;
  let leaveHasExistingShift = false;
  if (leaveRequest?.unit === "FULL_DAY") {
    const { start, end } = tokyoDateRange(leaveRequest.targetDate);
    leaveHasExistingShift = Boolean(
      await prisma.shift.findFirst({
        where: {
          companyId: session.user.companyId,
          userId: leaveRequest.userId,
          workDate: { gte: start, lt: end }
        },
        select: { id: true }
      })
    );
  }

  const approvalPermission = await resolveApprovalPermission({
    attendanceRequestId: request.id,
    actorUserId: session.user.id,
    companyId: session.user.companyId
  });
  const currentStep = approvalRoute?.steps.find((step) => step.stepOrder === request.currentStepOrder) ?? null;
  const leaveApprovalMayOverwriteShift = Boolean(
    leaveHasExistingShift &&
      currentStep &&
      !approvalRoute?.steps.some((step) => step.stepOrder > currentStep.stepOrder)
  );
  const summaryState =
    request.status === "APPROVED"
      ? "最終承認済み"
      : request.status === "REJECTED"
        ? "却下済み"
        : request.status === "PENDING"
          ? "承認待ち"
          : statusLabels[request.status] ?? request.status;
  const stepProgress =
    approvalRoute?.steps.map((step) => {
      const histories = request.approvalHistories.filter((history) => history.stepOrder === step.stepOrder);
      const approvedHistories = histories.filter((history) => history.action === "APPROVE");
      const rejectedHistories = histories.filter((history) => history.action === "REJECT");
      const approvedUserIds = new Set(approvedHistories.map((history) => history.actorUserId).filter(Boolean));
      const userCandidates = step.approvers.flatMap((approver) => {
        if (approver.approverType === "USER" && approver.user) {
          return [{ id: approver.user.id, label: formatActor(approver.user), source: "USER指定" }];
        }
        if (approver.approverType === "ROLE" && approver.roleMasterId) {
          return (roleApproverUsersByRoleId.get(approver.roleMasterId) ?? []).map((user) => ({
            id: user.id,
            label: formatActor(user),
            source: `ROLE指定: ${approver.roleMaster?.name ?? approver.roleMaster?.code ?? "ロール"}`
          }));
        }
        return [];
      });
      const pendingUserNames = userCandidates
        .filter((candidate) => !approvedUserIds.has(candidate.id))
        .map((candidate) => `${candidate.label}（${candidate.source}）`);
      const unsupportedPendingLabels = step.approvers
        .filter((approver) => approver.approverType !== "USER" && approver.approverType !== "ROLE")
        .map((approver) => {
          if (approver.approverType === "COMPANY_ADMIN") return "会社管理者（詳細表示未対応）";
          if (approver.approverType === "DEPARTMENT_MANAGER") {
            return `部署上長: ${approver.department?.name ?? "対象部署"}（詳細表示未対応）`;
          }
          return `${approver.approverType}（詳細表示未対応）`;
        });
      const knownRequiredUserIds = new Set(userCandidates.map((candidate) => candidate.id));
      const isRejected = request.status === "REJECTED" && (rejectedHistories.length > 0 || step.stepOrder === request.currentStepOrder);
      const isCompleted =
        !isRejected &&
        (step.requirement === "ANY_ONE"
          ? approvedHistories.length > 0
          : knownRequiredUserIds.size > 0
            ? Array.from(knownRequiredUserIds).every((id) => approvedUserIds.has(id))
            : approvedHistories.length > 0 || (request.status === "APPROVED" && step.stepOrder <= (request.currentStepOrder ?? step.stepOrder)));
      const isCurrentPending = request.status === "PENDING" && step.stepOrder === request.currentStepOrder;
      const state = isRejected ? "却下" : isCompleted ? "完了" : isCurrentPending ? "承認待ち" : "未到達";

      return {
        id: step.id,
        stepOrder: step.stepOrder,
        name: step.name,
        requirement: step.requirement,
        state,
        approvedHistories,
        rejectedHistories,
        pendingNames: state === "承認待ち" ? [...pendingUserNames, ...unsupportedPendingLabels] : [],
        approverSummary: step.approvers
          .map((approver) => {
            if (approver.approverType === "USER") return approver.user ? formatActor(approver.user) : "USER指定（未設定）";
            if (approver.approverType === "ROLE") return `ロール: ${approver.roleMaster?.name ?? approver.roleMaster?.code ?? "-"}`;
            if (approver.approverType === "DEPARTMENT_MANAGER") return `部署上長: ${approver.department?.name ?? "対象部署"}`;
            if (approver.approverType === "COMPANY_ADMIN") return "会社管理者";
            return approver.approverType;
          })
          .join(" / ")
      };
    }) ?? [];

  return (
    <main className="min-h-screen bg-slate-100">
      <AdminSidebar active="attendance-requests" />

      <section className="lg:ml-64">
        <header className="sticky top-0 z-10 border-b bg-white/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-black text-blue-700">共通申請基盤</p>
              <h1 className="text-2xl font-black text-slate-900">共通申請詳細</h1>
              <p className="mt-1 text-sm text-slate-500">AttendanceRequest、payloadJson、ApprovalHistory を確認します。</p>
            </div>
            <Link href="/admin/attendance-requests" className="rounded-xl border bg-white px-4 py-2 text-sm font-black text-slate-700">
              一覧へ戻る
            </Link>
          </div>
        </header>

        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6">
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <SectionTitle title="申請概要" description="共通申請の状態と対象情報です。" />
              <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${statusClassNames[request.status]}`}>
                {statusLabels[request.status] ?? request.status}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <InfoItem label="AttendanceRequest ID" value={request.id} mono />
              <InfoItem label="申請日時" value={formatDateTime(request.submittedAt ?? request.createdAt)} />
              <InfoItem label="申請者" value={`${request.user.name} / ${request.user.email}`} />
              <InfoItem label="所属部署" value={departmentName} />
              <InfoItem label="申請種別" value={requestTypeLabels[request.requestType] ?? request.requestType} />
              <InfoItem label="ステータス" value={statusLabels[request.status] ?? request.status} />
              <InfoItem label="対象日" value={formatDate(request.targetDate)} />
              <InfoItem label="タイトル" value={request.title ?? "-"} />
              <InfoItem label="現在Step" value={request.currentStepOrder ? String(request.currentStepOrder) : "-"} />
              <InfoItem label="解決日時" value={formatDateTime(request.resolvedAt)} />
            </div>
          </section>

          <AttendanceRequestApprovalActions
            requestType={request.requestType}
            status={request.status}
            legacyCorrectionRequestId={legacyCorrectionRequestId}
            legacyCorrectionStatus={legacyCorrectionStatus}
            legacyLeaveRequestId={leaveRequestId}
            legacyLeaveRequestStatus={legacyLeaveRequestStatus}
            leaveHasExistingShift={leaveHasExistingShift}
            leaveApprovalMayOverwriteShift={leaveApprovalMayOverwriteShift}
            canApproveByPermission={approvalPermission.canApprove}
            approvalPermissionReason={approvalPermission.reason}
          />

          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <SectionTitle title="承認状況サマリー" description="現在のStep、承認方式、処理状態をまとめて確認できます。" />
              <Badge label={summaryState} className={statusClassNames[request.status]} />
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <InfoItem label="申請ステータス" value={statusLabels[request.status] ?? request.status} />
              <InfoItem label="現在Step" value={request.currentStepOrder ? `Step ${request.currentStepOrder}` : "-"} />
              <InfoItem label="承認ルート名" value={approvalRoute?.name ?? approvalRouteName ?? "-"} />
              <InfoItem label="現在Stepの承認方式" value={currentStep ? requirementLabels[currentStep.requirement] ?? currentStep.requirement : approvalPermission.requirement ?? "-"} />
              <InfoItem label="承認待ち" value={request.status === "PENDING" ? "はい" : "いいえ"} />
              <InfoItem label="最終承認済み" value={request.status === "APPROVED" ? "はい" : "いいえ"} />
              <InfoItem label="却下済み" value={request.status === "REJECTED" ? "はい" : "いいえ"} />
              <InfoItem label="承認履歴件数" value={`${request.approvalHistories.length}件`} />
            </div>
          </section>

          <ApprovalPermissionDiagnosis permission={approvalPermission} />

          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <SectionTitle title="承認ルート情報" />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <InfoItem label="承認ルートID" value={approvalRouteId} mono />
              <InfoItem label="承認ルート名" value={approvalRouteName} />
              <InfoItem label="承認ルート判定種別" value={approvalRouteMatchType} />
              <InfoItem label="departmentId" value={payloadDepartmentId} mono />
            </div>
          </section>

          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <SectionTitle title="Stepごとの承認進捗" description="ApprovalStep と ApprovalHistory をもとに、表示用に進捗を整理しています。" />
            {stepProgress.length > 0 ? (
              <div className="grid gap-4">
                {stepProgress.map((step) => (
                  <div key={step.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-black text-slate-900">Step {step.stepOrder}：{step.name}</p>
                          <Badge label={step.state} className={stepStateClassNames[step.state]} />
                        </div>
                        <p className="mt-2 text-sm font-bold text-slate-600">
                          承認方式：{requirementLabels[step.requirement] ?? step.requirement}
                        </p>
                      </div>
                      <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-black text-slate-600">
                        承認者：{step.approverSummary || "-"}
                      </p>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl bg-green-50 p-4">
                        <p className="text-xs font-black text-green-700">承認済みユーザー</p>
                        <div className="mt-2 space-y-2 text-sm font-bold text-green-900">
                          {step.approvedHistories.length > 0 ? (
                            step.approvedHistories.map((history) => (
                              <p key={history.id}>
                                {formatActor(history.actorUser)} / {formatDateTime(history.createdAt)}
                                {history.comment ? ` / ${history.comment}` : ""}
                              </p>
                            ))
                          ) : (
                            <p>-</p>
                          )}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-orange-50 p-4">
                        <p className="text-xs font-black text-orange-700">未承認者</p>
                        <div className="mt-2 space-y-2 text-sm font-bold text-orange-900">
                          {step.pendingNames.length > 0 ? step.pendingNames.map((name) => <p key={name}>{name}</p>) : <p>-</p>}
                        </div>
                      </div>
                    </div>

                    {step.rejectedHistories.length > 0 && (
                      <div className="mt-3 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-800">
                        {step.rejectedHistories.map((history) => (
                          <p key={history.id}>
                            却下：{formatActor(history.actorUser)} / {formatDateTime(history.createdAt)}
                            {history.comment ? ` / ${history.comment}` : ""}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-600">
                承認ルート情報が見つからないため、Stepごとの進捗は表示できません。
              </p>
            )}
          </section>

          {request.requestType === "ATTENDANCE_CORRECTION" && (
            <section className="rounded-3xl bg-white p-5 shadow-sm">
              <SectionTitle title="打刻修正申請詳細" description="既存の打刻修正申請に紐づく情報です。" />
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <InfoItem label="source" value={source} />
                <InfoItem label="legacyCorrectionRequestId" value={legacyCorrectionRequestId} mono />
                <InfoItem label="既存申請ステータス" value={legacyCorrectionStatus ? legacyCorrectionStatus : "-"} />
                <InfoItem label="requestedType" value={requestedType || legacyCorrectionRequest?.requestedType || "-"} />
                <InfoItem label="requestedTimeText" value={requestedTimeText} />
                <InfoItem label="対象日" value={formatDate(legacyCorrectionRequest?.targetDate)} />
                <InfoItem label="申請打刻時刻" value={formatDateTime(legacyCorrectionRequest?.requestedAt)} />
                <div className="rounded-2xl bg-slate-50 p-4 md:col-span-2 xl:col-span-3">
                  <p className="text-xs font-black text-slate-500">reason</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm font-bold text-slate-900">{reason || "-"}</p>
                </div>
              </div>
            </section>
          )}

          {isLeaveRequest && (
            <section className="rounded-3xl bg-white p-5 shadow-sm">
              <SectionTitle title="休暇申請詳細" description="AttendanceRequest に紐づく LeaveRequest の内容です。" />
              {leaveRequest ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <InfoItem label="申請種別" value="休暇申請" />
                  <InfoItem label="申請者" value={`${leaveRequest.user.name} / ${leaveRequest.user.email}`} />
                  <InfoItem label="所属部署" value={leaveRequest.user.departmentMaster?.name ?? leaveRequest.user.department ?? departmentName} />
                  <InfoItem label="休暇種別" value={`${leaveRequest.leaveType.name} / ${leaveRequest.leaveType.code}`} />
                  <InfoItem label="取得開始日" value={formatDate(leaveRequest.targetDate)} />
                  <InfoItem label="取得終了日" value={formatDate(leaveRequest.targetDate)} />
                  <InfoItem label="取得日数" value={formatLeaveDuration(leaveRequest.unit, leaveRequest.hours)} />
                  <InfoItem label="LeaveRequestステータス" value={leaveRequest.status} />
                  <InfoItem label="申請日時" value={formatDateTime(leaveRequest.createdAt)} />
                  <InfoItem label="AttendanceRequest ID" value={request.id} mono />
                  <InfoItem label="LeaveRequest ID" value={leaveRequest.id} mono />
                  <InfoItem label="承認日時" value={formatDateTime(leaveRequest.approvedAt)} />
                  <div className="rounded-2xl bg-slate-50 p-4 md:col-span-2 xl:col-span-3">
                    <p className="text-xs font-black text-slate-500">申請理由</p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm font-bold text-slate-900">{leaveRequest.reason || "-"}</p>
                  </div>
                </div>
              ) : (
                <p className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-700">
                  紐づく LeaveRequest が見つかりません。AttendanceRequest ID: {request.id}
                  {leaveRequestId ? ` / LeaveRequest ID: ${leaveRequestId}` : ""}
                </p>
              )}
            </section>
          )}

          {!isLeaveRequest && request.requestType !== "ATTENDANCE_CORRECTION" && (
            <section className="rounded-3xl bg-white p-5 shadow-sm">
              <SectionTitle title="申請詳細" />
              <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-600">この申請種別の詳細表示は未対応です。</p>
            </section>
          )}

          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <SectionTitle title="承認履歴" description="提出・承認・却下の操作を時系列で表示します。" />
            <div className="grid gap-4">
              {request.approvalHistories.map((history) => (
                <div key={history.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-black text-slate-500">{formatDateTime(history.createdAt)}</p>
                      <p className="mt-1 text-base font-black text-slate-900">
                        {history.action === "SUBMIT" ? "申請者" : history.action === "REJECT" ? "却下者" : "承認者"}：{formatActor(history.actorUser)}
                      </p>
                    </div>
                    <Badge label={actionLabels[history.action] ?? history.action} className={actionClassNames[history.action] ?? "bg-slate-100 text-slate-600"} />
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <InfoItem label="操作" value={history.action} />
                    <InfoItem label="Step" value={history.stepOrder ? `Step ${history.stepOrder}` : "-"} />
                    <InfoItem label="ステータス遷移" value={`${history.fromStatus ?? "-"} -> ${history.toStatus ?? "-"}`} />
                    <div className="rounded-2xl bg-slate-50 p-4 md:col-span-3">
                      <p className="text-xs font-black text-slate-500">コメント / reason</p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm font-bold text-slate-900">{history.comment ?? "-"}</p>
                    </div>
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
