import { z } from "zod";

export const RegisterSchema = z.object({
  registerId: z.number().int(),
  branchId: z.number().int(),
  name: z.string(),
});

export type Register = z.infer<typeof RegisterSchema>;
