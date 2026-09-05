import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { getSizeGuidePage, getNavigation, getSiteSettings } from "@/services";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pages");
  return {
  title: t("sizeGuideTitle"),
  };
}

export default async function SizeGuidePage() {
  const t = await getTranslations("Pages");
  const [navigation, settings, page] = await Promise.all([getNavigation(), getSiteSettings(), getSizeGuidePage()]);

  return (
    <>
      <Header navigation={navigation} siteName={settings.siteName} announcementMessages={settings.announcementMessages} />
      <main id="main" className="flex-1 pt-header">
        <div className="container-luxe max-w-3xl py-14 md:py-20">
          <h1 className="font-heading text-4xl md:text-5xl">{t("sizeGuideTitle")}</h1>
          <p className="mt-4 text-lg text-luxe-gray-dark">{page.intro}</p>

          <div className="mt-14 space-y-14">
            {page.categories.map((category) => (
              <div key={category.title}>
                <h2 className="font-heading text-2xl">{category.title}</h2>
                {category.note ? <p className="mt-2 text-sm text-luxe-gray-dark">{category.note}</p> : null}
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[420px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-luxe-black">
                        {category.headers.map((header) => (
                          <th key={header} className="px-3 py-2 text-left font-medium tracking-[0.05em] uppercase">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {category.rows.map((row) => (
                        <tr key={row[0]} className="border-b border-luxe-gray-light">
                          {row.map((cell, index) => (
                            <td key={index} className="px-3 py-2 text-luxe-gray-dark">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer navigation={navigation} settings={settings} />
    </>
  );
}
