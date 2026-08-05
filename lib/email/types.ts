export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** "order-confirmation" | "shipping-update" | "password-reset" | "return-status-update" | "welcome" | "contact-message" | "referral-reward" | "abandoned-cart" | "review-request" | "back-in-stock" | "account-already-exists" — logged, not enforced. */
  template: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}
