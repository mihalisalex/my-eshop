import { describe, expect, it } from "vitest";
import { reviewSubmissionSchema } from "@/lib/validation/review";

const valid = {
  productId: "cmtl7qjdv000i58oc5295n925",
  rating: 5,
  title: "Πολύ άνετα",
  body: "Τα φοράω κάθε μέρα εδώ και έναν μήνα και δεν με χτύπησαν καθόλου στο περπάτημα.",
  authorName: "Μαρία",
  authorEmail: "maria@example.com",
};

describe("reviewSubmissionSchema", () => {
  it("accepts a normal review", () => {
    expect(reviewSubmissionSchema.safeParse(valid).success).toBe(true);
  });

  it("holds the rating to 1-5", () => {
    // The CHECK constraint in the migration is the backstop; this is the guard a person sees.
    for (const rating of [0, 6, -1, 2.5]) {
      expect(reviewSubmissionSchema.safeParse({ ...valid, rating }).success, `rating ${rating}`).toBe(false);
    }
    for (const rating of [1, 2, 3, 4, 5]) {
      expect(reviewSubmissionSchema.safeParse({ ...valid, rating }).success, `rating ${rating}`).toBe(true);
    }
  });

  it("rejects a body too short to be worth reading", () => {
    const result = reviewSubmissionSchema.safeParse({ ...valid, body: "Καλά" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("20 χαρακτήρες");
  });

  it("requires a usable email, since it decides the verified badge", () => {
    expect(reviewSubmissionSchema.safeParse({ ...valid, authorEmail: "not-an-email" }).success).toBe(false);
    expect(reviewSubmissionSchema.safeParse({ ...valid, authorEmail: "" }).success).toBe(false);
  });

  it("trims, so whitespace cannot pass for a name or a title", () => {
    expect(reviewSubmissionSchema.safeParse({ ...valid, authorName: "   " }).success).toBe(false);
    expect(reviewSubmissionSchema.safeParse({ ...valid, title: "  " }).success).toBe(false);
    expect(reviewSubmissionSchema.parse({ ...valid, authorName: "  Μαρία  " }).authorName).toBe("Μαρία");
  });

  it("speaks Greek, because the shopper reading it does", () => {
    const result = reviewSubmissionSchema.safeParse({ ...valid, authorName: "" });
    expect(result.error?.issues[0]?.message).toMatch(/[Α-Ωα-ωά-ώ]/);
  });
});
