import type {
  AboutPageContent,
  BlogPost,
  Campaign,
  Collection,
  HomepageConfig,
  LandingPage,
  Lookbook,
  Money,
  NavigationConfig,
  Product,
  ProductGender,
  SiteSettings,
} from "@/types";

/**
 * The vendor-neutral domain model every adapter (mock, Shopify, WooCommerce, Medusa,
 * Commerce Layer, a custom API) speaks. Nothing in `components/` or `app/` should ever
 * import a vendor SDK directly — everything goes through `CommerceProvider`.
 */

// ---------------------------------------------------------------------------
// Shared commerce primitives
// ---------------------------------------------------------------------------

export interface Address {
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  region?: string;
  postalCode: string;
  countryCode: string;
  phone?: string;
}

/** An address that's been saved to a customer's account — has a stable id, unlike a one-off checkout address. */
export interface CustomerAddress extends Address {
  id: string;
}

export interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  addresses: CustomerAddress[];
  defaultAddressId?: string;
  acceptsMarketing: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

export interface CartLineItem {
  id: string;
  productId: string;
  slug: string;
  name: string;
  image: { src: string; alt: string };
  color: string;
  size: string;
  unitPrice: Money;
  quantity: number;
  /** Stock available for this exact variant at add-time — drives quantity-stepper limits. */
  maxQuantity: number;
  savedForLater: boolean;
  addedAt: string;
}

export interface AppliedDiscount {
  code: string;
  type: "percentage" | "fixed";
  value: number;
  amount: Money;
}

export interface AppliedGiftCard {
  code: string;
  balance: Money;
  amountApplied: Money;
}

export interface CartTotals {
  subtotal: Money;
  discountTotal: Money;
  giftCardTotal: Money;
  shippingTotal: Money;
  /** Flat fee, present (possibly zero) once a checkout has a gift-wrap total to report — always zero on a plain Cart, which has no gift-wrap concept of its own. */
  giftWrapTotal: Money;
  /** Payment-method surcharge (e.g. a Cash-on-Delivery fee). Always computed server-side by lib/payments/fees.ts — zero on a plain Cart, which has no payment method yet. */
  paymentFeeTotal: Money;
  taxTotal: Money;
  total: Money;
}

export interface Cart {
  id: string;
  lineItems: CartLineItem[];
  savedItems: CartLineItem[];
  discounts: AppliedDiscount[];
  giftCards: AppliedGiftCard[];
  currencyCode: string;
  totals: CartTotals;
  createdAt: string;
  updatedAt: string;
}

export interface AddLineItemInput {
  productId: string;
  color: string;
  size: string;
  quantity: number;
}

export interface ShippingRate {
  id: string;
  label: string;
  description: string;
  price: Money;
  estimatedDelivery: string;
}

/** Thrown by CartService methods instead of a generic Error, so UI can branch on `.code`. */
export class CommerceError extends Error {
  code:
    | "OUT_OF_STOCK"
    | "INVALID_DISCOUNT_CODE"
    | "DISCOUNT_ALREADY_APPLIED"
    | "INVALID_GIFT_CARD"
    | "CART_NOT_FOUND"
    | "LINE_ITEM_NOT_FOUND"
    | "INVALID_VARIANT"
    | "INVALID_CREDENTIALS"
    | "EMAIL_IN_USE"
    | "CHECKOUT_INCOMPLETE";

  constructor(code: CommerceError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "CommerceError";
  }
}

// ---------------------------------------------------------------------------
// Checkout & Orders
// ---------------------------------------------------------------------------

export type CheckoutStatus = "open" | "awaiting_payment" | "completed";

export interface Checkout {
  id: string;
  cartId: string;
  email?: string;
  shippingAddress?: Address;
  billingAddress?: Address;
  shippingRate?: ShippingRate;
  giftWrap?: boolean;
  giftMessage?: string;
  /** The method the shopper picked. A stored preference only — availability is re-validated server-side at order time. */
  paymentMethodId?: string;
  status: CheckoutStatus;
  createdAt: string;
}

export interface Order {
  id: string;
  checkoutId: string;
  customerEmail: string;
  lineItems: CartLineItem[];
  totals: CartTotals;
  shippingAddress: Address;
  billingAddress: Address;
  shippingRate: ShippingRate;
  giftWrap?: boolean;
  giftMessage?: string;
  status: "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";
  /** Set once a shipment exists — see lib/courier/. */
  trackingNumber?: string;
  carrier?: string;
  trackingUrl?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Returns
// ---------------------------------------------------------------------------

export interface ReturnItem {
  productId: string;
  name: string;
  color: string;
  size: string;
  quantity: number;
}

export interface Return {
  id: string;
  orderId: string;
  customerEmail: string;
  items: ReturnItem[];
  reason: string;
  status: "requested" | "approved" | "rejected" | "received" | "refunded";
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Wishlist
// ---------------------------------------------------------------------------

export interface WishlistItem {
  id: string;
  productId: string;
  addedAt: string;
}

export interface Wishlist {
  id: string;
  items: WishlistItem[];
  shareToken?: string;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface SearchOptions {
  category?: string;
  gender?: ProductGender;
  collectionId?: string;
  colors?: string[];
  sizes?: string[];
  tags?: string[];
  availability?: "in-stock" | "all";
  isNew?: boolean;
  isSale?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sort?: "relevance" | "price-asc" | "price-desc" | "newest";
  limit?: number;
  /** 1-indexed. Combined with `pageSize` for PLP pagination/infinite scroll; omit both to keep the old `limit`-only behavior (search overlay). */
  page?: number;
  pageSize?: number;
}

export interface SearchFacetValue {
  value: string;
  count: number;
}

export interface SearchFacet {
  key: string;
  label: string;
  values: SearchFacetValue[];
}

export interface SearchResult {
  query: string;
  products: Product[];
  total: number;
  facets: SearchFacet[];
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthSignUpInput extends AuthCredentials {
  firstName: string;
  lastName: string;
  /** Captured from a `?ref=` landing URL (see lib/referral.ts) — invisible in the register form itself, merged in by AuthProvider.signUp. */
  referralCode?: string;
}

export interface AuthSession {
  customer: Customer;
  token: string;
  expiresAt: string;
}

/**
 * Returned by signUp instead of a real AuthSession when the email is already
 * registered — deliberately session-free (see app/api/auth/sign-up/route.ts).
 * Returning the real existing customer's session here would be account
 * takeover; returning fabricated customer data would make the frontend
 * believe it's signed in when it isn't. This shape lets the caller show a
 * neutral "check your email or sign in" message instead of either.
 */
export interface AuthSignUpRequiresLogin {
  ok: true;
  requiresLogin: true;
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export type AnalyticsEventName =
  | "page_view"
  | "product_view"
  | "add_to_cart"
  | "remove_from_cart"
  | "begin_checkout"
  | "purchase"
  | "search"
  | "add_to_wishlist"
  | "remove_from_wishlist"
  | "sign_in"
  | "sign_up"
  | "experiment_exposure";

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  properties?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Service interfaces
// ---------------------------------------------------------------------------

export interface ProductQueryParams {
  category?: string;
  gender?: ProductGender;
  /** When true and `gender` is set, also include unisex products. */
  includeUnisex?: boolean;
  collectionId?: string;
  tag?: string;
  isNew?: boolean;
  isSale?: boolean;
}

export interface ProductService {
  getAll(params?: ProductQueryParams): Promise<Product[]>;
  getBySlug(slug: string): Promise<Product | null>;
  getById(id: string): Promise<Product | null>;
  getByIds(ids: string[]): Promise<Product[]>;
  getRelated(productId: string, limit?: number): Promise<Product[]>;
}

export interface CollectionService {
  getAll(): Promise<Collection[]>;
  getBySlug(slug: string): Promise<Collection | null>;
  getProducts(collectionId: string): Promise<Product[]>;
}

export interface CartService {
  getOrCreateCart(cartId?: string | null): Promise<Cart>;
  getCart(cartId: string): Promise<Cart | null>;
  addLineItem(cartId: string, input: AddLineItemInput): Promise<Cart>;
  updateLineItemQuantity(cartId: string, lineItemId: string, quantity: number): Promise<Cart>;
  removeLineItem(cartId: string, lineItemId: string): Promise<Cart>;
  saveForLater(cartId: string, lineItemId: string): Promise<Cart>;
  moveToCart(cartId: string, lineItemId: string): Promise<Cart>;
  applyDiscountCode(cartId: string, code: string): Promise<Cart>;
  removeDiscountCode(cartId: string, code: string): Promise<Cart>;
  applyGiftCard(cartId: string, code: string): Promise<Cart>;
  removeGiftCard(cartId: string, code: string): Promise<Cart>;
  estimateShipping(cartId: string, address: Partial<Address>): Promise<ShippingRate[]>;
  /**
   * Associates this cart with the just-signed-in customer — adopts it if they have no
   * cart yet, else merges the two carts' line items server-side. No customerId param:
   * the caller is always the currently-authenticated customer, resolved server-side
   * from the session cookie, never from a client-supplied id. (There's no separate
   * client-callable `mergeCarts` — nothing outside `linkCustomer`'s own server-side
   * implementation ever needs to merge two carts directly.)
   */
  linkCustomer(cartId: string): Promise<Cart>;
  getRecommendations(cartId: string, limit?: number): Promise<Product[]>;
  clearCart(cartId: string): Promise<Cart>;
}

/**
 * What the checkout gets back after placing an order. The `payment` half is
 * deliberately provider-agnostic (§1): the checkout learns that it must redirect,
 * or show instructions, or nothing at all — never that Stripe, Piraeus or IRIS is
 * involved. Adding a provider changes nothing about this shape.
 */
export interface CompleteCheckoutResult {
  order: Order;
  payment: {
    id: string;
    status: string;
    methodId: string;
    /** Display-only; the storefront never uses this to branch on vendor behaviour. */
    providerId: string;
  } | null;
  /** The next thing the customer has to do, if anything. */
  customerAction: {
    type: "none" | "redirect" | "display_instructions" | "display_qr" | "client_confirmation";
    redirectUrl?: string;
    clientSecret?: string;
    qrPayload?: string;
    qrImageUrl?: string;
    instructions?: { label: string; value: string }[];
    message?: string;
    expiresAt?: string;
  } | null;
}

export interface CheckoutService {
  createCheckout(cartId: string): Promise<Checkout>;
  updateEmail(checkoutId: string, email: string): Promise<Checkout>;
  updateShippingAddress(checkoutId: string, address: Address): Promise<Checkout>;
  updateBillingAddress(checkoutId: string, address: Address): Promise<Checkout>;
  setShippingRate(checkoutId: string, rateId: string): Promise<Checkout>;
  setGiftWrap(checkoutId: string, input: { giftWrap: boolean; giftMessage?: string }): Promise<Checkout>;
  setPaymentMethod(checkoutId: string, paymentMethodId: string): Promise<Checkout>;
  completeCheckout(checkoutId: string, cart: Cart): Promise<CompleteCheckoutResult>;
}

export interface CustomerService {
  getCustomer(customerId: string): Promise<Customer | null>;
  updateProfile(customerId: string, patch: Partial<Pick<Customer, "firstName" | "lastName" | "phone" | "acceptsMarketing">>): Promise<Customer>;
  addAddress(customerId: string, address: Address): Promise<Customer>;
  updateAddress(customerId: string, addressId: string, address: Address): Promise<Customer>;
  removeAddress(customerId: string, addressId: string): Promise<Customer>;
  getOrders(customerId: string): Promise<Order[]>;
}

export interface WishlistService {
  getWishlist(ownerId: string): Promise<Wishlist>;
  addItem(ownerId: string, productId: string): Promise<Wishlist>;
  removeItem(ownerId: string, productId: string): Promise<Wishlist>;
  /**
   * Merges the anonymous guest wishlist into the just-signed-in customer's wishlist
   * (idempotent productId union). Session-gated server-side, same rationale as
   * `CartService.linkCustomer`.
   */
  linkCustomer(anonymousId: string): Promise<Wishlist>;
}

export interface SearchService {
  search(query: string, options?: SearchOptions): Promise<SearchResult>;
  getSuggestions(query: string, limit?: number): Promise<string[]>;
}

export interface CMSService {
  getHomepage(): Promise<HomepageConfig>;
  getNavigation(): Promise<NavigationConfig>;
  getSettings(): Promise<SiteSettings>;
  getBlogPosts(): Promise<BlogPost[]>;
  getBlogPost(slug: string): Promise<BlogPost | null>;
  getAboutPage(): Promise<AboutPageContent>;
  getCampaigns(): Promise<Campaign[]>;
  getCampaign(slug: string): Promise<Campaign | null>;
  getLookbooks(): Promise<Lookbook[]>;
  getLookbook(slug: string): Promise<Lookbook | null>;
  getLandingPage(slug: string): Promise<LandingPage | null>;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface AuthenticationService {
  signIn(credentials: AuthCredentials): Promise<AuthSession>;
  signUp(input: AuthSignUpInput): Promise<AuthSession | AuthSignUpRequiresLogin>;
  signOut(): Promise<void>;
  getSession(): Promise<AuthSession | null>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(token: string, password: string): Promise<AuthSession>;
  changePassword(customerId: string, input: ChangePasswordInput): Promise<void>;
}

export interface AnalyticsService {
  track(event: AnalyticsEvent): void;
  identify(customerId: string, traits?: Record<string, unknown>): void;
  page(path: string, properties?: Record<string, unknown>): void;
}

export interface CommerceProvider {
  readonly name: string;
  products: ProductService;
  collections: CollectionService;
  cart: CartService;
  checkout: CheckoutService;
  customer: CustomerService;
  wishlist: WishlistService;
  search: SearchService;
  cms: CMSService;
  auth: AuthenticationService;
  analytics: AnalyticsService;
}
