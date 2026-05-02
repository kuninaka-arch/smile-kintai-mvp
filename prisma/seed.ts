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
    if (i <= 20) {
      await ensureTodayShift(company.id, user.id, dayPattern.id, dayPattern.code);
    }
  }

  console.log("Seed completed.");
}

main().finally(async () => prisma.$disconnect());
