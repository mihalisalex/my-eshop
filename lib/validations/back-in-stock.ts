import { z } from "zod";

export const backInStockRequestSchema = z.object({
  productId: z.string().min(1),
  sizeName: z.string().min(1),
  email: z.string().email(),
});
