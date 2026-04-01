"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ShoppingBag, Package, DollarSign,
  Trash2, EyeOff, Eye, Truck, CheckCircle2, Clock, Plus,
} from "lucide-react";
import {
  useMerchProducts,
  useMerchOrders,
  useToggleMerchProduct,
  useDeleteMerchProduct,
  useUpdateOrderFulfillment,
} from "@/hooks/queries";

const FULFILLMENT_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING:    { label: "Pending",    color: "text-yellow-400",  icon: Clock        },
  PROCESSING: { label: "Processing", color: "text-blue-400",    icon: Package      },
  SHIPPED:    { label: "Shipped",    color: "text-emerald-400", icon: Truck        },
  DELIVERED:  { label: "Delivered",  color: "text-emerald-400", icon: CheckCircle2 },
};

type Tab = "products" | "orders";

export default function DJMerchPage() {
  const { data: products = [], isLoading: loadingProducts } = useMerchProducts();
  const { data: orders   = [], isLoading: loadingOrders   } = useMerchOrders();
  const { mutate: toggleActive  } = useToggleMerchProduct();
  const { mutate: deleteProduct } = useDeleteMerchProduct();
  const { mutate: updateFulfillment } = useUpdateOrderFulfillment();

  const [tab,         setTab]         = useState<Tab>("products");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const totalEarnings = orders.reduce((s, o) => s + o.artistEarnings, 0);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">DJ Merch Store</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Sell branded merch to your fans</p>
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

      {deleteError && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: "rgba(232,93,74,0.15)", border: "1px solid rgba(232,93,74,0.4)", color: "#F87171" }}>
          {deleteError}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Products",      value: products.length,          icon: ShoppingBag },
          { label: "Orders",        value: orders.length,            icon: Package     },
          { label: "Total Earnings", value: `$${totalEarnings.toFixed(2)}`, icon: DollarSign },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2 mb-1">
              <Icon size={14} className="text-accent" />
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
            <p className="text-xl font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl p-1" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        {(["products", "orders"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2 text-sm font-medium rounded-lg capitalize transition-colors"
            style={tab === t ? { backgroundColor: "var(--accent)", color: "var(--background)" } : { color: "var(--muted-foreground)" }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Products tab */}
      {tab === "products" && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          {loadingProducts ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Loading...</div>
          ) : products.length === 0 ? (
            <div className="py-16 text-center">
              <ShoppingBag size={36} className="mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">No products yet</p>
              <p className="text-xs text-muted-foreground mb-4">Create your first merch product to start selling</p>
              <Link href="/dashboard/merch/create" className="text-sm font-semibold" style={{ color: "#D4A843" }}>
                + Add your first product
              </Link>
            </div>
          ) : (
            products.map((product) => (
              <div key={product.id} className="flex items-center gap-4 px-5 py-4 border-b last:border-b-0 hover:bg-white/3 transition-colors" style={{ borderColor: "var(--border)" }}>
                <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0" style={{ backgroundColor: "#1a1a1a" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {product.imageUrl && <img src={product.imageUrl} alt={product.title} className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{product.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {product.variants.length} variant{product.variants.length !== 1 ? "s" : ""} ·{" "}
                    ${Math.min(...product.variants.map((v) => v.retailPrice)).toFixed(2)}+
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleActive({ id: product.id, isActive: !product.isActive })}
                    className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
                    title={product.isActive ? "Deactivate" : "Activate"}
                  >
                    {product.isActive ? <Eye size={15} className="text-emerald-400" /> : <EyeOff size={15} className="text-muted-foreground" />}
                  </button>
                  <button
                    onClick={() => {
                      deleteProduct(product.id, {
                        onError: (err) => setDeleteError(err instanceof Error ? err.message : "Delete failed"),
                      });
                    }}
                    className="p-1.5 rounded-lg transition-colors hover:bg-red-400/10"
                  >
                    <Trash2 size={15} className="text-red-400/70" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Orders tab */}
      {tab === "orders" && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          {loadingOrders ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Loading...</div>
          ) : orders.length === 0 ? (
            <div className="py-16 text-center">
              <Package size={36} className="mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No orders yet</p>
            </div>
          ) : (
            orders.map((order) => {
              const config = FULFILLMENT_CONFIG[order.fulfillmentStatus] ?? FULFILLMENT_CONFIG.PENDING;
              const Icon   = config.icon;
              return (
                <div key={order.id} className="flex items-center gap-4 px-5 py-4 border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{order.buyerName ?? order.buyerEmail}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {order.items.length} item{order.items.length !== 1 ? "s" : ""} · #{order.id.slice(-8).toUpperCase()}
                    </p>
                  </div>
                  <div className={`flex items-center gap-1.5 text-xs font-medium ${config.color}`}>
                    <Icon size={13} />
                    {config.label}
                  </div>
                  <p className="text-sm font-bold text-foreground shrink-0">${order.artistEarnings.toFixed(2)}</p>
                  {order.fulfillmentStatus === "PENDING" && (
                    <button
                      onClick={() => updateFulfillment({ id: order.id, fulfillmentStatus: "PROCESSING" })}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium shrink-0"
                      style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}
                    >
                      Mark Processing
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
