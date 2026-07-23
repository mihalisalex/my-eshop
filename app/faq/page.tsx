import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { JsonLd } from "@/components/shared/JsonLd";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { faqSchema } from "@/lib/seo";
import { getFaqPage, getNavigation, getSiteSettings } from "@/services";

export const metadata: Metadata = {
  title: "FAQ",
};

export default async function FaqPage() {
  const [navigation, settings, page] = await Promise.all([getNavigation(), getSiteSettings(), getFaqPage()]);

  const allQuestions = page.categories.flatMap((category) => category.questions);

  return (
    <>
      <Header navigation={navigation} siteName={settings.siteName} announcementMessages={settings.announcementMessages} />
      <main className="flex-1 pt-header">
        <JsonLd data={faqSchema(allQuestions)} />
        <div className="container-luxe max-w-3xl py-14 md:py-20">
          <h1 className="font-heading text-4xl md:text-5xl">Frequently Asked Questions</h1>
          {page.intro ? <p className="mt-4 text-lg text-luxe-gray-dark">{page.intro}</p> : null}

          <div className="mt-14 space-y-12">
            {page.categories.map((category) => (
              <div key={category.title}>
                <h2 className="font-heading text-2xl">{category.title}</h2>
                <Accordion className="mt-4 border-t border-border">
                  {category.questions.map((item) => (
                    <AccordionItem key={item.question} value={item.question}>
                      <AccordionTrigger className="py-4 text-sm font-medium no-underline hover:no-underline">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent>
                        <p className="text-luxe-gray-dark">{item.answer}</p>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer navigation={navigation} settings={settings} />
    </>
  );
}
