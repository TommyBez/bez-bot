import { z } from "zod";

export const scheduleSchema = z
  .object({
    everyMinutes: z.number().int().min(15).max(43200).nullable().optional(),
    at: z.string().regex(/^\d{1,2}:\d{2}$/).nullable().optional(),
    days: z.array(z.number().int().min(0).max(6)).nullable().optional(),
  })
  .nullable();
