import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Package, Truck, CheckCircle2, Clock, ExternalLink, Mail } from "lucide-react";

const STATUS_STEPS = [
  { key: "PENDING",    label: "Order Placed",   icon: Clock         },
  { key: "PROCESSING", label: "In Production",  icon: Package       },
  { key: "SHIPPED",    label: "Shipped",         icon: Truck         },
  { key: "DELIVERED",  label: "Delivered",       icon: CheckCircle2  },
] as const;

function StatusBar({ status }: { status: string }) {
  const currentIdx = STATUS_STEPS.findIndex((s) => s.key === status);
  return (
    <div className="flex items-center gap-0 w-full">
      {STATUS_STEPS.map((step, i) => {
        const done    = i <= currentIdx;
        const current = i === currentIdx;
        const Icon    = step.icon;
        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                style={{
                  backgroundColor: done ? "#D4A843" : "rgba(255,255,255,0.06)",
                  border: current ? "2px solid #D4A843" : "2px solid transparent",
                }}
              >
                <Icon size={14} style={{ color: done ? "#0A0A0A" : "#555" }} />
              </div>
              <p className="text-[10px] text-center whitespace-nowrap" style={{ color: done ? "#D4A843" : "#555" }}>
                {step.label}
              </p>
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div
                className="h-px flex-1 mb-5"
                style={{ backgroundColor: i < currentIdx ? "#D4A843" : "rgba(255,255,255,0.08)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default async function OrderStatusPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  const order = await db.merchOrder.findUnique({
    where: { id: orderId },
    select: {
      id:                true,
      buyerName:         true,
      buyerEmail:        true,
      shippingAddress:   true,
      fulfillmentStatus: true,
      trackingNumber:    true,
      trackingUrl:       true,
      totalPrice:        true,
      shippingCost:      true,
      createdAt:         true,
      items: {
        select: {
          id:        true,
          quantity:  true,
          unitPrice: true,
          subtotal:  true,
          product: { select: { title: true, imageUrl: true, imageUrls: true } },
          variant: { select: { size: true, color: true } },
        },
      },
      // artist info via artistId
    },
  });

  if (!order) notFound();

  // Get artist info separately via first item's product.artistId
  const firstProductId = order.items[0]?.product?.title ? null : null; // artist via order.artistId
  // Actually, MerchOrder has artistId — let's query via it
  const orderWithArtist = await db.merchOrder.findUnique({
    where: { id: orderId },
    select: {
      artistId: true,
    },
  });
  const artist = orderWithArtist?.artistId
    ? await db.user.findUnique({
        where:  { id: orderWithArtist.artistId },
        select: { name: true, artistName: true, artistSlug: true, email: true },
      })
    : null;

  const displayName = artist?.artistName ?? artist?.name ?? "Artist";
  const addr = order.shippingAddress as {
    name?: string; address1?: string; address2?: string;
    city?: string; state?: string; zip?: string; country?: string;
  } | null;

  const subtotal = order.totalPrice - order.shippingCost;
  const orderNum = orderId.slice(-8).toUpperCase();

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0A0A" }}>
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-12 space-y-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "rgba(212,168,67,0.12)" }}>
            <Package size={22} style={{ color: "#D4A843" }} />
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: "#D4A843" }}>
            Order #{orderNum}
          </p>
          <h1 className="text-2xl font-bold text-white">
            {order.fulfillmentStatus === "DELIVERED" ? "Order Delivered" :
             order.fulfillmentStatus === "SHIPPED"   ? "Order is on the Way!" :
             order.fulfillmentStatus === "PROCESSING" ? "Order in Production" :
             "Order Confirmed"}
          </h1>
          <p className="text-sm" style={{ color: "#666" }}>
            Placed {new Date(order.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>

        {/* Status progress */}
        <div
          className="rounded-2xl border p-6"
          style={{ backgroundColor: "#111", borderColor: "#1a1a1a" }}
        >
          <StatusBar status={order.fulfillmentStatus} />
        </div>

        {/* Tracking */}
        {order.trackingNumber && (
          <div
            className="rounded-2xl border p-5 flex items-center gap-4"
            style={{ backgroundColor: "#111", borderColor: "#1a1a1a" }}
          >
            <Truck size={20} style={{ color: "#D4A843" }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/50 mb-0.5">Tracking number</p>
              <p className="text-sm font-mono font-bold text-white">{order.trackingNumber}</p>
            </div>
            {order.trackingUrl && (
              <a
                href={order.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0"
                style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}
              >
                Track <ExternalLink size={11} />
              </a>
            )}
          </div>
        )}

        {/* Items */}
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ backgroundColor: "#111", borderColor: "#1a1a1a" }}
        >
          <div className="px-5 py-3 border-b" style={{ borderColor: "#1a1a1a" }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#555" }}>
              {order.items.length} item{order.items.length !== 1 ? "s" : ""}
            </p>
          </div>
          {order.items.map((item) => {
            const thumb = item.product.imageUrls?.[0] ?? item.product.imageUrl;
            return (
              <div key={item.id} className="flex items-center gap-4 px-5 py-4 border-b last:border-b-0" style={{ borderColor: "#1a1a1a" }}>
                <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0" style={{ backgroundColor: "#1a1a1a" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {thumb && <img src={thumb} alt={item.product.title} className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{item.product.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#666" }}>
                    {item.variant.size}{item.variant.color && item.variant.color !== "N/A" ? ` · ${item.variant.color}` : ""} × {item.quantity}
                  </p>
                </div>
                <p className="text-sm font-bold text-white tabular-nums shrink-0">${item.subtotal.toFixed(2)}</p>
              </div>
            );
          })}

          {/* Order totals */}
          <div className="px-5 py-4 space-y-1.5 border-t" style={{ borderColor: "#1a1a1a" }}>
            <div className="flex justify-between text-xs" style={{ color: "#666" }}>
              <span>Subtotal</span>
              <span className="tabular-nums">${subtotal.toFixed(2)}</span>
            </div>
            {order.shippingCost > 0 && (
              <div className="flex justify-between text-xs" style={{ color: "#666" }}>
                <span>Shipping</span>
                <span className="tabular-nums">${order.shippingCost.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-white pt-1 border-t" style={{ borderColor: "#1a1a1a" }}>
              <span>Total</span>
              <span className="tabular-nums">${order.totalPrice.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Shipping address */}
        {addr && (
          <div
            className="rounded-2xl border p-5 space-y-2"
            style={{ backgroundColor: "#111", borderColor: "#1a1a1a" }}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: "#555" }}>Ships to</p>
            <div className="text-sm text-white/70 space-y-0.5">
              <p className="text-white font-semibold">{addr.name ?? order.buyerName}</p>
              {addr.address1 && <p>{addr.address1}{addr.address2 ? `, ${addr.address2}` : ""}</p>}
              {addr.city && <p>{addr.city}{addr.state ? `, ${addr.state}` : ""} {addr.zip}</p>}
              {addr.country && addr.country !== "US" && <p>{addr.country}</p>}
            </div>
          </div>
        )}

        {/* Contact + back */}
        <div className="text-center space-y-3">
          {artist?.email && (
            <a
              href={`mailto:${artist.email}?subject=Order%20%23${orderNum}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:border-white/30"
              style={{ borderColor: "#2a2a2a", color: "#aaa", backgroundColor: "transparent" }}
            >
              <Mail size={14} /> Contact {displayName}
            </a>
          )}
          {artist?.artistSlug && (
            <div>
              <Link
                href={`/${artist.artistSlug}`}
                className="text-xs"
                style={{ color: "#555" }}
              >
                ← Back to {displayName}&apos;s page
              </Link>
            </div>
          )}
        </div>

        <p className="text-center text-xs" style={{ color: "#333" }}>
          Powered by <span className="font-semibold" style={{ color: "#D4A843" }}>IndieThis</span>
        </p>
      </div>
    </div>
  );
}
