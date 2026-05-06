import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditJson = Prisma.InputJsonValue | undefined;

type LogActionInput = {
  userId?: string | null;
  companyId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  before?: unknown;
  after?: unknown;
  meta?: unknown;
  request?: Request;
};

function toJson(value: unknown): AuditJson {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function withMeta(after: unknown, meta: unknown): AuditJson {
  if (meta === undefined) return toJson(after);
  return toJson({ data: after ?? null, meta });
}

export async function logAction(input: LogActionInput) {
  try {
    await prisma.auditLog.create({
      data: {
        companyId: input.companyId,
        actorUserId: input.userId ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        beforeJson: toJson(input.before),
        afterJson: withMeta(input.after, input.meta),
        ipAddress: input.request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        userAgent: input.request?.headers.get("user-agent") ?? null
      }
    });
  } catch (error) {
    console.error("AuditLogの保存に失敗しました。", error);
  }
}
