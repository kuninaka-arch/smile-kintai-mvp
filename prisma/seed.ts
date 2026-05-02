import { PrismaClient, Role } from "@prisma/client";
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

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const company = await prisma.company.upsert({
    where: { code: "SMILE" },
    update: { name: "スマイル介護施設" },
    create: { name: "スマイル介護施設", code: "SMILE" }
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
      employmentTypeId: fullTime.id
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
      employmentTypeId: fullTime.id
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
      employmentTypeId: fullTime.id
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
      employmentTypeId: fullTime.id
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
        employmentTypeId: employmentType.id
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
        employmentTypeId: employmentType.id
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

  console.log("Seed completed.");
}

main().finally(async () => prisma.$disconnect());
