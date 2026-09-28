import { z } from "zod";

export const scheduleSchema = z
  .object({
    everyMinutes: z
      .number()
      .int()
      .min(15)
      .max(60 * 24 * 30)
      .nullable()
      .optional()
      .describe("Repeat interval in minutes (min 15). Omit when using a daily time."),
    at: z
      .string()
      .regex(/^\d{1,2}:\d{2}$/)
      .nullable()
      .optional()
      .describe("Daily clock time HH:MM (24h) in the user's timezone."),
    days: z
      .array(z.number().int().min(0).max(6))
      .nullable()
      .optional()
      .describe("Weekdays for the daily time, 0=Sunday..6=Saturday. Omit for every day."),
  })
  .describe("When the routine runs: a daily time (optionally on some weekdays) or a repeat interval.");
