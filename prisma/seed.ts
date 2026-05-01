import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const company = await prisma.company.upsert({
    where: { code: "SMILE" },
    update: {},
    create: { name: "スマイル株式会社", code: "SMILE" }
  });

  const adminRoleMaster = await prisma.roleMaster.upsert({
    where: { companyId_code: { companyId: company.id, code: "ADMIN" } },
    update: { name: "管理者", isActive: true },
    create: {
      companyId: company.id,
      code: "ADMIN",
      name: "管理者",
      description: "管理者画面を利用できます",
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
      description: "社員画面を利用できます",
      sortOrder: 2,
      isActive: true
    }
  });

  const managerPosition = await prisma.positionMaster.upsert({
    where: { companyId_code: { companyId: company.id, code: "MANAGER" } },
    update: { name: "管理者", isActive: true },
    create: {
      companyId: company.id,
      code: "MANAGER",
      name: "管理者",
      sortOrder: 1,
      isActive: true
    }
  });

  const staffPosition = await prisma.positionMaster.upsert({
    where: { companyId_code: { companyId: company.id, code: "STAFF" } },
    update: { name: "一般", isActive: true },
    create: {
      companyId: company.id,
      code: "STAFF",
      name: "一般",
      sortOrder: 2,
      isActive: true
    }
  });

  const dayPattern = await prisma.workPattern.upsert({
    where: { companyId_code: { companyId: company.id, code: "A" } },
    update: { name: "A勤", startTime: "09:00", endTime: "18:00", breakMinutes: 60, isActive: true },
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

  const admin = await prisma.user.upsert({
    where: { email: "admin@smile-kintai.local" },
    update: { roleMasterId: adminRoleMaster.id, positionMasterId: managerPosition.id },
    create: {
      companyId: company.id,
      name: "管理者 太郎",
      email: "admin@smile-kintai.local",
      passwordHash,
      role: Role.ADMIN,
      roleMasterId: adminRoleMaster.id,
      positionMasterId: managerPosition.id,
      department: "管理部"
    }
  });

  const employee = await prisma.user.upsert({
    where: { email: "employee@smile-kintai.local" },
    update: { roleMasterId: employeeRoleMaster.id, positionMasterId: staffPosition.id },
    create: {
      companyId: company.id,
      name: "社員 花子",
      email: "employee@smile-kintai.local",
      passwordHash,
      role: Role.EMPLOYEE,
      roleMasterId: employeeRoleMaster.id,
      positionMasterId: staffPosition.id,
      department: "営業部"
    }
  });

  await prisma.paidLeave.createMany({
    data: [
      { companyId: company.id, userId: admin.id, grantedDays: 10, usedDays: 1 },
      { companyId: company.id, userId: employee.id, grantedDays: 10, usedDays: 2 }
    ],
    skipDuplicates: true
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await prisma.shift.createMany({
    data: [
      { companyId: company.id, userId: admin.id, workDate: today, startTime: "09:00", endTime: "18:00", patternCode: dayPattern.code, workPatternId: dayPattern.id },
      { companyId: company.id, userId: employee.id, workDate: today, startTime: "09:00", endTime: "18:00", patternCode: dayPattern.code, workPatternId: dayPattern.id }
    ],
    skipDuplicates: true
  });

  console.log("Seed completed.");
}

main().finally(async () => prisma.$disconnect());
