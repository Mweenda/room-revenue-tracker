import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { base64ToBytes, bytesToBase64 } from "../../lib/spreadsheet/base64";
import { exportLatestSpreadsheet, parseAndSyncUpload } from "../../lib/spreadsheet/syncEngine";
import { landlordProcedure, router } from "../trpc";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export const spreadsheetRouter = router({
  upload: landlordProcedure
    .input(
      z.object({
        filename: z.string().min(1),
        fileBase64: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!/\.xlsx$/i.test(input.filename)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "File must be an Excel spreadsheet (.xlsx)",
        });
      }
      const bytes = base64ToBytes(input.fileBase64);
      if (bytes.byteLength > MAX_UPLOAD_BYTES) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Spreadsheet is larger than 20MB",
        });
      }
      return parseAndSyncUpload(ctx.repo, {
        filename: input.filename,
        bytes,
        landlordId: ctx.landlordId,
      });
    }),

  download: landlordProcedure.query(async ({ ctx }) => {
    const result = await exportLatestSpreadsheet(ctx.repo);
    return {
      filename: result.filename,
      fileBase64: bytesToBase64(result.bytes),
    };
  }),
});
