-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "IndustryType" AS ENUM ('general', 'care', 'restaurant', 'cleaning', 'construction');

-- CreateEnum
CREATE TYPE "WorkPatternCategory" AS ENUM ('EARLY', 'DAY', 'LATE', 'NIGHT', 'AFTER_NIGHT', 'OFF', 'PAID_LEAVE', 'REQUESTED_OFF');

-- CreateEnum
CREATE TYPE "AttendanceType" AS ENUM ('CLOCK_IN', 'CLOCK_OUT', 'BREAK_START', 'BREAK_END');

-- CreateEnum
CREATE TYPE "CorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LeaveRequestUnit" AS ENUM ('FULL_DAY', 'HOUR');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "industryType" "IndustryType" NOT NULL DEFAULT 'general',
    "closingDay" INTEGER NOT NULL DEFAULT 31,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendancePeriodLock" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "closingDay" INTEGER NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "lockedByUserId" TEXT,
    "unlockedAt" TIMESTAMP(3),
    "unlockedByUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendancePeriodLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "department" TEXT,
    "departmentId" TEXT,
    "positionMasterId" TEXT,
    "employmentTypeId" TEXT,
    "roleMasterId" TEXT,
    "jobType" TEXT,
    "isFullTime" BOOLEAN NOT NULL DEFAULT false,
    "monthlyScheduledMinutes" INTEGER,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiHelpFaq" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "keywords" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiHelpFaq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiHelpUnansweredQuestion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "question" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiHelpUnansweredQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiHelpConversation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "matchedFaqId" TEXT,
    "resolved" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiHelpConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportExportHistory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "targetMonth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportExportHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AttendanceType" NOT NULL,
    "stampedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 60,
    "patternCode" TEXT,
    "workPatternId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareStaffingRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "category" "WorkPatternCategory" NOT NULL,
    "requiredCount" INTEGER NOT NULL DEFAULT 0,
    "floorId" TEXT,
    "departmentId" TEXT,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareStaffingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareFullTimeEquivalentRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "standardMonthlyMinutes" INTEGER NOT NULL DEFAULT 9600,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareFullTimeEquivalentRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualificationMaster" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualificationMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserQualification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "qualificationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserQualification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareQualificationRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "qualificationId" TEXT NOT NULL,
    "requiredCount" INTEGER NOT NULL DEFAULT 0,
    "floorId" TEXT,
    "departmentId" TEXT,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareQualificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaidLeave" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "usedDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaidLeave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceCorrectionRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "requestedType" "AttendanceType" NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "CorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "adminComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceCorrectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmploymentType" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmploymentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionMaster" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PositionMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleMaster" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveTypeMaster" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "allowHourly" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveTypeMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "unit" "LeaveRequestUnit" NOT NULL DEFAULT 'FULL_DAY',
    "hours" DOUBLE PRECISION,
    "reason" TEXT NOT NULL,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
    "adminComment" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkPattern" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "WorkPatternCategory" NOT NULL DEFAULT 'DAY',
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 60,
    "colorClass" TEXT NOT NULL DEFAULT 'bg-emerald-400 text-slate-900',
    "displayColor" TEXT NOT NULL DEFAULT 'emerald',
    "isHoliday" BOOLEAN NOT NULL DEFAULT false,
    "isNightShift" BOOLEAN NOT NULL DEFAULT false,
    "autoCreateAfterNight" BOOLEAN NOT NULL DEFAULT false,
    "countsAsWork" BOOLEAN NOT NULL DEFAULT true,
    "countsAsLeave" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkPattern_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");

-- CreateIndex
CREATE INDEX "AttendancePeriodLock_companyId_periodStart_periodEnd_idx" ON "AttendancePeriodLock"("companyId", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "AttendancePeriodLock_companyId_periodKey_key" ON "AttendancePeriodLock"("companyId", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_companyId_displayOrder_idx" ON "User"("companyId", "displayOrder");

-- CreateIndex
CREATE INDEX "AiHelpFaq_companyId_isActive_sortOrder_idx" ON "AiHelpFaq"("companyId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "AiHelpUnansweredQuestion_companyId_resolved_createdAt_idx" ON "AiHelpUnansweredQuestion"("companyId", "resolved", "createdAt");

-- CreateIndex
CREATE INDEX "AiHelpUnansweredQuestion_userId_createdAt_idx" ON "AiHelpUnansweredQuestion"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiHelpConversation_companyId_createdAt_idx" ON "AiHelpConversation"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "AiHelpConversation_userId_createdAt_idx" ON "AiHelpConversation"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiHelpConversation_matchedFaqId_idx" ON "AiHelpConversation"("matchedFaqId");

-- CreateIndex
CREATE INDEX "ReportExportHistory_companyId_createdAt_idx" ON "ReportExportHistory"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "ReportExportHistory_companyId_reportType_targetMonth_idx" ON "ReportExportHistory"("companyId", "reportType", "targetMonth");

-- CreateIndex
CREATE INDEX "ReportExportHistory_userId_createdAt_idx" ON "ReportExportHistory"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AttendanceLog_companyId_userId_stampedAt_idx" ON "AttendanceLog"("companyId", "userId", "stampedAt");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_createdAt_idx" ON "AuditLog"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "Shift_companyId_userId_workDate_idx" ON "Shift"("companyId", "userId", "workDate");

-- CreateIndex
CREATE INDEX "ShiftEvent_companyId_workDate_idx" ON "ShiftEvent"("companyId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftEvent_companyId_workDate_key" ON "ShiftEvent"("companyId", "workDate");

-- CreateIndex
CREATE INDEX "CareStaffingRule_companyId_category_idx" ON "CareStaffingRule"("companyId", "category");

-- CreateIndex
CREATE INDEX "CareStaffingRule_companyId_floorId_departmentId_idx" ON "CareStaffingRule"("companyId", "floorId", "departmentId");

-- CreateIndex
CREATE INDEX "CareFullTimeEquivalentRule_companyId_idx" ON "CareFullTimeEquivalentRule"("companyId");

-- CreateIndex
CREATE INDEX "QualificationMaster_companyId_idx" ON "QualificationMaster"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "QualificationMaster_companyId_name_key" ON "QualificationMaster"("companyId", "name");

-- CreateIndex
CREATE INDEX "UserQualification_userId_idx" ON "UserQualification"("userId");

-- CreateIndex
CREATE INDEX "UserQualification_qualificationId_idx" ON "UserQualification"("qualificationId");

-- CreateIndex
CREATE UNIQUE INDEX "UserQualification_userId_qualificationId_key" ON "UserQualification"("userId", "qualificationId");

-- CreateIndex
CREATE INDEX "CareQualificationRule_companyId_qualificationId_idx" ON "CareQualificationRule"("companyId", "qualificationId");

-- CreateIndex
CREATE INDEX "CareQualificationRule_companyId_floorId_departmentId_idx" ON "CareQualificationRule"("companyId", "floorId", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "CareQualificationRule_companyId_qualificationId_key" ON "CareQualificationRule"("companyId", "qualificationId");

-- CreateIndex
CREATE INDEX "PaidLeave_companyId_userId_idx" ON "PaidLeave"("companyId", "userId");

-- CreateIndex
CREATE INDEX "AttendanceCorrectionRequest_companyId_userId_targetDate_idx" ON "AttendanceCorrectionRequest"("companyId", "userId", "targetDate");

-- CreateIndex
CREATE INDEX "Department_companyId_sortOrder_idx" ON "Department"("companyId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Department_companyId_code_key" ON "Department"("companyId", "code");

-- CreateIndex
CREATE INDEX "EmploymentType_companyId_sortOrder_idx" ON "EmploymentType"("companyId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "EmploymentType_companyId_code_key" ON "EmploymentType"("companyId", "code");

-- CreateIndex
CREATE INDEX "PositionMaster_companyId_sortOrder_idx" ON "PositionMaster"("companyId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PositionMaster_companyId_code_key" ON "PositionMaster"("companyId", "code");

-- CreateIndex
CREATE INDEX "RoleMaster_companyId_sortOrder_idx" ON "RoleMaster"("companyId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "RoleMaster_companyId_code_key" ON "RoleMaster"("companyId", "code");

-- CreateIndex
CREATE INDEX "LeaveTypeMaster_companyId_sortOrder_idx" ON "LeaveTypeMaster"("companyId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveTypeMaster_companyId_code_key" ON "LeaveTypeMaster"("companyId", "code");

-- CreateIndex
CREATE INDEX "LeaveRequest_companyId_userId_targetDate_idx" ON "LeaveRequest"("companyId", "userId", "targetDate");

-- CreateIndex
CREATE INDEX "LeaveRequest_companyId_status_idx" ON "LeaveRequest"("companyId", "status");

-- CreateIndex
CREATE INDEX "WorkPattern_companyId_sortOrder_idx" ON "WorkPattern"("companyId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "WorkPattern_companyId_code_key" ON "WorkPattern"("companyId", "code");

-- AddForeignKey
ALTER TABLE "AttendancePeriodLock" ADD CONSTRAINT "AttendancePeriodLock_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_positionMasterId_fkey" FOREIGN KEY ("positionMasterId") REFERENCES "PositionMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_employmentTypeId_fkey" FOREIGN KEY ("employmentTypeId") REFERENCES "EmploymentType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleMasterId_fkey" FOREIGN KEY ("roleMasterId") REFERENCES "RoleMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiHelpFaq" ADD CONSTRAINT "AiHelpFaq_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiHelpUnansweredQuestion" ADD CONSTRAINT "AiHelpUnansweredQuestion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiHelpUnansweredQuestion" ADD CONSTRAINT "AiHelpUnansweredQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiHelpConversation" ADD CONSTRAINT "AiHelpConversation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiHelpConversation" ADD CONSTRAINT "AiHelpConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiHelpConversation" ADD CONSTRAINT "AiHelpConversation_matchedFaqId_fkey" FOREIGN KEY ("matchedFaqId") REFERENCES "AiHelpFaq"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportExportHistory" ADD CONSTRAINT "ReportExportHistory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportExportHistory" ADD CONSTRAINT "ReportExportHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceLog" ADD CONSTRAINT "AttendanceLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_workPatternId_fkey" FOREIGN KEY ("workPatternId") REFERENCES "WorkPattern"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftEvent" ADD CONSTRAINT "ShiftEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareStaffingRule" ADD CONSTRAINT "CareStaffingRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareFullTimeEquivalentRule" ADD CONSTRAINT "CareFullTimeEquivalentRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualificationMaster" ADD CONSTRAINT "QualificationMaster_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQualification" ADD CONSTRAINT "UserQualification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQualification" ADD CONSTRAINT "UserQualification_qualificationId_fkey" FOREIGN KEY ("qualificationId") REFERENCES "QualificationMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareQualificationRule" ADD CONSTRAINT "CareQualificationRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareQualificationRule" ADD CONSTRAINT "CareQualificationRule_qualificationId_fkey" FOREIGN KEY ("qualificationId") REFERENCES "QualificationMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaidLeave" ADD CONSTRAINT "PaidLeave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCorrectionRequest" ADD CONSTRAINT "AttendanceCorrectionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentType" ADD CONSTRAINT "EmploymentType_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionMaster" ADD CONSTRAINT "PositionMaster_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleMaster" ADD CONSTRAINT "RoleMaster_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveTypeMaster" ADD CONSTRAINT "LeaveTypeMaster_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveTypeMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkPattern" ADD CONSTRAINT "WorkPattern_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
