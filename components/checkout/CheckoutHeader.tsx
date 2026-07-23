import Link from "next/link";
import { Lock } from "lucide-react";

interface CheckoutHeaderProps {
  siteName: string;
}

export function CheckoutHeader({ siteName }: CheckoutHeaderProps) {
  return (
    <header className="border-b border-border bg-luxe-white">
      <div className="container-luxe flex h-16 items-center justify-between">
        <Link href="/" className="font-heading text-lg tracking-[0.1em] uppercase">
          {siteName}
        </Link>
        <div className="flex items-center gap-1.5 text-xs text-luxe-gray-dark">
          <Lock className="size-3.5" strokeWidth={1.5} />
          Secure Checkout
        </div>
        <Link href="/cart" className="text-xs font-medium tracking-[0.05em] uppercase underline underline-offset-4">
          Back to Bag
        </Link>
      </div>
    </header>
  );
}
