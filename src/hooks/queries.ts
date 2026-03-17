/**
 * Centralized React Query hooks for IndieThis dashboard data.
 *
 * Every query and mutation that touches the API lives here.
 * Pages import these hooks and get caching, background refetch,
 * and loading/error states for free.
 *
 * Query key convention:
 *   ["resource"]              → list
 *   ["resource", id]          → single item
 *   ["resource", "sub-resource"] → nested list
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ─────────────────────────────────────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────────────────────────────────────

export type BookingSession = {
  id: string;
  dateTime: string;
  duration: number | null;
  sessionType: string | null;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  paymentStatus: "UNPAID" | "DEPOSIT" | "PAID";
  notes: string | null;
  studio: { id: string; name: string; address: string | null };
};

export type ReceiptRecord = {
  id: string;
  type: string;
  description: string;
  amount: number;
  paymentMethod: string | null;
  pdfUrl: string | null;
  createdAt: string;
};

export type ArtistSite = {
  id: string;
  bioContent: string | null;
  heroImage: string | null;
  draftMode: boolean;
  isPublished: boolean;
  followGateEnabled: boolean;
  createdAt: string;
};

export type MerchProduct = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  basePrice: number;
  artistMarkup: number;
  productType: string;
  isActive: boolean;
  createdAt: string;
  orders: { id: string; totalPrice: number; artistEarnings: number }[];
};

export type MerchOrder = {
  id: string;
  buyerEmail: string;
  quantity: number;
  totalPrice: number;
  artistEarnings: number;
  platformCut: number;
  fulfillmentStatus: "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED";
  trackingNumber: string | null;
  stripePaymentId: string | null;
  createdAt: string;
  merchProduct: { title: string; imageUrl: string; productType: string };
};

export type Track = {
  id: string;
  title: string;
  fileUrl: string;
  coverArtUrl: string | null;
  price: number | null;
  status: "DRAFT" | "PUBLISHED";
  projectName: string | null;
  description: string | null;
  plays: number;
  downloads: number;
  createdAt: string;
};

export type AIGeneration = {
  id: string;
  type: string;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  inputData: Record<string, string> | null;
  outputUrl: string | null;
  createdAt: string;
};

export type MasteringJob = {
  id: string;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  inputData: { trackUrl?: string; tier?: string; preset?: string; trackTitle?: string } | null;
  outputUrl: string | null;
  outputData: { loudness?: number; error?: string } | null;
  createdAt: string;
};

export type Subscription = {
  tier: string;
  status: string;
  aiVideoCreditsUsed: number;
  aiVideoCreditsLimit: number;
  aiArtCreditsUsed: number;
  aiArtCreditsLimit: number;
  aiMasterCreditsUsed: number;
  aiMasterCreditsLimit: number;
  lyricVideoCreditsUsed: number;
  lyricVideoCreditsLimit: number;
  aarReportCreditsUsed: number;
  aarReportCreditsLimit: number;
};

export type ReferralData = {
  referralCode: string | null;
  referralCount: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status} ${url}`);
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Query hooks
// ─────────────────────────────────────────────────────────────────────────────

/** Artist's studio booking sessions */
export function useSessions() {
  return useQuery({
    queryKey: ["sessions"],
    queryFn: () =>
      apiFetch<{ sessions: BookingSession[] }>("/api/dashboard/sessions").then(
        (d) => d.sessions
      ),
  });
}

/** Payment receipts / earnings history */
export function useEarnings() {
  return useQuery({
    queryKey: ["earnings"],
    queryFn: () =>
      apiFetch<{ receipts: ReceiptRecord[] }>("/api/receipts").then((d) => d.receipts),
  });
}

/** Artist site data + slug */
export function useArtistSite() {
  return useQuery({
    queryKey: ["artist-site"],
    queryFn: () =>
      apiFetch<{ site: ArtistSite | null; slug: string | null; instagramHandle: string | null }>("/api/dashboard/site"),
  });
}

/** Merch products with order summaries */
export function useMerchProducts() {
  return useQuery({
    queryKey: ["merch-products"],
    queryFn: () =>
      apiFetch<{ products: MerchProduct[] }>("/api/dashboard/merch").then(
        (d) => d.products
      ),
  });
}

/** All individual merch orders for the artist */
export function useMerchOrders() {
  return useQuery({
    queryKey: ["merch-orders"],
    queryFn: () =>
      apiFetch<{ orders: MerchOrder[] }>("/api/dashboard/merch/orders").then(
        (d) => d.orders
      ),
  });
}

/** Tracks (My Tracks tab) */
export function useTracks() {
  return useQuery({
    queryKey: ["tracks"],
    queryFn: () =>
      apiFetch<{ tracks: Track[] }>("/api/dashboard/tracks").then((d) => d.tracks),
  });
}

/** AI generations filtered by type */
export function useAIGenerations(type?: string) {
  return useQuery({
    queryKey: ["ai-generations", type ?? "all"],
    queryFn: async () => {
      const data = await apiFetch<{ generations: AIGeneration[]; subscription: Subscription }>(
        "/api/dashboard/ai"
      );
      const gens = type
        ? data.generations.filter((g) => g.type === type)
        : data.generations;
      return { generations: gens, subscription: data.subscription };
    },
  });
}

/** Mastering jobs */
export function useMasterings() {
  return useQuery({
    queryKey: ["masterings"],
    queryFn: () =>
      apiFetch<{ jobs: MasteringJob[] }>("/api/dashboard/mastering").then((d) => d.jobs),
  });
}

/** Referral code + count */
export function useReferrals() {
  return useQuery({
    queryKey: ["referrals"],
    queryFn: () =>
      apiFetch<ReferralData>("/api/dashboard/referrals"),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutation hooks
// ─────────────────────────────────────────────────────────────────────────────

/** Toggle merch product active/inactive with optimistic update */
export function useToggleMerchProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetch(`/api/dashboard/merch/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }),
    onMutate: async ({ id, isActive }) => {
      await qc.cancelQueries({ queryKey: ["merch-products"] });
      const prev = qc.getQueryData<MerchProduct[]>(["merch-products"]);
      qc.setQueryData<MerchProduct[]>(["merch-products"], (old = []) =>
        old.map((p) => (p.id === id ? { ...p, isActive } : p))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["merch-products"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["merch-products"] }),
  });
}

/** Delete merch product with optimistic remove */
export function useDeleteMerchProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/dashboard/merch/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["merch-products"] });
      const prev = qc.getQueryData<MerchProduct[]>(["merch-products"]);
      qc.setQueryData<MerchProduct[]>(["merch-products"], (old = []) =>
        old.filter((p) => p.id !== id)
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["merch-products"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["merch-products"] }),
  });
}

/** Create a new merch product */
export function useCreateMerchProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      description: string;
      imageUrl: string;
      basePrice: string;
      artistMarkup: string;
      productType: string;
    }) =>
      fetch("/api/dashboard/merch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["merch-products"] }),
  });
}

/** Update merch order fulfillment status */
export function useUpdateOrderFulfillment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      fulfillmentStatus,
      trackingNumber,
    }: {
      id: string;
      fulfillmentStatus: string;
      trackingNumber?: string;
    }) =>
      fetch(`/api/dashboard/merch/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fulfillmentStatus, trackingNumber }),
      }),
    onMutate: async ({ id, fulfillmentStatus, trackingNumber }) => {
      await qc.cancelQueries({ queryKey: ["merch-orders"] });
      const prev = qc.getQueryData<MerchOrder[]>(["merch-orders"]);
      qc.setQueryData<MerchOrder[]>(["merch-orders"], (old = []) =>
        old.map((o) =>
          o.id === id
            ? {
                ...o,
                fulfillmentStatus: fulfillmentStatus as MerchOrder["fulfillmentStatus"],
                ...(trackingNumber !== undefined && { trackingNumber }),
              }
            : o
        )
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["merch-orders"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["merch-orders"] }),
  });
}

/** Update artist site (bio, heroImage, isPublished, draftMode) */
export function useUpdateSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ArtistSite>) =>
      fetch("/api/dashboard/site", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["artist-site"] }),
  });
}

/** Update a track */
export function useUpdateTrack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      title?: string;
      status?: "DRAFT" | "PUBLISHED";
      price?: number | null;
      projectName?: string;
      description?: string;
      coverArtUrl?: string | null;
    }) =>
      fetch(`/api/dashboard/tracks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tracks"] }),
  });
}

/** Delete a track */
export function useDeleteTrack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/dashboard/tracks/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["tracks"] });
      const prev = qc.getQueryData<Track[]>(["tracks"]);
      qc.setQueryData<Track[]>(["tracks"], (old = []) => old.filter((t) => t.id !== id));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["tracks"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["tracks"] }),
  });
}
