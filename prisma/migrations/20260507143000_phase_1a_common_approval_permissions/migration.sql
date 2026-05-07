-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('ATTENDANCE_CORRECTION', 'OVERTIME', 'HOLIDAY_WORK', 'NIGHT_WORK', 'PAID_LEAVE', 'SUBSTITUTE_LEAVE', 'MATERNITY_LEAVE', 'CHILDCARE_LEAVE', 'SHORT_TIME_WORK');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'RETURNED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ApprovalAction" AS ENUM ('CREATE', 'SUBMIT', 'APPROVE', 'REJECT', 'RETURN', 'CANCEL', 'UPDATE');

-- CreateEnum
CREATE TYPE "ApprovalRequirement" AS ENUM ('ANY_ONE', 'ALL_REQUIRED');

-- CreateEnum
CREATE TYPE "ApprovalApproverType" AS ENUM ('USER', 'ROLE', 'DEPARTMENT_MANAGER', 'COMPANY_ADMIN');

-- CreateEnum
CREATE TYPE "DepartmentScope" AS ENUM ('SELF', 'OWN_DEPARTMENT', 'SELECTED_DEPARTMENTS', 'ALL_COMPANY');

-- CreateTable
CREATE TABLE "AttendanceRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestType" "RequestType" NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT,
    "targetDate" TIMESTAMP(3),
    "targetDateFrom" TIMESTAMP(3),
    "targetDateTo" TIMESTAMP(3),
    "payloadJson" JSONB,
    "currentStepOrder" INTEGER,
    "submittedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AttendanceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalHistory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" "ApprovalAction" NOT NULL,
    "fromStatus" "RequestStatus",
    "toStatus" "RequestStatus",
    "stepOrder" INTEGER,
    "comment" TEXT,
    "delegatedFromUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApprovalHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRoute" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "departmentId" TEXT,
    "requestType" "RequestType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "conditionJson" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ApprovalRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalStep" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "requirement" "ApprovalRequirement" NOT NULL DEFAULT 'ANY_ONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ApprovalStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalStepApprover" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "approverType" "ApprovalApproverType" NOT NULL,
    "userId" TEXT,
    "roleMasterId" TEXT,
    "departmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApprovalStepApprover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalDelegate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "requestType" "RequestType",
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ApprovalDelegate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "roleMasterId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT false,
    "canCreate" BOOLEAN NOT NULL DEFAULT false,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,
    "canApprove" BOOLEAN NOT NULL DEFAULT false,
    "canExportCsv" BOOLEAN NOT NULL DEFAULT false,
    "canExportPdf" BOOLEAN NOT NULL DEFAULT false,
    "canExportExcel" BOOLEAN NOT NULL DEFAULT false,
    "canManagePermission" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDepartmentPermission" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT,
    "scope" "DepartmentScope" NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT true,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "canApprove" BOOLEAN NOT NULL DEFAULT false,
    "canExport" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserDepartmentPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceRequest_companyId_userId_createdAt_idx" ON "AttendanceRequest"("companyId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "AttendanceRequest_companyId_requestType_status_idx" ON "AttendanceRequest"("companyId", "requestType", "status");

-- CreateIndex
CREATE INDEX "AttendanceRequest_companyId_status_createdAt_idx" ON "AttendanceRequest"("companyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ApprovalHistory_companyId_requestId_createdAt_idx" ON "ApprovalHistory"("companyId", "requestId", "createdAt");

-- CreateIndex
CREATE INDEX "ApprovalHistory_companyId_actorUserId_createdAt_idx" ON "ApprovalHistory"("companyId", "actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ApprovalRoute_companyId_requestType_isActive_idx" ON "ApprovalRoute"("companyId", "requestType", "isActive");

-- CreateIndex
CREATE INDEX "ApprovalRoute_companyId_departmentId_idx" ON "ApprovalRoute"("companyId", "departmentId");

-- CreateIndex
CREATE INDEX "ApprovalStep_routeId_idx" ON "ApprovalStep"("routeId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalStep_routeId_stepOrder_key" ON "ApprovalStep"("routeId", "stepOrder");

-- CreateIndex
CREATE INDEX "ApprovalStepApprover_stepId_idx" ON "ApprovalStepApprover"("stepId");

-- CreateIndex
CREATE INDEX "ApprovalStepApprover_userId_idx" ON "ApprovalStepApprover"("userId");

-- CreateIndex
CREATE INDEX "ApprovalStepApprover_roleMasterId_idx" ON "ApprovalStepApprover"("roleMasterId");

-- CreateIndex
CREATE INDEX "ApprovalStepApprover_departmentId_idx" ON "ApprovalStepApprover"("departmentId");

-- CreateIndex
CREATE INDEX "ApprovalDelegate_companyId_fromUserId_startsAt_endsAt_idx" ON "ApprovalDelegate"("companyId", "fromUserId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "ApprovalDelegate_companyId_toUserId_startsAt_endsAt_idx" ON "ApprovalDelegate"("companyId", "toUserId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "RolePermission_companyId_feature_idx" ON "RolePermission"("companyId", "feature");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleMasterId_feature_key" ON "RolePermission"("roleMasterId", "feature");

-- CreateIndex
CREATE INDEX "UserDepartmentPermission_companyId_userId_idx" ON "UserDepartmentPermission"("companyId", "userId");

-- CreateIndex
CREATE INDEX "UserDepartmentPermission_companyId_departmentId_idx" ON "UserDepartmentPermission"("companyId", "departmentId");

-- AddForeignKey
ALTER TABLE "AttendanceRequest" ADD CONSTRAINT "AttendanceRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRequest" ADD CONSTRAINT "AttendanceRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalHistory" ADD CONSTRAINT "ApprovalHistory_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AttendanceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalHistory" ADD CONSTRAINT "ApprovalHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRoute" ADD CONSTRAINT "ApprovalRoute_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRoute" ADD CONSTRAINT "ApprovalRoute_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "ApprovalRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStepApprover" ADD CONSTRAINT "ApprovalStepApprover_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "ApprovalStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStepApprover" ADD CONSTRAINT "ApprovalStepApprover_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStepApprover" ADD CONSTRAINT "ApprovalStepApprover_roleMasterId_fkey" FOREIGN KEY ("roleMasterId") REFERENCES "RoleMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStepApprover" ADD CONSTRAINT "ApprovalStepApprover_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDelegate" ADD CONSTRAINT "ApprovalDelegate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDelegate" ADD CONSTRAINT "ApprovalDelegate_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDelegate" ADD CONSTRAINT "ApprovalDelegate_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleMasterId_fkey" FOREIGN KEY ("roleMasterId") REFERENCES "RoleMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDepartmentPermission" ADD CONSTRAINT "UserDepartmentPermission_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDepartmentPermission" ADD CONSTRAINT "UserDepartmentPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDepartmentPermission" ADD CONSTRAINT "UserDepartmentPermission_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
