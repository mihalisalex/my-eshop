import { z } from "zod";

/**
 * What a shopper may submit from the product page.
 *
 * This is the real guard on the rating — the CHECK constraint in the migration is a
 * backstop for bugs, not the validation a person sees. Messages are Greek because the
 * storefront is, and because these are read by shoppers rather than by developers.
 *
 * Lengths are deliberately generous at the top and firm at the bottom: a one-word body is
 * not a review anyone can use, while a long one is just someone with something to say.
 */
export const reviewSubmissionSchema = z.object({
  productId: z.string().min(1),
  rating: z
    .number({ message: "Επιλέξτε βαθμολογία." })
    .int()
    .min(1, "Επιλέξτε βαθμολογία.")
    .max(5, "Επιλέξτε βαθμολογία."),
  title: z.string().trim().min(3, "Γράψτε έναν σύντομο τίτλο.").max(120, "Ο τίτλος είναι πολύ μεγάλος."),
  body: z
    .string()
    .trim()
    .min(20, "Γράψτε λίγα λόγια ακόμη — τουλάχιστον 20 χαρακτήρες.")
    .max(4000, "Το κείμενο είναι πολύ μεγάλο."),
  authorName: z.string().trim().min(2, "Συμπληρώστε το όνομά σας.").max(80, "Το όνομα είναι πολύ μεγάλο."),
  /**
   * Required even though it is never displayed: it is what decides the verified badge, and
   * what makes repeat abuse from one address recognisable.
   */
  authorEmail: z.email({ message: "Συμπληρώστε ένα έγκυρο email." }).max(200),
});

export type ReviewSubmission = z.infer<typeof reviewSubmissionSchema>;
