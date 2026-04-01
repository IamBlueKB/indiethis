"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ShoppingBag, Package, DollarSign,
  Trash2, EyeOff, Eye, Truck, CheckCircle2, Clock,
  Plus, MapPin, AlertTriangle, Loader2, X,
} from "lucide-react";
import {
  useMerchProducts,
  useMerchOrders,
  useToggleMerchProduct,
  useDeleteMerchProduct,
  useUpdateOrderFulfillment,
  type MerchOrder,
} from "@/hooks/queries";

// ─── Constants ───────────────────────────────────────────────────────────────

const FULFILLMENT_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING:    { label: "Pending",    color: "text-yellow-400",  icon: Clock        },
  PROCESSING: { label: "Processing", color: "text-blue-400",    icon: Package      },
  SHIPPED:    { label: "Shipped",    color: "text-emerald-400", icon: Truck        },
  DELIVERED:  { label: "Delivered",  color: "text-emerald-400", icon: CheckCircle2 },
};

const CATEGORIES = [
  "All",
  "T-Shirts",
  "Hoodies & Sweatshirts",
  "Hats",
  "Posters & Art Prints",
  "Mugs",
  "Phone Cases",
  "Stickers & Accessories",
] as const;

type Tab = "products" | "orders";

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MerchPage() {
  const { data: products = [], isLoading: loadingProducts } = useMerchProducts();
  const { data: orders   = [], isLoading: loadingOrders   } = useMerchOrders();

  const { mutate: toggleActive  } = useToggleMerchProduct();
  const { mutate: deleteProduct } = useDeleteMerchProduct();
  const { mutate: updateFulfillment } = useUpdateOrderFulfillment();

  const [tab, setTab] = useState<Tab>("products");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const totalEarnings = orders.reduce((s, o) => s + o.artistEarnings, 0);
  const totalOrders   = orders.length;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Merch Store</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Sell print-on-demand merch directly to your fans</p>
        </div>
        <Link
          href="/dashboard/merch/create"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
          style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
        >
          <Plus size={15} />
          Add Product
        </Link>
      </div>

      {/* Delete error banner */}
      {deleteError && (
        <div
          className="rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-3"
          style={{ backgroundColor: "rgba(232,93,74,0.15)", border: "1px solid rgba(232,93,74,0.4)", color: "#F87171" }}
        >
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Products", value: products.length, icon: ShoppingBag },
          { label: "Orders",   value: totalOrders,      icon: Package     },
          { label: "Earnings", value: `$${totalEarnings.toFixed(2)}`, icon: DollarSign },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-2xl border p-4"
            style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon size={14} className="text-accent" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{label}</p>
            </div>
            <p className="text-xl font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div
        className="flex gap-1 p-0.5 rounded-xl border w-fit"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
      >
        {(["products", "orders"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={
              tab === t
                ? { backgroundColor: "var(--card)", color: "var(--foreground)" }
                : { color: "var(--muted-foreground)" }
            }
          >
            {t === "products" ? `Products (${products.length})` : `Orders (${totalOrders})`}
          </button>
        ))}
      </div>

      {/* ── Products Tab ─────────────────────────────────────────────────── */}
      {tab === "products" && (
        <>
          {loadingProducts ? (
            <div className="py-10 flex justify-center">
              <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            </div>
          ) : products.length === 0 ? (
            <div
              className="rounded-2xl border py-14 text-center space-y-3"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <ShoppingBag size={32} className="mx-auto text-muted-foreground opacity-40" />
              <p className="text-sm font-semibold text-foreground">No products yet</p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                Browse the catalog to add print-on-demand products to your store.
              </p>
              <Link
                href="/dashboard/merch/create"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold mt-2 transition-colors"
                style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}
              >
                <Plus size={14} /> Browse Catalog
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {products.map((p) => {
                const lowestPrice  = p.variants[0]?.retailPrice ?? 0;
                const orderCount   = p.orderItems.length;
                const earnings     = p.orderItems.reduce((s, oi) => s + oi.order.artistEarnings, 0);
                return (
                  <div
                    key={p.id}
                    className="rounded-2xl border overflow-hidden group relative"
                    style={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                      opacity: p.isActive ? 1 : 0.65,
                    }}
                  >
                    {/* Hover actions */}
                    <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button
                        onClick={() => toggleActive({ id: p.id, isActive: !p.isActive })}
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: "rgba(0,0,0,0.7)", color: "white" }}
                        title={p.isActive ? "Hide product" : "Show product"}
                      >
                        {p.isActive ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                      <button
                        onClick={() => deleteProduct(p.id, {
                          onError: (err) => setDeleteError(err instanceof Error ? err.message : "Failed to delete product"),
                        })}
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: "rgba(232,93,74,0.8)", color: "white" }}
                        title="Delete product"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.imageUrl}
                      alt={p.title}
                      className="w-full aspect-square object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23222'/%3E%3C/svg%3E";
                      }}
                    />
                    <div className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">{p.title}</p>
                        <span className={`shrink-0 w-2 h-2 rounded-full mt-1.5 ${p.isActive ? "bg-emerald-400" : "bg-red-400"}`} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {p.variants.length} variant{p.variants.length !== 1 ? "s" : ""}
                      </p>
                      <div className="flex items-center justify-between pt-0.5">
                        <p className="text-sm font-bold text-foreground">
                          {lowestPrice > 0 ? `From $${lowestPrice.toFixed(2)}` : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {orderCount} {orderCount === 1 ? "order" : "orders"}
                        </p>
                      </div>
                      {earnings > 0 && (
                        <p className="text-xs text-emerald-400 font-semibold">${earnings.toFixed(2)} earned</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Orders Tab ───────────────────────────────────────────────────── */}
      {tab === "orders" && (
        <>
          {loadingOrders ? (
            <div className="py-10 flex justify-center">
              <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            </div>
          ) : orders.length === 0 ? (
            <div
              className="rounded-2xl border py-14 text-center space-y-2"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <Package size={32} className="mx-auto text-muted-foreground opacity-40" />
              <p className="text-sm font-semibold text-foreground">No orders yet</p>
              <p className="text-xs text-muted-foreground">
                Orders will appear here once fans buy from your store.
              </p>
            </div>
          ) : (
            <div
              className="rounded-2xl border overflow-hidden"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <div className="px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {orders.length} {orders.length === 1 ? "Order" : "Orders"}
                </p>
              </div>
              {orders.map((order: MerchOrder) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  onUpdateFulfillment={(id, status, tracking, trackingUrl, carrier) =>
                    updateFulfillment({ id, fulfillmentStatus: status, trackingNumber: tracking, trackingUrl, carrier })
                  }
                />
              ))}
            </div>
          )}
        </>
      )}

    </div>
  );
}

// ─── OrderRow ─────────────────────────────────────────────────────────────────

function OrderRow({
  order,
  onUpdateFulfillment,
}: {
  order: MerchOrder;
  onUpdateFulfillment: (id: string, status: string, tracking?: string, trackingUrl?: string, carrier?: string) => void;
}) {
  const [expanded,       setExpanded     ] = useState(false);
  const [trackingInput,  setTrackingInput ] = useState("");
  const [trackingUrlIn,  setTrackingUrlIn ] = useState("");
  const [carrierInput,   setCarrierInput  ] = useState("");
  const [showDefect,     setShowDefect    ] = useState(false);
  const [defectDesc,     setDefectDesc    ] = useState("");
  const [defectLoading,  setDefectLoading ] = useState(false);
  const [defectDone,     setDefectDone    ] = useState(false);
  const [defectError,    setDefectError   ] = useState<string | null>(null);

  const cfg = FULFILLMENT_CONFIG[order.fulfillmentStatus] ?? FULFILLMENT_CONFIG.PENDING;
  const Icon = cfg.icon;

  // Self-fulfilled orders get manual shipping controls
  const hasSelfFulfilled = order.items.some((i) => i.product.fulfillmentType === "SELF_FULFILLED");
  const isPOD            = !hasSelfFulfilled;

  const NEXT_STATUS: Record<string, string> = {
    PENDING: "PROCESSING", PROCESSING: "SHIPPED", SHIPPED: "DELIVERED",
  };
  const nextStatus = NEXT_STATUS[order.fulfillmentStatus];
  const nextLabel: Record<string, string> = {
    PROCESSING: "Mark Processing", SHIPPED: "Mark Shipped", DELIVERED: "Mark Delivered",
  };

  // First item's product info for display
  const firstItem    = order.items[0];
  const productTitle = firstItem?.product.title  ?? "Merch Order";
  const productImage = firstItem?.product.imageUrl ?? "";
  const totalQty     = order.items.reduce((s, i) => s + i.quantity, 0);

  const shippingAddr = order.shippingAddress as { name?: string; address1?: string; city?: string; state?: string; zip?: string } | null;

  return (
    <div className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-white/3 transition-colors"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={productImage}
          alt={productTitle}
          className="w-10 h-10 rounded-xl object-cover shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23222'/%3E%3C/svg%3E"; }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {order.items.length > 1 ? `${order.items.length} items` : productTitle}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {order.buyerName ?? order.buyerEmail} · Qty {totalQty} · {hasSelfFulfilled ? "Self-Fulfilled" : "Print-on-Demand"}
          </p>
        </div>
        <div className="text-right shrink-0 space-y-0.5">
          <div className={`flex items-center gap-1 justify-end text-xs font-semibold ${cfg.color}`}>
            <Icon size={11} /> {cfg.label}
          </div>
          <p className="text-xs text-emerald-400 font-semibold">+${order.artistEarnings.toFixed(2)}</p>
        </div>
        <p className="text-[10px] text-muted-foreground shrink-0 ml-1">
          {new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </p>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-5 pb-4 pt-2 border-t space-y-4" style={{ borderColor: "var(--border)" }}>
          {/* Items list */}
          {order.items.length > 1 && (
            <div className="space-y-1">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between text-xs text-muted-foreground">
                  <span>{item.product.title} · {item.variant.size} {item.variant.color} × {item.quantity}</span>
                  <span>${item.subtotal.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Financial summary */}
          <p className="text-xs text-muted-foreground">
            Subtotal: <span className="text-foreground font-semibold">${(order.totalPrice - order.shippingCost).toFixed(2)}</span>
            {order.shippingCost > 0 && <> · Shipping: <span className="text-foreground font-semibold">${order.shippingCost.toFixed(2)}</span></>}
            {" "}· Your cut: <span className="text-emerald-400 font-semibold">${order.artistEarnings.toFixed(2)}</span>
          </p>

          {/* Shipping address */}
          {shippingAddr && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <MapPin size={12} className="mt-0.5 shrink-0" />
              <div>
                <p className="text-foreground font-medium">{shippingAddr.name ?? order.buyerName}</p>
                <p>{shippingAddr.address1}</p>
                <p>{shippingAddr.city}, {shippingAddr.state} {shippingAddr.zip}</p>
                <p className="text-accent">{order.buyerEmail}</p>
              </div>
            </div>
          )}

          {/* Existing tracking */}
          {order.trackingNumber && (
            <p className="text-xs text-muted-foreground">
              Tracking:{" "}
              {order.trackingUrl ? (
                <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-accent font-mono underline">
                  {order.trackingNumber}
                </a>
              ) : (
                <span className="text-foreground font-mono">{order.trackingNumber}</span>
              )}
            </p>
          )}

          {/* Self-fulfilled: tracking entry when marking shipped */}
          {hasSelfFulfilled && nextStatus === "SHIPPED" && (
            <div className="space-y-2 p-3 rounded-xl" style={{ backgroundColor: "var(--background)" }}>
              <p className="text-xs font-semibold text-foreground">Enter tracking to mark as shipped</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Carrier</p>
                  <input
                    value={carrierInput}
                    onChange={(e) => setCarrierInput(e.target.value)}
                    placeholder="USPS, UPS…"
                    className="w-full rounded-lg border px-2 py-1.5 text-xs bg-transparent text-foreground outline-none"
                    style={{ borderColor: "var(--border)" }}
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Tracking # *</p>
                  <input
                    value={trackingInput}
                    onChange={(e) => setTrackingInput(e.target.value)}
                    placeholder="1Z999AA1…"
                    className="w-full rounded-lg border px-2 py-1.5 text-xs bg-transparent text-foreground outline-none"
                    style={{ borderColor: "var(--border)" }}
                  />
                </div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Tracking URL (optional)</p>
                <input
                  value={trackingUrlIn}
                  onChange={(e) => setTrackingUrlIn(e.target.value)}
                  placeholder="https://tools.usps.com/…"
                  className="w-full rounded-lg border px-2 py-1.5 text-xs bg-transparent text-foreground outline-none"
                  style={{ borderColor: "var(--border)" }}
                />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {/* For self-fulfilled "Mark Shipped": require tracking */}
            {hasSelfFulfilled && nextStatus === "SHIPPED" && (
              <button
                onClick={() => onUpdateFulfillment(order.id, "SHIPPED", trackingInput || undefined, trackingUrlIn || undefined, carrierInput || undefined)}
                disabled={!trackingInput.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40"
                style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}
              >
                <Truck size={11} /> Mark Shipped
              </button>
            )}
            {/* For POD or non-shipping steps */}
            {(isPOD || nextStatus !== "SHIPPED") && nextStatus && (
              <button
                onClick={() => onUpdateFulfillment(order.id, nextStatus)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}
              >
                <Truck size={11} /> {nextLabel[nextStatus]}
              </button>
            )}
            {/* Delivered */}
            {hasSelfFulfilled && nextStatus === "DELIVERED" && (
              <button
                onClick={() => onUpdateFulfillment(order.id, "DELIVERED")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={{ backgroundColor: "rgba(52,211,153,0.12)", color: "#34d399" }}
              >
                <CheckCircle2 size={11} /> Mark Delivered
              </button>
            )}
            {/* POD defect claim */}
            {isPOD && ["SHIPPED", "DELIVERED"].includes(order.fulfillmentStatus) && !defectDone && (
              <button
                onClick={() => setShowDefect(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={{ backgroundColor: "rgba(248,113,113,0.10)", color: "#F87171" }}
              >
                <AlertTriangle size={11} /> Report Defect
              </button>
            )}
            {defectDone && (
              <span className="text-xs px-3 py-1.5 rounded-lg" style={{ backgroundColor: "rgba(74,222,128,0.10)", color: "#4ADE80" }}>
                ✓ Claim submitted to Printful
              </span>
            )}
          </div>

          {/* Defect claim modal */}
          {showDefect && (
            <div className="mt-3 p-4 rounded-xl border space-y-3" style={{ backgroundColor: "rgba(248,113,113,0.05)", borderColor: "rgba(248,113,113,0.2)" }}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold" style={{ color: "#F87171" }}>Report Defect / Wrong Product</p>
                <button onClick={() => { setShowDefect(false); setDefectError(null); }} className="text-muted-foreground hover:text-foreground">
                  <X size={13} />
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Describe the issue and Printful will send a replacement at no cost.
              </p>
              <textarea
                rows={3}
                value={defectDesc}
                onChange={(e) => setDefectDesc(e.target.value)}
                placeholder="e.g. Wrong size delivered, print is faded, item is torn..."
                className="w-full rounded-lg border px-3 py-2 text-xs bg-transparent text-foreground outline-none resize-none"
                style={{ borderColor: "var(--border)" }}
              />
              {defectError && <p className="text-xs" style={{ color: "#F87171" }}>{defectError}</p>}
              <button
                disabled={!defectDesc.trim() || defectLoading}
                onClick={async () => {
                  setDefectLoading(true);
                  setDefectError(null);
                  try {
                    const res = await fetch("/api/dashboard/merch/orders/defect-claim", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        orderId:     order.id,
                        description: defectDesc.trim(),
                        items:       order.items.map((i) => ({ itemId: i.id, quantity: i.quantity, reason: defectDesc.trim() })),
                      }),
                    });
                    const d = await res.json() as { error?: string };
                    if (!res.ok) {
                      setDefectError(d.error ?? "Claim failed.");
                    } else {
                      setDefectDone(true);
                      setShowDefect(false);
                    }
                  } catch {
                    setDefectError("Network error.");
                  } finally {
                    setDefectLoading(false);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
                style={{ backgroundColor: "rgba(248,113,113,0.15)", color: "#F87171" }}
              >
                {defectLoading ? <Loader2 size={11} className="animate-spin" /> : <AlertTriangle size={11} />}
                Submit Claim to Printful
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

