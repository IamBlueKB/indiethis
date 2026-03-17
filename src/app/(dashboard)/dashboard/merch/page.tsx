"use client";

import { useState } from "react";
import {
  ShoppingBag, Plus, X, Package, DollarSign, Tag, ImagePlus,
  Loader2, Trash2, EyeOff, Eye, Truck, CheckCircle2, Clock,
} from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing-client";
import {
  useMerchProducts,
  useMerchOrders,
  useToggleMerchProduct,
  useDeleteMerchProduct,
  useCreateMerchProduct,
  useUpdateOrderFulfillment,
  type MerchOrder,
} from "@/hooks/queries";

const PRODUCT_TYPES = ["TSHIRT", "HOODIE", "POSTER", "PHONECASE", "HAT", "STICKER", "MUG"];

const TYPE_LABELS: Record<string, string> = {
  TSHIRT: "T-Shirt", HOODIE: "Hoodie", POSTER: "Poster",
  PHONECASE: "Phone Case", HAT: "Hat", STICKER: "Sticker", MUG: "Mug",
};

const FULFILLMENT_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING:    { label: "Pending",    color: "text-yellow-400",  icon: Clock        },
  PROCESSING: { label: "Processing", color: "text-blue-400",    icon: Package      },
  SHIPPED:    { label: "Shipped",    color: "text-emerald-400", icon: Truck        },
  DELIVERED:  { label: "Delivered",  color: "text-emerald-400", icon: CheckCircle2 },
};

type Tab = "products" | "orders";

export default function MerchPage() {
  const { data: products = [], isLoading: loadingProducts } = useMerchProducts();
  const { data: orders   = [], isLoading: loadingOrders   } = useMerchOrders();

  const { mutate: toggleActive  } = useToggleMerchProduct();
  const { mutate: deleteProduct } = useDeleteMerchProduct();
  const { mutate: createProduct, isPending: saving } = useCreateMerchProduct();
  const { mutate: updateFulfillment } = useUpdateOrderFulfillment();

  const [tab, setTab]             = useState<Tab>("products");
  const [composing, setComposing] = useState(false);

  // New product form state
  const [title, setTitle]           = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl]     = useState("");
  const [basePrice, setBasePrice]   = useState("");
  const [markup, setMarkup]         = useState("");
  const [productType, setProductType] = useState("TSHIRT");

  const { startUpload: uploadImage, isUploading: imageUploading } = useUploadThing("merchImage", {
    onClientUploadComplete: (res) => {
      const url = res[0]?.url;
      if (url) setImageUrl(url);
    },
  });

  function handleCreate() {
    if (!title.trim() || !imageUrl.trim()) return;
    createProduct(
      { title, description, imageUrl, basePrice, artistMarkup: markup, productType },
      {
        onSuccess: () => {
          setTitle(""); setDescription(""); setImageUrl("");
          setBasePrice(""); setMarkup(""); setComposing(false);
        },
      }
    );
  }

  const totalEarnings = products.flatMap((p) => p.orders).reduce((s, o) => s + o.artistEarnings, 0);
  const totalOrders   = products.flatMap((p) => p.orders).length;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Merch Store</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Sell merch directly to your fans</p>
        </div>
        {tab === "products" && (
          <button
            onClick={() => setComposing(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
          >
            <Plus size={14} /> Add Product
          </button>
        )}
      </div>

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
          {/* Add product form */}
          {composing && (
            <div
              className="rounded-2xl border p-5 space-y-4"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag size={15} className="text-accent" />
                  <h2 className="text-sm font-semibold text-foreground">New Product</h2>
                </div>
                <button onClick={() => setComposing(false)} className="text-muted-foreground hover:text-foreground">
                  <X size={15} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Product Name
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Tour Hoodie 2026"
                    className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                    style={{ borderColor: "var(--border)" }}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Product Type
                  </label>
                  <select
                    value={productType}
                    onChange={(e) => setProductType(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2.5 text-sm text-foreground outline-none"
                    style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
                  >
                    {PRODUCT_TYPES.map((t) => (
                      <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Image upload */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Product Image
                </label>
                <div className="flex items-center gap-3">
                  {imageUrl ? (
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border" style={{ borderColor: "var(--border)" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setImageUrl("")}
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center text-white text-[9px]"
                      >✕</button>
                    </div>
                  ) : (
                    <div
                      className="w-16 h-16 rounded-xl border flex items-center justify-center shrink-0"
                      style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
                    >
                      <ImagePlus size={18} className="text-muted-foreground opacity-40" />
                    </div>
                  )}
                  <label className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer border transition-colors hover:bg-white/5"
                    style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
                    {imageUploading
                      ? <><Loader2 size={12} className="animate-spin" /> Uploading…</>
                      : <><ImagePlus size={12} /> {imageUrl ? "Replace" : "Upload Image"}</>}
                    <input
                      type="file" accept="image/*" className="sr-only" disabled={imageUploading}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage([f]); e.target.value = ""; }}
                    />
                  </label>
                  <p className="text-xs text-muted-foreground">Max 16 MB</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Base Price ($)
                  </label>
                  <input
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    placeholder="25.00" type="number" min="0" step="0.01"
                    className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                    style={{ borderColor: "var(--border)" }}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Your Markup ($)
                  </label>
                  <input
                    value={markup}
                    onChange={(e) => setMarkup(e.target.value)}
                    placeholder="15.00" type="number" min="0" step="0.01"
                    className="w-full rounded-xl border px-3 py-2.5 text-sm bg-transparent text-foreground outline-none focus:ring-2 focus:ring-accent/50"
                    style={{ borderColor: "var(--border)" }}
                  />
                </div>
              </div>

              {basePrice && markup && (
                <p className="text-xs text-muted-foreground">
                  Selling price:{" "}
                  <span className="text-foreground font-semibold">
                    ${(parseFloat(basePrice || "0") + parseFloat(markup || "0")).toFixed(2)}
                  </span>
                  {" "}· Your earnings:{" "}
                  <span className="text-emerald-400 font-semibold">
                    ${parseFloat(markup || "0").toFixed(2)}
                  </span>{" "}
                  per sale
                </p>
              )}

              <button
                onClick={handleCreate}
                disabled={saving || imageUploading || !title.trim() || !imageUrl.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: "#D4A843", color: "#0A0A0A" }}
              >
                <Plus size={14} />
                {saving ? "Creating…" : imageUploading ? "Uploading image…" : "Create Product"}
              </button>
            </div>
          )}

          {/* Product grid */}
          {loadingProducts ? (
            <div className="py-10 flex justify-center">
              <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            </div>
          ) : products.length === 0 ? (
            <div
              className="rounded-2xl border py-14 text-center space-y-2"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              <ShoppingBag size={32} className="mx-auto text-muted-foreground opacity-40" />
              <p className="text-sm font-semibold text-foreground">No products yet</p>
              <p className="text-xs text-muted-foreground">Add your first merch item to start selling.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {products.map((p) => {
                const sellingPrice = p.basePrice + p.artistMarkup;
                const orderCount   = p.orders.length;
                const earnings     = p.orders.reduce((s, o) => s + o.artistEarnings, 0);
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
                        onClick={() => deleteProduct(p.id)}
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
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border text-muted-foreground"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <Tag size={8} /> {TYPE_LABELS[p.productType] ?? p.productType}
                      </span>
                      <div className="flex items-center justify-between pt-0.5">
                        <p className="text-sm font-bold text-foreground">${sellingPrice.toFixed(2)}</p>
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
                  onUpdateFulfillment={(id, status) =>
                    updateFulfillment({ id, fulfillmentStatus: status })
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

function OrderRow({
  order,
  onUpdateFulfillment,
}: {
  order: MerchOrder;
  onUpdateFulfillment: (id: string, status: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = FULFILLMENT_CONFIG[order.fulfillmentStatus] ?? FULFILLMENT_CONFIG.PENDING;
  const Icon = cfg.icon;

  const NEXT_STATUS: Record<string, string> = {
    PENDING: "PROCESSING", PROCESSING: "SHIPPED", SHIPPED: "DELIVERED",
  };
  const nextStatus = NEXT_STATUS[order.fulfillmentStatus];
  const nextLabel: Record<string, string> = {
    PROCESSING: "Mark Processing", SHIPPED: "Mark Shipped", DELIVERED: "Mark Delivered",
  };

  return (
    <div
      className="border-b last:border-b-0"
      style={{ borderColor: "var(--border)" }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-white/3 transition-colors"
      >
        {/* Product image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={order.merchProduct.imageUrl}
          alt={order.merchProduct.title}
          className="w-10 h-10 rounded-xl object-cover shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23222'/%3E%3C/svg%3E"; }}
        />

        {/* Order info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{order.merchProduct.title}</p>
          <p className="text-xs text-muted-foreground truncate">
            {order.buyerEmail} · Qty {order.quantity}
          </p>
        </div>

        {/* Status + earnings */}
        <div className="text-right shrink-0 space-y-0.5">
          <div className={`flex items-center gap-1 justify-end text-xs font-semibold ${cfg.color}`}>
            <Icon size={11} /> {cfg.label}
          </div>
          <p className="text-xs text-emerald-400 font-semibold">
            +${order.artistEarnings.toFixed(2)}
          </p>
        </div>

        {/* Date */}
        <p className="text-[10px] text-muted-foreground shrink-0 ml-1">
          {new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </p>
      </button>

      {/* Expanded row: fulfillment actions */}
      {expanded && (
        <div
          className="px-5 pb-4 pt-1 border-t flex items-center gap-3 flex-wrap"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">
              Total: <span className="text-foreground font-semibold">${order.totalPrice.toFixed(2)}</span>
              {" "}· Your cut: <span className="text-emerald-400 font-semibold">${order.artistEarnings.toFixed(2)}</span>
            </p>
            {order.trackingNumber && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Tracking: <span className="text-foreground font-mono">{order.trackingNumber}</span>
              </p>
            )}
          </div>
          {nextStatus && (
            <button
              onClick={() => onUpdateFulfillment(order.id, nextStatus)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}
            >
              <Truck size={11} /> {nextLabel[nextStatus]}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
