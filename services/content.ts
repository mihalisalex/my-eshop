import sustainabilityData from "@/data/sustainability.json";
import careersData from "@/data/careers.json";
import shippingReturnsData from "@/data/shipping-returns.json";
import faqData from "@/data/faq.json";
import sizeGuideData from "@/data/size-guide.json";
import legalData from "@/data/legal.json";
import type { SimpleContentPage, FaqPageContent, SizeGuideContent, LegalPage } from "@/types";

const sustainability = sustainabilityData as SimpleContentPage;
const careers = careersData as SimpleContentPage;
const shippingReturns = shippingReturnsData as SimpleContentPage;
const faq = faqData as FaqPageContent;
const sizeGuide = sizeGuideData as SizeGuideContent;
const legalPages = legalData as LegalPage[];

export async function getSustainabilityPage(): Promise<SimpleContentPage> {
  return sustainability;
}

export async function getCareersPage(): Promise<SimpleContentPage> {
  return careers;
}

export async function getShippingReturnsPage(): Promise<SimpleContentPage> {
  return shippingReturns;
}

export async function getFaqPage(): Promise<FaqPageContent> {
  return faq;
}

export async function getSizeGuidePage(): Promise<SizeGuideContent> {
  return sizeGuide;
}

export async function getLegalPages(): Promise<LegalPage[]> {
  return legalPages;
}

export async function getLegalPage(slug: string): Promise<LegalPage | undefined> {
  return legalPages.find((page) => page.slug === slug);
}
