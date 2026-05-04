import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { buildCareAdditionReportSummary, parseCareAdditionYm } from "@/lib/care-addition-report";
import { createCareAdditionExcel, createCareAdditionPdf } from "@/lib/care-report-files";
import { isCareCompany } from "@/lib/industry";
import { prisma } from "@/lib/prisma";

const reportType = "CARE_ADDITION_SUMMARY";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { industryType: true }
  });

  if (!isCareCompany(company?.industryType)) {
    return NextResponse.json({ error: "Care mode only" }, { status: 403 });
  }

  const url = new URL(req.url);
  const { ym } = parseCareAdditionYm(url.searchParams.get("ym"));
  const fileTypeParam = url.searchParams.get("fileType")?.toLowerCase();
  const fileType = fileTypeParam === "pdf" ? "PDF" : "EXCEL";
  const summary = await buildCareAdditionReportSummary(session.user.companyId, ym);

  await prisma.reportExportHistory.create({
    data: {
      companyId: session.user.companyId,
      userId: session.user.id,
      reportType,
      fileType,
      targetMonth: ym
    }
  });

  if (fileType === "PDF") {
    const pdf = createCareAdditionPdf(summary);
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="care-addition-summary-${ym}.pdf"`
      }
    });
  }

  const workbook = createCareAdditionExcel(summary);
  return new Response(workbook, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="care-addition-summary-${ym}.xlsx"`
    }
  });
}
