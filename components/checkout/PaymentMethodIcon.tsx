import { Banknote, CreditCard, Landmark, QrCode, Smartphone, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Maps the provider's `icon` key to a mark. The key is a domain value
 * (`PaymentMethodDefinition.icon`), not markup, so the payment layer never has to
 * know anything about React — and adding a provider means adding one case here,
 * with a sensible fallback if it's forgotten.
 */
export function PaymentMethodIcon({ icon, className }: { icon: string; className?: string }) {
  const props = { className: cn("size-5 shrink-0", className), strokeWidth: 1.5 };
  switch (icon) {
    case "cash":
      return <Banknote {...props} />;
    case "bank":
      return <Landmark {...props} />;
    case "card":
      return <CreditCard {...props} />;
    case "apple":
      return <Smartphone {...props} />;
    case "iris":
      return <QrCode {...props} />;
    default:
      return <Wallet {...props} />;
  }
}
