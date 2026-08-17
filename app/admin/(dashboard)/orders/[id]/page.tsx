import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { OrderStatusSelect } from "@/components/admin/OrderStatusSelect";
import { OrderTrackingForm } from "@/components/admin/OrderTrackingForm";
import { formatDate, formatMoney } from "@/lib/format";
import Link from "next/link";
import { getOrderById } from "@/services/orders";
import { getPaymentsForOrder } from "@/services/payments";
import { paymentProviderRegistry } from "@/lib/payments/registry";
import { PaymentStatusPill } from "@/components/admin/PaymentStatusPill";
import { updateOrderStatusAction, updateOrderTrackingAction, createAcsShipmentAction } from "@/app/admin/(dashboard)/orders/actions";
import { isAcsCourierConfigured } from "@/lib/courier";

interface AdminOrderDetailPageProps {
  params: Promise<{ id: string }>;
}

function addressLines(address: { firstName: string; lastName: string; company?: string; address1: string; address2?: string; city: string; region?: string; postalCode: string; countryCode: string; phone?: string }) {
  return [
    `${address.firstName} ${address.lastName}`,
    address.company,
    address.address1,
    address.address2,
    `${address.city}${address.region ? `, ${address.region}` : ""} ${address.postalCode}`,
    address.countryCode,
    address.phone,
  ].filter(Boolean);
}

export default async function AdminOrderDetailPage({ params }: AdminOrderDetailPageProps) {
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) notFound();

  // Payment status is shown alongside the order status, never merged into it — a
  // Cash-on-Delivery order is legitimately "processing" while its payment is still
  // pending, and this page is where that distinction actually matters to someone
  // deciding whether to dispatch.
  const payments = await getPaymentsForOrder(order.id);

  const boundUpdateTracking = updateOrderTrackingAction.bind(null, order.id);
  const boundCreateAcsShipment = createAcsShipmentAction.bind(null, order.id);

  return (
    <div>
      <AdminPageHeader
        title={`Order #${order.id.slice(-8).toUpperCase()}`}
        description={`Placed ${formatDate(order.createdAt)} by ${order.customerEmail}`}
        actions={<OrderStatusSelect orderId={order.id} defaultStatus={order.status} onChange={updateOrderStatusAction} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="border border-border bg-luxe-white">
            <h3 className="border-b border-border p-4 text-sm font-medium tracking-[0.05em] uppercase">
              Items ({order.lineItems.length})
            </h3>
            <div className="divide-y divide-border">
              {order.lineItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                  <div>
                    <p>{item.name}</p>
                    <p className="text-xs text-luxe-gray-dark">
                      {item.color} · {item.size} · Qty {item.quantity}
                    </p>
                  </div>
                  <p>{formatMoney({ amount: item.unitPrice.amount * item.quantity, currencyCode: item.unitPrice.currencyCode })}</p>
                </div>
              ))}
            </div>
            <div className="space-y-1.5 border-t border-border p-4 text-sm">
              <div className="flex justify-between text-luxe-gray-dark">
                <span>Subtotal</span>
                <span>{formatMoney(order.totals.subtotal)}</span>
              </div>
              {order.totals.discountTotal.amount > 0 ? (
                <div className="flex justify-between text-luxe-gray-dark">
                  <span>Discount</span>
                  <span>-{formatMoney(order.totals.discountTotal)}</span>
                </div>
              ) : null}
              {order.totals.giftCardTotal.amount > 0 ? (
                <div className="flex justify-between text-luxe-gray-dark">
                  <span>Gift Card</span>
                  <span>-{formatMoney(order.totals.giftCardTotal)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-luxe-gray-dark">
                <span>Shipping ({order.shippingRate.label})</span>
                <span>{formatMoney(order.totals.shippingTotal)}</span>
              </div>
              {order.totals.giftWrapTotal.amount > 0 ? (
                <div className="flex justify-between text-luxe-gray-dark">
                  <span>Gift Wrapping</span>
                  <span>{formatMoney(order.totals.giftWrapTotal)}</span>
                </div>
              ) : null}
              {order.totals.paymentFeeTotal.amount > 0 ? (
                <div className="flex justify-between text-luxe-gray-dark">
                  <span>Payment Fee</span>
                  <span>{formatMoney(order.totals.paymentFeeTotal)}</span>
                </div>
              ) : null}
              <div className="flex justify-between pt-1.5 text-sm font-medium">
                <span>Total</span>
                <span>{formatMoney(order.totals.total)}</span>
              </div>
              <div className="flex justify-between text-xs text-luxe-gray-dark">
                <span>Includes VAT</span>
                <span>{formatMoney(order.totals.taxTotal)}</span>
              </div>
            </div>
          </div>

          <OrderTrackingForm
            defaultCarrier={order.carrier}
            defaultTrackingNumber={order.trackingNumber}
            defaultTrackingUrl={order.trackingUrl}
            courierProviderIsAcs={isAcsCourierConfigured()}
            onSave={boundUpdateTracking}
            onCreateAcsShipment={boundCreateAcsShipment}
          />
        </div>

        <div className="space-y-6">
          <div className="border border-border bg-luxe-white p-4">
            <h3 className="mb-3 text-xs font-medium tracking-[0.05em] uppercase text-luxe-gray-dark">Payment</h3>
            {payments.length === 0 ? (
              <p className="text-sm text-luxe-gray-dark">
                No payment record — this order was placed before a payment method was selected.
              </p>
            ) : (
              <ul className="space-y-3">
                {payments.map((payment) => {
                  const definition = paymentProviderRegistry.getMethod(payment.methodId);
                  return (
                    <li key={payment.id} className="text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link href={`/admin/payments/${payment.id}`} className="hover:underline">
                          {definition?.defaultDisplayName ?? payment.methodId}
                        </Link>
                        <PaymentStatusPill status={payment.status} />
                      </div>
                      <p className="mt-1 text-xs text-luxe-gray-dark">
                        {formatMoney(payment.amount)}
                        {payment.refundedAmount.amount > 0 ? ` · ${formatMoney(payment.refundedAmount)} refunded` : ""}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {order.giftWrap ? (
            <div className="border border-border bg-luxe-white p-4">
              <h3 className="mb-3 text-xs font-medium tracking-[0.05em] uppercase text-luxe-gray-dark">Gift Wrapping</h3>
              <p className="text-sm">{order.giftMessage ? `"${order.giftMessage}"` : "No message added"}</p>
            </div>
          ) : null}
          <div className="border border-border bg-luxe-white p-4">
            <h3 className="mb-3 text-xs font-medium tracking-[0.05em] uppercase text-luxe-gray-dark">Shipping Address</h3>
            <div className="text-sm">
              {addressLines(order.shippingAddress).map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
          <div className="border border-border bg-luxe-white p-4">
            <h3 className="mb-3 text-xs font-medium tracking-[0.05em] uppercase text-luxe-gray-dark">Billing Address</h3>
            <div className="text-sm">
              {addressLines(order.billingAddress).map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
