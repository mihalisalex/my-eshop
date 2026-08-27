import { getTranslations } from "next-intl/server";
import type { SimpleContentPage } from "@/types";

// Async because the one string it owns has to come from the request locale. It renders the
// legal documents, so an English "Last updated" above Greek consumer-rights text was the last
// English word on those pages.
export async function SimplePageContent({ page }: { page: SimpleContentPage }) {
  const t = await getTranslations("Legal");

  return (
    <div className="container-luxe max-w-3xl py-14 md:py-20">
      <h1 className="font-heading text-4xl md:text-5xl">{page.title}</h1>
      {page.intro ? <p className="mt-4 text-lg text-luxe-gray-dark">{page.intro}</p> : null}
      {page.updatedAt ? (
        <p className="mt-2 text-xs tracking-[0.05em] text-luxe-gray-dark uppercase">
          {t("lastUpdated", { date: page.updatedAt })}
        </p>
      ) : null}

      <div className="mt-14 space-y-10">
        {page.sections.map((section) => (
          <div key={section.heading}>
            <h2 className="font-heading text-2xl">{section.heading}</h2>
            <p className="mt-3 text-luxe-gray-dark">{section.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
