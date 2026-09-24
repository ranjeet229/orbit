import { z } from "zod";
export const credentials = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z
    .string()
    .min(8)
    .max(72)
    .refine(
      (value) => Buffer.byteLength(value, "utf8") <= 72,
      "Password must be at most 72 UTF-8 bytes.",
    ),
  token: z.string().min(1).max(2048),
});
export const registration = credentials.extend({
  name: z.string().trim().min(2).max(40),
});
export const messageInput = z.object({
  text: z.string().trim().min(1).max(4000),
});
export const receiptInput = z.object({
  messageIds: z
    .array(z.string().regex(/^[a-f\d]{24}$/i))
    .min(1)
    .max(500),
});
export const conversationInput = z.object({
  members: z
    .array(z.string().regex(/^[a-f\d]{24}$/i))
    .min(1)
    .max(20),
  name: z.string().trim().max(60).optional(),
});
