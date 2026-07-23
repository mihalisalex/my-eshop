"use client";

import { useEffect } from "react";
import { captureReferralFromUrl } from "@/lib/referral";

/** Renders nothing — just captures `?ref=CODE` into localStorage on first mount, from wherever the visitor landed. */
export function ReferralCapture() {
  useEffect(() => {
    captureReferralFromUrl(window.location.search);
  }, []);
  return null;
}
