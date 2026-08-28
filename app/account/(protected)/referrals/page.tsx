"use client";

import { useEffect, useState } from "react";
import { Copy, Gift } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { formatDate } from "@/lib/format";
import { useTranslations } from "next-intl";

interface ReferralSummary {
  id: string;
  referredFirstName: string;
  status: "pending" | "rewarded";
  rewardGiftCardCode?: string;
  createdAt: string;
}

export default function AccountReferralsPage() {
  const t = useTranslations("Account");
  const { toast } = useToast();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<ReferralSummary[] | null>(null);

  useEffect(() => {
    fetch("/api/customer/referrals")
      .then((res) => res.json())
      .then((body) => {
        setReferralCode(body.referralCode);
        setReferrals(body.referrals);
      });
  }, []);

  const shareUrl = referralCode ? `${typeof window !== "undefined" ? window.location.origin : ""}/?ref=${referralCode}` : null;

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    toast({ title: t("linkCopied"), tone: "success" });
  };

  return (
    <div>
      <h1 className="font-heading text-3xl">{t("referrals")}</h1>
      <p className="mt-2 text-sm text-luxe-gray-dark">
        Share your link — when a friend places their first order, you get a €15 gift card.
      </p>

      <div className="mt-8 border border-border bg-luxe-white p-6">
        {referralCode ? (
          <div className="flex flex-wrap items-center gap-3">
            <code className="border border-border bg-luxe-gray-light px-4 py-2.5 text-sm">{shareUrl}</code>
            <button
              type="button"
              onClick={handleCopy}
              className="flex h-10 items-center gap-1.5 bg-luxe-black px-4 text-xs font-medium tracking-[0.05em] text-luxe-white uppercase"
            >
              <Copy className="size-3.5" strokeWidth={1.5} />
              {t("copyLink")}
            </button>
          </div>
        ) : (
          <p className="text-sm text-luxe-gray-dark">Loading your link...</p>
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-xs font-medium tracking-[0.05em] uppercase text-luxe-gray-dark">{t("yourReferrals")}</h2>
        {referrals === null ? (
          <p className="mt-3 text-sm text-luxe-gray-dark">Loading...</p>
        ) : referrals.length === 0 ? (
          <div className="mt-3 flex flex-col items-center gap-3 border border-border py-16 text-center">
            <Gift className="size-10 text-luxe-gray-dark" strokeWidth={1} />
            <p className="text-sm text-luxe-gray-dark">No referrals yet — share your link to get started.</p>
          </div>
        ) : (
          <div className="mt-3 divide-y divide-border border-y border-border">
            {referrals.map((referral) => (
              <div key={referral.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="text-sm font-medium">{referral.referredFirstName}</p>
                  <p className="text-xs text-luxe-gray-dark">Joined {formatDate(referral.createdAt)}</p>
                </div>
                <span className="text-xs font-medium tracking-[0.05em] uppercase">
                  {referral.status === "rewarded" ? `Rewarded · ${referral.rewardGiftCardCode}` : "Pending first order"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
