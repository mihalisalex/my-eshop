import "dotenv/config";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Rewrites data/legal.json for a real Greek e-shop (QA-007).
 *
 * What was there could not ship: the Privacy Policy ended with a section headed "This Is
 * a Demo" telling visitors the store was built for evaluation, and none of the three
 * documents carried anything Greek and EU law actually require of a distance seller —
 * no trader identity, no right of withdrawal, no complaint route, no governing law.
 *
 * Everything below is written to be true of THIS application as it actually behaves:
 * the data it really collects, the processors it really uses, the 30-day returns policy
 * the storefront really states, and the 14-day statutory withdrawal right that sits
 * alongside it. Nothing describes a feature that does not exist.
 *
 * Trader identity is deliberately left as a single, obvious placeholder token rather than
 * invented. `COMPANY_DETAILS_PENDING` appears wherever a registered name, address, VAT
 * (ΑΦΜ) or ΓΕΜΗ number belongs — see scripts/check-legal-placeholders.ts, which fails if
 * any survives, so this cannot reach production unnoticed.
 */
const PENDING = "COMPANY_DETAILS_PENDING";
const UPDATED = "2026-08-18";

interface Section {
  heading: string;
  body: string;
}
interface LegalPage {
  slug: string;
  title: string;
  updatedAt: string;
  sections: Section[];
}

const pages: LegalPage[] = [
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    updatedAt: UPDATED,
    sections: [
      {
        heading: "Who We Are",
        body: `This shop is operated by ${PENDING} ("we", "us"), registered in Greece at ${PENDING}, VAT (ΑΦΜ) ${PENDING}, ΓΕΜΗ ${PENDING}. We are the data controller for the personal data described here. For any privacy question, or to exercise the rights set out below, contact us at ${PENDING}.`,
      },
      {
        heading: "What We Collect",
        body:
          "When you place an order we collect the name, email address, postal address and phone number you enter at checkout, together with the contents and total of your order. A phone number is required because our courier needs a way to reach you about the delivery.\n\n" +
          "If you create an account we also store your password as a one-way hash — we never hold it in a readable form and cannot recover it for you.\n\n" +
          "We never see or store full card numbers. Card payments are handled entirely by our payment provider on their own systems; we receive only the result of the payment and, at most, the last four digits and card brand for your order record.",
      },
      {
        heading: "Why We Use It, and On What Basis",
        body:
          "To perform our contract with you: taking payment, fulfilling and delivering your order, handling returns and refunds, and sending the transactional emails that go with them (order confirmation, dispatch, returns).\n\n" +
          "To meet legal obligations: retaining invoices and transaction records for the period Greek tax law requires.\n\n" +
          "With your consent: marketing email, if you have subscribed, and any non-essential cookies you have accepted. You can withdraw either at any time, and withdrawing does not affect processing carried out beforehand.\n\n" +
          "For our legitimate interests: keeping the shop secure and working, including rate-limiting to prevent abuse.",
      },
      {
        heading: "Who We Share It With",
        body:
          "Only the processors needed to run the shop, and only with what they need:\n\n" +
          "• Our payment provider, to take and refund payments.\n" +
          "• Our courier, to deliver your order — name, address and phone number.\n" +
          "• Our email provider, to send transactional and (where consented) marketing email.\n" +
          "• Our hosting and database providers, who store the shop's data on our behalf.\n\n" +
          "We do not sell your personal data, and we do not share it for anyone else's marketing.",
      },
      {
        heading: "How Long We Keep It",
        body:
          "Order and invoice records are kept for as long as Greek tax and accounting law requires. Account details are kept until you ask us to delete the account. Marketing consent is kept until you withdraw it. Abandoned carts and checkout sessions that never became an order are kept only briefly and then cleared.",
      },
      {
        heading: "Your Rights",
        body:
          `Under the GDPR you may ask us for a copy of your data, ask us to correct it, ask us to delete it, ask us to restrict or stop a particular use, object to processing based on our legitimate interests, and ask for your data in a portable form. Where processing relies on consent you can withdraw it at any time.\n\n` +
          `Write to ${PENDING} and we will respond within one month. If you believe we have handled your data improperly you can complain to the Hellenic Data Protection Authority (Αρχή Προστασίας Δεδομένων Προσωπικού Χαρακτήρα), Kifissias 1-3, 115 23 Athens, www.dpa.gr.`,
      },
      {
        heading: "Cookies",
        body: "We use a small number of cookies and similar storage. The essential ones keep your basket and your signed-in session working and cannot be switched off. Anything beyond that is only set after you accept it. Our Cookie Policy explains each one and how to change your choice.",
      },
    ],
  },
  {
    slug: "terms-of-service",
    title: "Terms of Service",
    updatedAt: UPDATED,
    sections: [
      {
        heading: "Who You Are Buying From",
        body: `Purchases on this site are a distance contract with ${PENDING}, registered in Greece at ${PENDING}, VAT (ΑΦΜ) ${PENDING}, ΓΕΜΗ ${PENDING}, contactable at ${PENDING}. These terms apply to every order placed here.`,
      },
      {
        heading: "Prices and VAT",
        body:
          "All prices are shown in euro and include Greek VAT at the applicable rate. The price shown on the product page is the price you pay for the item; shipping is added at checkout and shown separately before you confirm.\n\n" +
          "We take care to price correctly, but if an obvious pricing error means an order was placed at a clearly incorrect price, we may cancel that order and refund you in full rather than fulfil it. We will tell you if this happens.",
      },
      {
        heading: "Placing an Order",
        body:
          "Your order is an offer to buy. The contract is formed when we send you an order confirmation by email. If an item turns out to be unavailable after you order, we will contact you and refund that item in full.\n\n" +
          "Availability shown on the site reflects our stock at that moment and can change while an item sits in your basket.",
      },
      {
        heading: "Payment",
        body: "Payment is taken through the methods offered at checkout. Card details are entered on our payment provider's systems and never reach this site. Where cash on delivery is offered, payment is made to the courier when your order arrives.",
      },
      {
        heading: "Delivery",
        body: "Delivery estimates shown at checkout are working-day estimates for mainland Greece and exclude public holidays. They are estimates, not guarantees. Risk in the goods passes to you on delivery.",
      },
      {
        heading: "Your Right to Withdraw",
        body:
          "You have 14 days from the day you receive your order to withdraw from the contract without giving any reason. To do so, tell us clearly before the 14 days are up — an email is enough.\n\n" +
          "Return the goods to us within 14 days of telling us. We will refund everything you paid, including standard outbound delivery, within 14 days of receiving the goods back or of proof you have sent them, whichever comes first, using the same payment method you used.\n\n" +
          "You bear the cost of returning the goods, and you are responsible for any reduction in their value caused by handling beyond what is needed to establish their nature and characteristics — trying shoes on indoors is fine; wearing them outside is not.\n\n" +
          "Separately from this statutory right, we offer free returns within 30 days of delivery on unworn items in their original packaging. That offer is in addition to, and does not limit, your rights above.",
      },
      {
        heading: "If Something Is Wrong With Your Order",
        body: "You have the legal guarantee of conformity under Greek and EU consumer law for goods that are faulty, damaged or not as described. Contact us and we will repair, replace or refund as the law provides. This is separate from, and unaffected by, the withdrawal right above.",
      },
      { heading: "Intellectual Property", body: "All content on this site — product photography, copy, and the shop's design — belongs to us or our licensors and may not be reproduced commercially without permission." },
      {
        heading: "Liability",
        body: "Nothing here limits our liability for death or personal injury caused by negligence, for fraud, or for anything else that cannot be limited by law. Subject to that, we are not liable for indirect or consequential losses arising from use of this site.",
      },
      {
        heading: "Complaints and Dispute Resolution",
        body:
          `Please contact us first at ${PENDING} — most things are resolved quickly.\n\n` +
          "If we cannot resolve it between us, you may use the European Commission's Online Dispute Resolution platform at ec.europa.eu/consumers/odr, or refer the matter to the Hellenic Consumer's Ombudsman (Συνήγορος του Καταναλωτή), www.synigoroskatanaloti.gr.",
      },
      { heading: "Governing Law", body: "These terms are governed by Greek law, and the courts of Greece have jurisdiction. This does not deprive you of the protection of mandatory consumer rules in your country of residence." },
    ],
  },
  {
    slug: "cookie-policy",
    title: "Cookie Policy",
    updatedAt: UPDATED,
    sections: [
      { heading: "What Cookies Are", body: "Small files and similar browser storage that let a site remember things between page loads — such as what is in your basket, or that you are signed in." },
      {
        heading: "Essential — Always On",
        body:
          "These make the shop work and cannot be switched off:\n\n" +
          "• Your basket, so items survive moving between pages.\n" +
          "• Your signed-in session, if you have an account, and the admin session for staff.\n" +
          "• Your language choice.\n" +
          "• Your cookie choice itself, so we do not ask again on every page.",
      },
      { heading: "Analytics and Marketing — Only With Consent", body: "We set nothing in these categories unless you accept them in the cookie banner. If you decline, none are set. If you accept and later change your mind, clear this site's data in your browser and the banner will ask again." },
      { heading: "Third Parties", body: "Our payment provider may set cookies on its own pages during checkout, and our hosting provider sets cookies needed to serve the site securely. Neither is used to advertise to you." },
      { heading: "Managing Cookies", body: "Every browser lets you view and delete cookies for a site, and block them entirely. Blocking essential cookies will stop the basket and sign-in from working." },
    ],
  },
];

const target = resolve(process.cwd(), "data/legal.json");
writeFileSync(target, `${JSON.stringify(pages, null, 2)}\n`, "utf8");

const placeholders = JSON.stringify(pages).split(PENDING).length - 1;
console.log(`Wrote ${pages.length} legal pages to data/legal.json`);
console.log(`${placeholders} ${PENDING} tokens remain — replace them before launch.`);
