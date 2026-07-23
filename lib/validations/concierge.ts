import { z } from "zod";

export const conciergeSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  topic: z.string().trim().min(1, "Please select a topic"),
  message: z.string().trim().min(10, "Tell us a bit more — at least 10 characters"),
});

export type ConciergeFormValues = z.infer<typeof conciergeSchema>;
