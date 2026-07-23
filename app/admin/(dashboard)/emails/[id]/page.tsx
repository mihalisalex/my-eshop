import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { formatDate } from "@/lib/format";
import { getEmailLogById } from "@/services/emails";

interface EmailDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminEmailDetailPage({ params }: EmailDetailPageProps) {
  const { id } = await params;
  const email = await getEmailLogById(id);
  if (!email) notFound();

  return (
    <div>
      <Link href="/admin/emails" className="mb-4 flex items-center gap-1.5 text-xs text-luxe-gray-dark hover:text-luxe-black">
        <ArrowLeft className="size-3.5" strokeWidth={1.5} />
        Back to Emails
      </Link>

      <AdminPageHeader title={email.subject} description={`To ${email.to} · ${formatDate(email.sentAt)} · template: ${email.template}`} />

      <div className="border border-border bg-luxe-white">
        <div className="border-b border-border px-5 py-3 text-xs font-medium tracking-[0.05em] text-luxe-gray-dark uppercase">
          Rendered HTML
        </div>
        <iframe title="Email preview" srcDoc={email.html} sandbox="" className="h-[600px] w-full" />
      </div>

      <div className="mt-6 border border-border bg-luxe-white">
        <div className="border-b border-border px-5 py-3 text-xs font-medium tracking-[0.05em] text-luxe-gray-dark uppercase">
          Plain-text version
        </div>
        <pre className="overflow-x-auto p-5 text-sm whitespace-pre-wrap text-luxe-black">{email.text}</pre>
      </div>
    </div>
  );
}
