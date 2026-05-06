import { requireCareCompany } from "@/lib/authz";
import { logAction } from "@/lib/audit-log";
import { buildCareAdditionReportSummary, parseCareAdditionYm } from "@/lib/care-addition-report";
import { createCareAdditionExcel, createCareAdditionPdf } from "@/lib/care-report-files";
import { prisma } from "@/lib/prisma";

const reportType = "CARE_ADDITION_SUMMARY";

export async function GET(req: Request) {
  const auth = await requireCareCompany();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const url = new URL(req.url);
  const { ym } = parseCareAdditionYm(url.searchParams.get("ym"));
  const fileTypeParam = url.searchParams.get("fileType")?.toLowerCase();
  const fileType = fileTypeParam === "pdf" ? "PDF" : "EXCEL";
  const summary = await buildCareAdditionReportSummary(session.user.companyId, ym);

  const history = await prisma.reportExportHistory.create({
    data: {
      companyId: session.user.companyId,
      userId: session.user.id,
      reportType,
      fileType,
      targetMonth: ym
    }
  });

  await logAction({
    request: req,
    userId: session.user.id,
    companyId: session.user.companyId,
    action: "EXPORT_REPORT",
    targetType: "REPORT",
    targetId: history.id,
    after: history,
    meta: { reportType, fileType, targetMonth: ym }
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
