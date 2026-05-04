import { LeaveRequestStatus, LeaveRequestUnit, PrismaClient, Role, WorkPatternCategory } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const departments = [
  { code: "CARE_1F", name: "介護1階" },
  { code: "CARE_2F", name: "介護2階" },
  { code: "NURSE", name: "看護" },
  { code: "REHAB", name: "リハビリ" },
  { code: "OFFICE", name: "事務" }
];

const positions = [
  { code: "DIRECTOR", name: "施設長" },
  { code: "OFFICE_MANAGER", name: "事務長" },
  { code: "NURSE_LEADER", name: "看護主任" },
  { code: "CARE_LEADER", name: "介護主任" },
  { code: "CARE_MANAGER", name: "ケアマネ" },
  { code: "STAFF", name: "一般職" }
];

const leaveTypes = [
  { code: "PAID", name: "有休", allowHourly: true },
  { code: "COMP", name: "代休", allowHourly: false },
  { code: "SPECIAL", name: "特別休暇", allowHourly: false },
  { code: "CHILDCARE", name: "育休", allowHourly: false },
  { code: "MATERNITY", name: "産休", allowHourly: false },
  { code: "BEREAVEMENT", name: "忌引き", allowHourly: false }
];

const careWorkPatterns = [
  { code: "E1", name: "早出1", startTime: "06:30", endTime: "15:30", breakMinutes: 60, colorClass: "bg-sky-300 text-slate-900", isHoliday: false },
  { code: "E2", name: "早出2", startTime: "07:00", endTime: "16:00", breakMinutes: 60, colorClass: "bg-sky-300 text-slate-900", isHoliday: false },
  { code: "E3", name: "早出3", startTime: "07:30", endTime: "16:30", breakMinutes: 60, colorClass: "bg-sky-300 text-slate-900", isHoliday: false },
  { code: "A", name: "通常A", startTime: "09:00", endTime: "18:00", breakMinutes: 60, colorClass: "bg-emerald-400 text-slate-900", isHoliday: false },
  { code: "D1", name: "通常1", startTime: "08:30", endTime: "17:30", breakMinutes: 60, colorClass: "bg-emerald-300 text-slate-900", isHoliday: false },
  { code: "D2", name: "通常2", startTime: "09:30", endTime: "18:30", breakMinutes: 60, colorClass: "bg-emerald-300 text-slate-900", isHoliday: false },
  { code: "D3", name: "日勤短", startTime: "10:00", endTime: "17:00", breakMinutes: 45, colorClass: "bg-emerald-200 text-slate-900", isHoliday: false },
  { code: "L1", name: "遅番1", startTime: "10:30", endTime: "19:30", breakMinutes: 60, colorClass: "bg-orange-300 text-slate-900", isHoliday: false },
  { code: "L2", name: "遅番2", startTime: "11:00", endTime: "20:00", breakMinutes: 60, colorClass: "bg-orange-300 text-slate-900", isHoliday: false },
  { code: "L3", name: "遅番3", startTime: "12:00", endTime: "21:00", breakMinutes: 60, colorClass: "bg-orange-300 text-slate-900", isHoliday: false },
  { code: "N1", name: "夜勤1", startTime: "16:00", endTime: "09:00", breakMinutes: 120, colorClass: "bg-indigo-300 text-slate-900", isHoliday: false },
  { code: "N2", name: "夜勤2", startTime: "16:30", endTime: "09:30", breakMinutes: 120, colorClass: "bg-indigo-300 text-slate-900", isHoliday: false },
  { code: "N3", name: "夜勤3", startTime: "17:00", endTime: "10:00", breakMinutes: 120, colorClass: "bg-indigo-300 text-slate-900", isHoliday: false },
  { code: "SN1", name: "準夜勤1", startTime: "13:00", endTime: "22:00", breakMinutes: 60, colorClass: "bg-violet-300 text-slate-900", isHoliday: false },
  { code: "SN2", name: "準夜勤2", startTime: "14:00", endTime: "23:00", breakMinutes: 60, colorClass: "bg-violet-300 text-slate-900", isHoliday: false },
  { code: "MN1", name: "深夜勤1", startTime: "22:00", endTime: "07:00", breakMinutes: 60, colorClass: "bg-purple-300 text-slate-900", isHoliday: false },
  { code: "P1", name: "時短P1", startTime: "09:00", endTime: "13:00", breakMinutes: 0, colorClass: "bg-teal-200 text-slate-900", isHoliday: false },
  { code: "P2", name: "時短P2", startTime: "13:00", endTime: "17:00", breakMinutes: 0, colorClass: "bg-teal-200 text-slate-900", isHoliday: false },
  { code: "P3", name: "時短P3", startTime: "10:00", endTime: "15:00", breakMinutes: 30, colorClass: "bg-teal-200 text-slate-900", isHoliday: false },
  { code: "P4", name: "入浴P", startTime: "09:30", endTime: "15:30", breakMinutes: 45, colorClass: "bg-cyan-200 text-slate-900", isHoliday: false },
  { code: "R1", name: "リハ日勤", startTime: "08:30", endTime: "17:30", breakMinutes: 60, colorClass: "bg-lime-300 text-slate-900", isHoliday: false },
  { code: "R2", name: "リハ短", startTime: "09:00", endTime: "16:00", breakMinutes: 45, colorClass: "bg-lime-200 text-slate-900", isHoliday: false },
  { code: "O1", name: "事務日勤", startTime: "08:45", endTime: "17:45", breakMinutes: 60, colorClass: "bg-stone-200 text-slate-900", isHoliday: false },
  { code: "MTG", name: "会議日", startTime: "09:00", endTime: "18:00", breakMinutes: 60, colorClass: "bg-blue-200 text-slate-900", isHoliday: false },
  { code: "OFF", name: "公休", startTime: "00:00", endTime: "00:00", breakMinutes: 0, colorClass: "bg-slate-200 text-slate-700", isHoliday: true },
  { code: "PAID", name: "有休", startTime: "00:00", endTime: "00:00", breakMinutes: 0, colorClass: "bg-amber-200 text-slate-900", isHoliday: true },
  { code: "COMP", name: "代休", startTime: "00:00", endTime: "00:00", breakMinutes: 0, colorClass: "bg-sky-200 text-slate-900", isHoliday: true },
  { code: "SPECIAL", name: "特別休暇", startTime: "00:00", endTime: "00:00", breakMinutes: 0, colorClass: "bg-violet-200 text-slate-900", isHoliday: true },
  { code: "CHILDCARE", name: "育休", startTime: "00:00", endTime: "00:00", breakMinutes: 0, colorClass: "bg-pink-200 text-slate-900", isHoliday: true },
  { code: "MATERNITY", name: "産休", startTime: "00:00", endTime: "00:00", breakMinutes: 0, colorClass: "bg-rose-200 text-slate-900", isHoliday: true },
  { code: "BEREAVEMENT", name: "忌引き", startTime: "00:00", endTime: "00:00", breakMinutes: 0, colorClass: "bg-slate-300 text-slate-900", isHoliday: true }
];

const lastNames = [
  "佐藤", "鈴木", "高橋", "田中", "伊藤", "渡辺", "山本", "中村", "小林", "加藤",
  "吉田", "山田", "佐々木", "山口", "松本", "井上", "木村", "林", "清水", "山崎"
];

const firstNames = [
  "花子", "太郎", "美咲", "翔太", "結衣", "大輔", "愛", "健太", "陽子", "拓也",
  "恵", "直人", "真由", "亮", "彩", "学", "由美", "誠", "千春", "優"
];

async function ensurePaidLeave(companyId: string, userId: string, grantedDays: number, usedDays: number) {
  const existing = await prisma.paidLeave.findFirst({ where: { companyId, userId } });
  if (existing) {
    await prisma.paidLeave.update({
      where: { id: existing.id },
      data: { grantedDays, usedDays }
    });
    return;
  }

  await prisma.paidLeave.create({
    data: { companyId, userId, grantedDays, usedDays }
  });
}

async function ensureTodayShift(companyId: string, userId: string, workPatternId: string, patternCode: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existing = await prisma.shift.findFirst({
    where: { companyId, userId, workDate: today }
  });

  if (existing) return;

  await prisma.shift.create({
    data: {
      companyId,
      userId,
      workDate: today,
      startTime: "09:00",
      endTime: "18:00",
      breakMinutes: 60,
      patternCode,
      workPatternId
    }
  });
}

async function ensureShiftForDate(companyId: string, userId: string, workDate: Date, pattern: {
  id: string;
  code: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
}) {
  const existing = await prisma.shift.findFirst({
    where: { companyId, userId, workDate }
  });

  const data = {
    startTime: pattern.startTime,
    endTime: pattern.endTime,
    breakMinutes: pattern.breakMinutes,
    patternCode: pattern.code,
    workPatternId: pattern.id
  };

  if (existing) {
    await prisma.shift.update({ where: { id: existing.id }, data });
    return;
  }

  await prisma.shift.create({
    data: { companyId, userId, workDate, ...data }
  });
}

function tokyoDate(year: number, month: number, day: number) {
  return new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00+09:00`);
}

async function upsertCareStaffingRule(companyId: string, category: WorkPatternCategory, requiredCount: number) {
  const existing = await prisma.careStaffingRule.findFirst({
    where: { companyId, category, floorId: null, departmentId: null }
  });

  if (existing) {
    await prisma.careStaffingRule.update({
      where: { id: existing.id },
      data: { requiredCount, effectiveFrom: null, effectiveTo: null }
    });
    return;
  }

  await prisma.careStaffingRule.create({
    data: { companyId, category, requiredCount }
  });
}

async function upsertFullTimeEquivalentRule(companyId: string, standardMonthlyMinutes: number) {
  const existing = await prisma.careFullTimeEquivalentRule.findFirst({ where: { companyId } });
  if (existing) {
    await prisma.careFullTimeEquivalentRule.update({
      where: { id: existing.id },
      data: { standardMonthlyMinutes }
    });
    return;
  }

  await prisma.careFullTimeEquivalentRule.create({
    data: { companyId, standardMonthlyMinutes }
  });
}

async function upsertLeaveRequest(data: {
  companyId: string;
  userId: string;
  leaveTypeId: string;
  targetDate: Date;
  reason: string;
  status: LeaveRequestStatus;
}) {
  const existing = await prisma.leaveRequest.findFirst({
    where: {
      companyId: data.companyId,
      userId: data.userId,
      leaveTypeId: data.leaveTypeId,
      targetDate: data.targetDate
    }
  });

  const updateData = {
    reason: data.reason,
    unit: LeaveRequestUnit.FULL_DAY,
    hours: null,
    status: data.status,
    approvedAt: data.status === LeaveRequestStatus.APPROVED ? new Date() : null
  };

  if (existing) {
    await prisma.leaveRequest.update({
      where: { id: existing.id },
      data: updateData
    });
    return;
  }

  await prisma.leaveRequest.create({
    data: {
      companyId: data.companyId,
      userId: data.userId,
      leaveTypeId: data.leaveTypeId,
      targetDate: data.targetDate,
      ...updateData
    }
  });
}

async function seedCareDemo(passwordHash: string) {
  const demoCompany = await prisma.company.upsert({
    where: { code: "CARE_DEMO" },
    update: { name: "デモ介護施設", industryType: "care", closingDay: 31 },
    create: { name: "デモ介護施設", code: "CARE_DEMO", industryType: "care", closingDay: 31 }
  });

  const demoDepartments = [
    { code: "CARE_FLOOR_1", name: "介護フロア1" },
    { code: "CARE_FLOOR_2", name: "介護フロア2" },
    { code: "NURSING", name: "看護" },
    { code: "REHAB_DEMO", name: "リハビリ" },
    { code: "OFFICE_DEMO", name: "事務" }
  ];

  const departmentMasters = await Promise.all(
    demoDepartments.map((department, index) =>
      prisma.department.upsert({
        where: { companyId_code: { companyId: demoCompany.id, code: department.code } },
        update: { name: department.name, sortOrder: index + 1, isActive: true },
        create: {
          companyId: demoCompany.id,
          code: department.code,
          name: department.name,
          sortOrder: index + 1,
          isActive: true
        }
      })
    )
  );

  const demoPositions = [
    { code: "FACILITY_MANAGER", name: "施設長" },
    { code: "CARE_CHIEF", name: "介護主任" },
    { code: "NURSE_CHIEF", name: "看護主任" },
    { code: "CARE_STAFF", name: "介護職員" },
    { code: "NURSE_STAFF", name: "看護師" },
    { code: "OFFICE_STAFF", name: "事務員" }
  ];

  const positionMasters = await Promise.all(
    demoPositions.map((position, index) =>
      prisma.positionMaster.upsert({
        where: { companyId_code: { companyId: demoCompany.id, code: position.code } },
        update: { name: position.name, sortOrder: index + 1, isActive: true },
        create: {
          companyId: demoCompany.id,
          code: position.code,
          name: position.name,
          sortOrder: index + 1,
          isActive: true
        }
      })
    )
  );

  const fullTime = await prisma.employmentType.upsert({
    where: { companyId_code: { companyId: demoCompany.id, code: "FULL_TIME" } },
    update: { name: "常勤", sortOrder: 1, isActive: true },
    create: { companyId: demoCompany.id, code: "FULL_TIME", name: "常勤", sortOrder: 1, isActive: true }
  });

  const partTime = await prisma.employmentType.upsert({
    where: { companyId_code: { companyId: demoCompany.id, code: "PART_TIME" } },
    update: { name: "非常勤", sortOrder: 2, isActive: true },
    create: { companyId: demoCompany.id, code: "PART_TIME", name: "非常勤", sortOrder: 2, isActive: true }
  });

  const adminRole = await prisma.roleMaster.upsert({
    where: { companyId_code: { companyId: demoCompany.id, code: "ADMIN" } },
    update: { name: "管理者", sortOrder: 1, isActive: true },
    create: { companyId: demoCompany.id, code: "ADMIN", name: "管理者", description: "介護デモ管理者", sortOrder: 1, isActive: true }
  });

  const staffRole = await prisma.roleMaster.upsert({
    where: { companyId_code: { companyId: demoCompany.id, code: "EMPLOYEE" } },
    update: { name: "スタッフ", sortOrder: 2, isActive: true },
    create: { companyId: demoCompany.id, code: "EMPLOYEE", name: "スタッフ", description: "介護デモスタッフ", sortOrder: 2, isActive: true }
  });

  const paidLeaveType = await prisma.leaveTypeMaster.upsert({
    where: { companyId_code: { companyId: demoCompany.id, code: "PAID" } },
    update: { name: "有給休暇", allowHourly: true, sortOrder: 1, isActive: true },
    create: { companyId: demoCompany.id, code: "PAID", name: "有給休暇", allowHourly: true, sortOrder: 1, isActive: true }
  });

  const requestedOffType = await prisma.leaveTypeMaster.upsert({
    where: { companyId_code: { companyId: demoCompany.id, code: "REQUESTED_OFF" } },
    update: { name: "希望休", allowHourly: false, sortOrder: 2, isActive: true },
    create: { companyId: demoCompany.id, code: "REQUESTED_OFF", name: "希望休", allowHourly: false, sortOrder: 2, isActive: true }
  });

  await prisma.leaveTypeMaster.upsert({
    where: { companyId_code: { companyId: demoCompany.id, code: "ABSENCE" } },
    update: { name: "欠勤", allowHourly: false, sortOrder: 3, isActive: true },
    create: { companyId: demoCompany.id, code: "ABSENCE", name: "欠勤", allowHourly: false, sortOrder: 3, isActive: true }
  });

  const demoPatterns = [
    {
      code: "DEMO_E",
      name: "早番",
      category: WorkPatternCategory.EARLY,
      startTime: "07:00",
      endTime: "16:00",
      breakMinutes: 60,
      colorClass: "bg-sky-300 text-slate-900",
      displayColor: "sky",
      isHoliday: false,
      isNightShift: false,
      autoCreateAfterNight: false,
      countsAsWork: true,
      countsAsLeave: false,
      sortOrder: 1
    },
    {
      code: "DEMO_D",
      name: "日勤",
      category: WorkPatternCategory.DAY,
      startTime: "09:00",
      endTime: "18:00",
      breakMinutes: 60,
      colorClass: "bg-emerald-300 text-slate-900",
      displayColor: "emerald",
      isHoliday: false,
      isNightShift: false,
      autoCreateAfterNight: false,
      countsAsWork: true,
      countsAsLeave: false,
      sortOrder: 2
    },
    {
      code: "DEMO_L",
      name: "遅番",
      category: WorkPatternCategory.LATE,
      startTime: "11:00",
      endTime: "20:00",
      breakMinutes: 60,
      colorClass: "bg-orange-300 text-slate-900",
      displayColor: "orange",
      isHoliday: false,
      isNightShift: false,
      autoCreateAfterNight: false,
      countsAsWork: true,
      countsAsLeave: false,
      sortOrder: 3
    },
    {
      code: "DEMO_N",
      name: "夜勤",
      category: WorkPatternCategory.NIGHT,
      startTime: "16:00",
      endTime: "09:00",
      breakMinutes: 120,
      colorClass: "bg-indigo-300 text-slate-900",
      displayColor: "indigo",
      isHoliday: false,
      isNightShift: true,
      autoCreateAfterNight: true,
      countsAsWork: true,
      countsAsLeave: false,
      sortOrder: 4
    },
    {
      code: "DEMO_AK",
      name: "明け",
      category: WorkPatternCategory.AFTER_NIGHT,
      startTime: "00:00",
      endTime: "00:00",
      breakMinutes: 0,
      colorClass: "bg-violet-200 text-slate-900",
      displayColor: "violet",
      isHoliday: true,
      isNightShift: false,
      autoCreateAfterNight: false,
      countsAsWork: false,
      countsAsLeave: false,
      sortOrder: 5
    },
    {
      code: "DEMO_OFF",
      name: "休み",
      category: WorkPatternCategory.OFF,
      startTime: "00:00",
      endTime: "00:00",
      breakMinutes: 0,
      colorClass: "bg-slate-200 text-slate-700",
      displayColor: "slate",
      isHoliday: true,
      isNightShift: false,
      autoCreateAfterNight: false,
      countsAsWork: false,
      countsAsLeave: false,
      sortOrder: 6
    },
    {
      code: "PAID",
      name: "有給",
      category: WorkPatternCategory.PAID_LEAVE,
      startTime: "00:00",
      endTime: "00:00",
      breakMinutes: 0,
      colorClass: "bg-amber-200 text-slate-900",
      displayColor: "amber",
      isHoliday: true,
      isNightShift: false,
      autoCreateAfterNight: false,
      countsAsWork: false,
      countsAsLeave: true,
      sortOrder: 7
    },
    {
      code: "REQUESTED_OFF",
      name: "希望休",
      category: WorkPatternCategory.REQUESTED_OFF,
      startTime: "00:00",
      endTime: "00:00",
      breakMinutes: 0,
      colorClass: "bg-pink-200 text-slate-900",
      displayColor: "pink",
      isHoliday: true,
      isNightShift: false,
      autoCreateAfterNight: false,
      countsAsWork: false,
      countsAsLeave: false,
      sortOrder: 8
    }
  ];

  const patternMasters = await Promise.all(
    demoPatterns.map((pattern) =>
      prisma.workPattern.upsert({
        where: { companyId_code: { companyId: demoCompany.id, code: pattern.code } },
        update: { ...pattern, isActive: true },
        create: { companyId: demoCompany.id, ...pattern, isActive: true }
      })
    )
  );
  const patternByCode = new Map(patternMasters.map((pattern) => [pattern.code, pattern]));

  const admin = await prisma.user.upsert({
    where: { email: "care-admin@smile-kintai.local" },
    update: {
      companyId: demoCompany.id,
      name: "介護 管理者",
      role: Role.ADMIN,
      roleMasterId: adminRole.id,
      positionMasterId: positionMasters[0].id,
      department: departmentMasters[4].name,
      departmentId: departmentMasters[4].id,
      employmentTypeId: fullTime.id,
      jobType: "施設管理者",
      isFullTime: true,
      monthlyScheduledMinutes: 160 * 60,
      displayOrder: 1
    },
    create: {
      companyId: demoCompany.id,
      name: "介護 管理者",
      email: "care-admin@smile-kintai.local",
      passwordHash,
      role: Role.ADMIN,
      roleMasterId: adminRole.id,
      positionMasterId: positionMasters[0].id,
      department: departmentMasters[4].name,
      departmentId: departmentMasters[4].id,
      employmentTypeId: fullTime.id,
      jobType: "施設管理者",
      isFullTime: true,
      monthlyScheduledMinutes: 160 * 60,
      displayOrder: 1
    }
  });

  const staffDefinitions = [
    { name: "佐藤 花子", jobType: "介護職員", departmentIndex: 0, positionIndex: 3, fullTime: true, qualifications: ["介護福祉士"] },
    { name: "鈴木 太郎", jobType: "介護職員", departmentIndex: 0, positionIndex: 1, fullTime: true, qualifications: ["介護福祉士", "介護支援専門員"] },
    { name: "高橋 美咲", jobType: "介護職員", departmentIndex: 1, positionIndex: 3, fullTime: true, qualifications: ["初任者研修"] },
    { name: "田中 健一", jobType: "介護職員", departmentIndex: 1, positionIndex: 3, fullTime: true, qualifications: ["実務者研修"] },
    { name: "伊藤 明日香", jobType: "看護師", departmentIndex: 2, positionIndex: 4, fullTime: true, qualifications: ["看護師"] },
    { name: "渡辺 直人", jobType: "准看護師", departmentIndex: 2, positionIndex: 4, fullTime: true, qualifications: ["准看護師"] },
    { name: "山本 由美", jobType: "機能訓練指導員", departmentIndex: 3, positionIndex: 5, fullTime: false, qualifications: ["PT"] },
    { name: "中村 誠", jobType: "生活相談員", departmentIndex: 0, positionIndex: 5, fullTime: true, qualifications: ["生活相談員"] },
    { name: "小林 葵", jobType: "介護職員", departmentIndex: 1, positionIndex: 3, fullTime: false, qualifications: ["初任者研修"] },
    { name: "加藤 翼", jobType: "事務員", departmentIndex: 4, positionIndex: 5, fullTime: true, qualifications: [] }
  ];

  const staffUsers = [];
  for (let index = 0; index < staffDefinitions.length; index += 1) {
    const staff = staffDefinitions[index];
    const department = departmentMasters[staff.departmentIndex];
    const position = positionMasters[staff.positionIndex];
    const employmentType = staff.fullTime ? fullTime : partTime;
    const user = await prisma.user.upsert({
      where: { email: `care-staff${String(index + 1).padStart(2, "0")}@smile-kintai.local` },
      update: {
        companyId: demoCompany.id,
        name: staff.name,
        role: Role.EMPLOYEE,
        roleMasterId: staffRole.id,
        positionMasterId: position.id,
        department: department.name,
        departmentId: department.id,
        employmentTypeId: employmentType.id,
        jobType: staff.jobType,
        isFullTime: staff.fullTime,
        monthlyScheduledMinutes: staff.fullTime ? 160 * 60 : 96 * 60,
        displayOrder: index + 2
      },
      create: {
        companyId: demoCompany.id,
        name: staff.name,
        email: `care-staff${String(index + 1).padStart(2, "0")}@smile-kintai.local`,
        passwordHash,
        role: Role.EMPLOYEE,
        roleMasterId: staffRole.id,
        positionMasterId: position.id,
        department: department.name,
        departmentId: department.id,
        employmentTypeId: employmentType.id,
        jobType: staff.jobType,
        isFullTime: staff.fullTime,
        monthlyScheduledMinutes: staff.fullTime ? 160 * 60 : 96 * 60,
        displayOrder: index + 2
      }
    });
    staffUsers.push({ ...user, qualificationNames: staff.qualifications });
    await ensurePaidLeave(demoCompany.id, user.id, staff.fullTime ? 12 : 6, index % 3);
  }

  const qualificationNames = ["介護福祉士", "看護師", "准看護師", "PT", "介護支援専門員", "生活相談員", "初任者研修", "実務者研修"];
  const qualificationMasters = new Map<string, { id: string }>();
  for (const name of qualificationNames) {
    const qualification = await prisma.qualificationMaster.upsert({
      where: { companyId_name: { companyId: demoCompany.id, name } },
      update: { name },
      create: { companyId: demoCompany.id, name }
    });
    qualificationMasters.set(name, qualification);
  }

  for (const staff of staffUsers) {
    for (const qualificationName of staff.qualificationNames) {
      const qualification = qualificationMasters.get(qualificationName);
      if (!qualification) continue;
      await prisma.userQualification.upsert({
        where: { userId_qualificationId: { userId: staff.id, qualificationId: qualification.id } },
        update: {},
        create: { userId: staff.id, qualificationId: qualification.id }
      });
    }
  }

  for (const [name, requiredCount] of [
    ["介護福祉士", 1],
    ["看護師", 1]
  ] as const) {
    const qualification = qualificationMasters.get(name);
    if (!qualification) continue;
    await prisma.careQualificationRule.upsert({
      where: { companyId_qualificationId: { companyId: demoCompany.id, qualificationId: qualification.id } },
      update: { requiredCount },
      create: { companyId: demoCompany.id, qualificationId: qualification.id, requiredCount }
    });
  }

  await upsertCareStaffingRule(demoCompany.id, WorkPatternCategory.EARLY, 1);
  await upsertCareStaffingRule(demoCompany.id, WorkPatternCategory.DAY, 2);
  await upsertCareStaffingRule(demoCompany.id, WorkPatternCategory.LATE, 1);
  await upsertCareStaffingRule(demoCompany.id, WorkPatternCategory.NIGHT, 1);
  await upsertFullTimeEquivalentRule(demoCompany.id, 160 * 60);

  const now = new Date();
  const targetYear = now.getFullYear();
  const targetMonth = now.getMonth() + 1;
  const monthStart = tokyoDate(targetYear, targetMonth, 1);
  const monthEnd = targetMonth === 12 ? tokyoDate(targetYear + 1, 1, 1) : tokyoDate(targetYear, targetMonth + 1, 1);
  const days = new Date(targetYear, targetMonth, 0).getDate();
  const demoUserIds = staffUsers.map((user) => user.id);

  await prisma.shift.deleteMany({
    where: {
      companyId: demoCompany.id,
      userId: { in: demoUserIds },
      workDate: { gte: monthStart, lt: monthEnd }
    }
  });

  const shiftRows = [];
  const patternPlan = [
    "DEMO_E",
    "DEMO_D",
    "DEMO_D",
    "DEMO_L",
    "DEMO_N",
    "DEMO_D",
    "DEMO_D",
    "DEMO_D",
    "DEMO_OFF",
    "DEMO_D"
  ];

  for (let day = 1; day <= days; day += 1) {
    for (let staffIndex = 0; staffIndex < staffUsers.length; staffIndex += 1) {
      let code = patternPlan[staffIndex];

      if (staffIndex === 4 && day === 8) code = "DEMO_OFF";
      if (staffIndex === 5 && day > 1 && day % 3 === 2) code = "DEMO_AK";
      if (staffIndex === 8 && day % 5 === 0) code = "REQUESTED_OFF";
      if (staffIndex === 9 && (day === 6 || day === 20)) code = "PAID";

      const pattern = patternByCode.get(code) ?? patternByCode.get("DEMO_D");
      if (!pattern) continue;

      shiftRows.push({
        companyId: demoCompany.id,
        userId: staffUsers[staffIndex].id,
        workDate: tokyoDate(targetYear, targetMonth, day),
        startTime: pattern.startTime,
        endTime: pattern.endTime,
        breakMinutes: pattern.breakMinutes,
        patternCode: pattern.code,
        workPatternId: pattern.id
      });
    }
  }

  await prisma.shift.createMany({ data: shiftRows });

  await upsertLeaveRequest({
    companyId: demoCompany.id,
    userId: staffUsers[0].id,
    leaveTypeId: paidLeaveType.id,
    targetDate: tokyoDate(targetYear, targetMonth, 10),
    reason: "デモ用の承認済み有給です。",
    status: LeaveRequestStatus.APPROVED
  });

  await upsertLeaveRequest({
    companyId: demoCompany.id,
    userId: staffUsers[1].id,
    leaveTypeId: requestedOffType.id,
    targetDate: tokyoDate(targetYear, targetMonth, 12),
    reason: "デモ用の承認済み希望休です。",
    status: LeaveRequestStatus.APPROVED
  });

  await upsertLeaveRequest({
    companyId: demoCompany.id,
    userId: staffUsers[2].id,
    leaveTypeId: paidLeaveType.id,
    targetDate: tokyoDate(targetYear, targetMonth, 18),
    reason: "承認操作確認用の申請です。",
    status: LeaveRequestStatus.PENDING
  });
}

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const company = await prisma.company.upsert({
    where: { code: "SMILE" },
    update: { name: "スマイル介護施設", industryType: "general", closingDay: 31 },
    create: { name: "スマイル介護施設", code: "SMILE", industryType: "general", closingDay: 31 }
  });

  const departmentMasters = await Promise.all(
    departments.map((department, index) =>
      prisma.department.upsert({
        where: { companyId_code: { companyId: company.id, code: department.code } },
        update: { name: department.name, sortOrder: index + 1, isActive: true },
        create: {
          companyId: company.id,
          code: department.code,
          name: department.name,
          sortOrder: index + 1,
          isActive: true
        }
      })
    )
  );

  const positionMasters = await Promise.all(
    positions.map((position, index) =>
      prisma.positionMaster.upsert({
        where: { companyId_code: { companyId: company.id, code: position.code } },
        update: { name: position.name, sortOrder: index + 1, isActive: true },
        create: {
          companyId: company.id,
          code: position.code,
          name: position.name,
          sortOrder: index + 1,
          isActive: true
        }
      })
    )
  );

  await prisma.positionMaster.updateMany({
    where: {
      companyId: company.id,
      code: { notIn: positions.map((position) => position.code) }
    },
    data: { isActive: false }
  });

  await Promise.all(
    leaveTypes.map((leaveType, index) =>
      prisma.leaveTypeMaster.upsert({
        where: { companyId_code: { companyId: company.id, code: leaveType.code } },
        update: {
          name: leaveType.name,
          allowHourly: leaveType.allowHourly,
          sortOrder: index + 1,
          isActive: true
        },
        create: {
          companyId: company.id,
          code: leaveType.code,
          name: leaveType.name,
          allowHourly: leaveType.allowHourly,
          sortOrder: index + 1,
          isActive: true
        }
      })
    )
  );

  const fullTime = await prisma.employmentType.upsert({
    where: { companyId_code: { companyId: company.id, code: "FULL_TIME" } },
    update: { name: "正社員", sortOrder: 1, isActive: true },
    create: { companyId: company.id, code: "FULL_TIME", name: "正社員", sortOrder: 1, isActive: true }
  });

  const partTime = await prisma.employmentType.upsert({
    where: { companyId_code: { companyId: company.id, code: "PART_TIME" } },
    update: { name: "パート", sortOrder: 2, isActive: true },
    create: { companyId: company.id, code: "PART_TIME", name: "パート", sortOrder: 2, isActive: true }
  });

  const adminRoleMaster = await prisma.roleMaster.upsert({
    where: { companyId_code: { companyId: company.id, code: "ADMIN" } },
    update: { name: "管理者", isActive: true },
    create: {
      companyId: company.id,
      code: "ADMIN",
      name: "管理者",
      description: "管理画面を利用できます。",
      sortOrder: 1,
      isActive: true
    }
  });

  const employeeRoleMaster = await prisma.roleMaster.upsert({
    where: { companyId_code: { companyId: company.id, code: "EMPLOYEE" } },
    update: { name: "社員", isActive: true },
    create: {
      companyId: company.id,
      code: "EMPLOYEE",
      name: "社員",
      description: "打刻画面を利用できます。",
      sortOrder: 2,
      isActive: true
    }
  });

  const dayPattern = await prisma.workPattern.upsert({
    where: { companyId_code: { companyId: company.id, code: "A" } },
    update: { name: "A勤", startTime: "09:00", endTime: "18:00", breakMinutes: 60, isHoliday: false, isActive: true },
    create: {
      companyId: company.id,
      code: "A",
      name: "A勤",
      startTime: "09:00",
      endTime: "18:00",
      breakMinutes: 60,
      colorClass: "bg-emerald-400 text-slate-900",
      sortOrder: 1,
      isActive: true
    }
  });

  await prisma.workPattern.upsert({
    where: { companyId_code: { companyId: company.id, code: "OFF" } },
    update: { name: "公休", startTime: "00:00", endTime: "00:00", breakMinutes: 0, isHoliday: true, isActive: true },
    create: {
      companyId: company.id,
      code: "OFF",
      name: "公休",
      startTime: "00:00",
      endTime: "00:00",
      breakMinutes: 0,
      colorClass: "bg-slate-200 text-slate-700",
      sortOrder: 90,
      isHoliday: true,
      isActive: true
    }
  });

  await prisma.workPattern.upsert({
    where: { companyId_code: { companyId: company.id, code: "YU" } },
    update: { name: "有休", startTime: "00:00", endTime: "00:00", breakMinutes: 0, isHoliday: true, isActive: true },
    create: {
      companyId: company.id,
      code: "YU",
      name: "有休",
      startTime: "00:00",
      endTime: "00:00",
      breakMinutes: 0,
      colorClass: "bg-amber-200 text-slate-900",
      sortOrder: 91,
      isHoliday: true,
      isActive: true
    }
  });

  const carePatternMasters = [];
  for (let index = 0; index < careWorkPatterns.length; index += 1) {
    const pattern = careWorkPatterns[index];
    carePatternMasters.push(
      await prisma.workPattern.upsert({
        where: { companyId_code: { companyId: company.id, code: pattern.code } },
        update: {
          name: pattern.name,
          startTime: pattern.startTime,
          endTime: pattern.endTime,
          breakMinutes: pattern.breakMinutes,
          colorClass: pattern.colorClass,
          isHoliday: pattern.isHoliday,
          sortOrder: index + 1,
          isActive: true
        },
        create: {
          companyId: company.id,
          code: pattern.code,
          name: pattern.name,
          startTime: pattern.startTime,
          endTime: pattern.endTime,
          breakMinutes: pattern.breakMinutes,
          colorClass: pattern.colorClass,
          isHoliday: pattern.isHoliday,
          sortOrder: index + 1,
          isActive: true
        }
      })
    );
  }
  const patternByCode = new Map(carePatternMasters.map((pattern) => [pattern.code, pattern]));

  const adminDepartment = departmentMasters[4];
  const admin = await prisma.user.upsert({
    where: { email: "admin@smile-kintai.local" },
    update: {
      name: "管理者 太郎",
      roleMasterId: adminRoleMaster.id,
      positionMasterId: positionMasters[0].id,
      department: adminDepartment.name,
      departmentId: adminDepartment.id,
      employmentTypeId: fullTime.id,
      displayOrder: 1
    },
    create: {
      companyId: company.id,
      name: "管理者 太郎",
      email: "admin@smile-kintai.local",
      passwordHash,
      role: Role.ADMIN,
      roleMasterId: adminRoleMaster.id,
      positionMasterId: positionMasters[0].id,
      department: adminDepartment.name,
      departmentId: adminDepartment.id,
      employmentTypeId: fullTime.id,
      displayOrder: 1
    }
  });

  const employeeDepartment = departmentMasters[0];
  const employee = await prisma.user.upsert({
    where: { email: "employee@smile-kintai.local" },
    update: {
      name: "社員 花子",
      roleMasterId: employeeRoleMaster.id,
      positionMasterId: positionMasters[5].id,
      department: employeeDepartment.name,
      departmentId: employeeDepartment.id,
      employmentTypeId: fullTime.id,
      displayOrder: 2
    },
    create: {
      companyId: company.id,
      name: "社員 花子",
      email: "employee@smile-kintai.local",
      passwordHash,
      role: Role.EMPLOYEE,
      roleMasterId: employeeRoleMaster.id,
      positionMasterId: positionMasters[5].id,
      department: employeeDepartment.name,
      departmentId: employeeDepartment.id,
      employmentTypeId: fullTime.id,
      displayOrder: 2
    }
  });

  await ensurePaidLeave(company.id, admin.id, 10, 1);
  await ensurePaidLeave(company.id, employee.id, 10, 2);
  await ensureTodayShift(company.id, admin.id, dayPattern.id, dayPattern.code);
  await ensureTodayShift(company.id, employee.id, dayPattern.id, dayPattern.code);

  const shiftUserIds = [admin.id, employee.id];

  for (let i = 1; i <= 100; i += 1) {
    const department = departmentMasters[(i - 1) % departmentMasters.length];
    const position = positionMasters[i % positionMasters.length];
    const employmentType = i % 5 === 0 ? partTime : fullTime;
    const name = `${lastNames[(i - 1) % lastNames.length]} ${firstNames[(i - 1) % firstNames.length]}`;
    const email = `sample${String(i).padStart(3, "0")}@smile-kintai.local`;

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        role: Role.EMPLOYEE,
        roleMasterId: employeeRoleMaster.id,
        positionMasterId: position.id,
        department: department.name,
        departmentId: department.id,
        employmentTypeId: employmentType.id,
        displayOrder: i + 3
      },
      create: {
        companyId: company.id,
        name,
        email,
        passwordHash,
        role: Role.EMPLOYEE,
        roleMasterId: employeeRoleMaster.id,
        positionMasterId: position.id,
        department: department.name,
        departmentId: department.id,
        employmentTypeId: employmentType.id,
        displayOrder: i + 3
      }
    });

    await ensurePaidLeave(company.id, user.id, i % 5 === 0 ? 5 : 10, i % 4);
    shiftUserIds.push(user.id);
    if (i <= 20) {
      await ensureTodayShift(company.id, user.id, dayPattern.id, dayPattern.code);
    }
  }

  const now = new Date();
  const shiftYear = now.getFullYear();
  const shiftMonth = now.getMonth();
  const monthDays = new Date(shiftYear, shiftMonth + 1, 0).getDate();
  const careCodes = ["E1", "E2", "E3", "A", "D1", "D2", "L1", "L2", "L3", "N1", "N2", "SN1", "SN2", "MN1"];
  const nurseCodes = ["D1", "D2", "L1", "N1", "N2", "SN1", "OFF", "PAID"];
  const rehabCodes = ["R1", "R2", "D1", "P1", "P2", "OFF", "PAID"];
  const officeCodes = ["O1", "D1", "MTG", "P3", "OFF", "PAID"];
  const holidayCodes = ["OFF", "PAID", "COMP", "SPECIAL"];

  const shiftRows = [];

  for (let userIndex = 0; userIndex < shiftUserIds.length; userIndex += 1) {
    const userId = shiftUserIds[userIndex];
    const departmentIndex = userIndex % departments.length;
    const rotation = departmentIndex <= 1
      ? careCodes
      : departmentIndex === 2
      ? nurseCodes
      : departmentIndex === 3
      ? rehabCodes
      : officeCodes;

    for (let day = 1; day <= monthDays; day += 1) {
      const workDate = new Date(shiftYear, shiftMonth, day);
      workDate.setHours(0, 0, 0, 0);
      const dayOfWeek = workDate.getDay();
      const holidayEvery = userIndex % 6 === 0 && day % 11 === 0;
      const weekendOfficeOff = departmentIndex === 4 && (dayOfWeek === 0 || dayOfWeek === 6);
      const code = holidayEvery
        ? holidayCodes[(userIndex + day) % holidayCodes.length]
        : weekendOfficeOff
        ? "OFF"
        : rotation[(userIndex + day) % rotation.length];
      const pattern = patternByCode.get(code) ?? patternByCode.get("A");
      if (!pattern) continue;
      shiftRows.push({
        companyId: company.id,
        userId,
        workDate,
        startTime: pattern.startTime,
        endTime: pattern.endTime,
        breakMinutes: pattern.breakMinutes,
        patternCode: pattern.code,
        workPatternId: pattern.id
      });
    }
  }

  await prisma.shift.deleteMany({
    where: {
      companyId: company.id,
      userId: { in: shiftUserIds },
      workDate: {
        gte: new Date(shiftYear, shiftMonth, 1),
        lt: new Date(shiftYear, shiftMonth + 1, 1)
      }
    }
  });

  for (let i = 0; i < shiftRows.length; i += 500) {
    await prisma.shift.createMany({
      data: shiftRows.slice(i, i + 500)
    });
  }

  await seedCareDemo(passwordHash);

  console.log("Seed completed.");
}

main().finally(async () => prisma.$disconnect());
