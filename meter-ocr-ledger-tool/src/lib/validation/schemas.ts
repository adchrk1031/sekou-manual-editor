import { z } from "zod";

export const excelMappingSchema = z.object({
  sheetName: z.string().min(1),
  headerRow: z.coerce.number().int().positive(),
  roomColumn: z.string().min(1),
  previousReadingColumn: z.string().optional().or(z.literal("")),
  plannedInstallMeterNoColumn: z.string().optional().or(z.literal("")),
  removalReadingOutputColumn: z.string().min(1),
  installMeterNoOutputColumn: z.string().min(1),
  installReadingOutputColumn: z.string().min(1)
});

export const settingsSchema = z.object({
  ocrConfidenceThreshold: z.coerce.number().min(0).max(1),
  maxDeltaThreshold: z.coerce.number().min(0),
  dryRun: z.coerce.boolean(),
  productionWriteEnabled: z.coerce.boolean()
});

export const reviewUpdateSchema = z.object({
  approvedForOutput: z.coerce.boolean(),
  reviewedBy: z.string().min(1),
  removalReading: z.coerce.number().nullable().optional(),
  installMeterNo: z.string().nullable().optional(),
  installReading: z.coerce.number().nullable().optional()
});

export const googleSheetsSchema = z
  .object({
    spreadsheetId: z.string().trim().optional().or(z.literal("")),
    driveFolderId: z.string().trim().optional().or(z.literal("")),
    createSpreadsheetFromExcel: z.coerce.boolean().default(false),
    spreadsheetTitle: z.string().trim().optional().or(z.literal("")),
    sheetName: z.string().min(1),
    roomColumn: z.string().min(1),
    removalReadingColumn: z.string().min(1),
    installMeterNoColumn: z.string().min(1),
    installReadingColumn: z.string().min(1)
  })
  .superRefine((data, ctx) => {
    const hasSpreadsheetId = Boolean(data.spreadsheetId && data.spreadsheetId.trim());
    const hasDriveFolderId = Boolean(data.driveFolderId && data.driveFolderId.trim());

    if (!hasSpreadsheetId && !data.createSpreadsheetFromExcel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Spreadsheet ID を入力するか、Excelから変換を有効にしてください"
      });
    }

    if (data.createSpreadsheetFromExcel && !hasDriveFolderId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Excelから変換する場合は Google Drive フォルダIDが必要です"
      });
    }
  });
