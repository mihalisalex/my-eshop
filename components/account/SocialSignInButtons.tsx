"use client";

import { useToast } from "@/components/providers/ToastProvider";

const SOCIAL_OPTIONS = [
  { id: "google", label: "Continue with Google" },
  { id: "apple", label: "Continue with Apple" },
  { id: "facebook", label: "Continue with Facebook" },
] as const;

export function SocialSignInButtons() {
  const { toast } = useToast();

  return (
    <div className="space-y-3">
      {SOCIAL_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() =>
            toast({
              title: "Not connected in this demo",
              description: `${option.label.replace("Continue with ", "")} sign-in would happen here in a live store.`,
            })
          }
          className="flex h-12 w-full items-center justify-center border border-border text-sm font-medium transition-colors hover:border-luxe-black"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
