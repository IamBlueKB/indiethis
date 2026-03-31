/**
 * src/lib/printful.ts
 * Printful API client for IndieThis.
 *
 * No Printful branding is exposed to users — all calls are server-side only.
 * Rate limit: 120 req/min. Exponential backoff on 429.
 */

const BASE_URL  = "https://api.printful.com";
const API_KEY   = () => process.env.PRINTFUL_API_KEY!;

// ─── Core fetch with retry ────────────────────────────────────────────────────

async function pf<T>(
  path:    string,
  options: RequestInit = {},
  attempt  = 0,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${API_KEY()}`,
      "Content-Type":  "application/json",
      ...(options.headers ?? {}),
    },
  });

  // Rate limit — exponential backoff up to 3 retries
  if (res.status === 429 && attempt < 3) {
    const wait = Math.pow(2, attempt) * 1000 + Math.random() * 500;
    await new Promise((r) => setTimeout(r, wait));
    return pf<T>(path, options, attempt + 1);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Printful API error ${res.status} on ${path}: ${body}`);
  }

  const json = await res.json() as { result: T; code: number };
  return json.result;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type PrintfulProduct = {
  id:           number;
  title:        string;
  type:         string;
  type_name:    string;
  description:  string;
  image:        string;
  variant_count: number;
};

export type PrintfulVariant = {
  id:           number;
  product_id:   number;
  name:         string;
  size:         string;
  color:        string;
  color_code:   string;
  image:        string;
  price:        string;   // e.g. "12.95"
  in_stock:     boolean;
};

export type PrintfulMockupTask = {
  task_key:    string;
  status:      "pending" | "completed" | "failed";
  mockups?:    { placement: string; mockup_url: string }[];
};

export type PrintfulShippingRate = {
  id:       string;
  name:     string;
  rate:     string;  // e.g. "4.99"
  currency: string;
};

export type PrintfulOrder = {
  id:             number;
  external_id:    string;
  status:         string;
  shipping:       string;
  created:        number;
  updated:        number;
  recipient:      Record<string, string>;
  items:          PrintfulOrderItem[];
  retail_costs:   { subtotal: string; discount: string; shipping: string; tax: string; total: string };
  shipments:      PrintfulShipment[];
};

export type PrintfulOrderItem = {
  id:         number;
  external_id: string;
  variant_id: number;
  quantity:   number;
  price:      string;
  retail_price: string;
  name:       string;
  files:      { url: string; placement: string }[];
};

export type PrintfulShipment = {
  id:              number;
  carrier:         string;
  service:         string;
  tracking_number: string;
  tracking_url:    string;
  ship_date:       string;
  shipped_at:      number;
};

export type CreateOrderItem = {
  variant_id:   number;
  quantity:     number;
  retail_price: string;
  files:        { url: string; placement: string }[];
};

export type ShippingAddress = {
  name:        string;
  address1:    string;
  address2?:   string;
  city:        string;
  state_code:  string;
  country_code: string;
  zip:         string;
  email:       string;
  phone?:      string;
};

// ─── Catalog ──────────────────────────────────────────────────────────────────

/**
 * Fetch all products from Printful's catalog.
 * Returns the full catalog — filter in printful-catalog.ts.
 */
export async function getCatalogProducts(): Promise<PrintfulProduct[]> {
  return pf<PrintfulProduct[]>("/products");
}

/**
 * Fetch all variants for a specific catalog product.
 */
export async function getCatalogVariants(productId: number): Promise<PrintfulVariant[]> {
  const result = await pf<{ product: PrintfulProduct; variants: PrintfulVariant[] }>(
    `/products/${productId}`
  );
  return result.variants;
}

// ─── Mockup generation ────────────────────────────────────────────────────────

type MockupFile = {
  placement:   string;   // "front" | "back" | "embroidery_front"
  image_url:   string;
  position?: {
    area_width:  number;
    area_height: number;
    width:       number;
    height:      number;
    top:         number;
    left:        number;
  };
};

/**
 * Submit a mockup generation task.
 * Returns task_key — poll with getMockupResult().
 */
export async function createMockup(
  productId:  number,
  variantIds: number[],
  files:      MockupFile[],
): Promise<string> {
  const result = await pf<{ task_key: string }>("/mockup-generator/create-task", {
    method: "POST",
    body:   JSON.stringify({ variant_ids: variantIds, files }),
  });
  return result.task_key;
}

/**
 * Poll for mockup generation result.
 * Call repeatedly until status === "completed" or "failed".
 */
export async function getMockupResult(taskKey: string): Promise<PrintfulMockupTask> {
  return pf<PrintfulMockupTask>(`/mockup-generator/task?task_key=${taskKey}`);
}

/**
 * Helper: submit mockup task and poll until done (max 30s).
 * Returns the first mockup URL.
 */
export async function generateMockup(
  productId:   number,
  variantIds:  number[],
  designUrl:   string,
  placement:   string = "front",
): Promise<string | null> {
  const taskKey = await createMockup(productId, variantIds, [
    { placement, image_url: designUrl },
  ]);

  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const result = await getMockupResult(taskKey);
    if (result.status === "completed" && result.mockups?.[0]) {
      return result.mockups[0].mockup_url;
    }
    if (result.status === "failed") return null;
  }
  return null; // timeout
}

// ─── Shipping ─────────────────────────────────────────────────────────────────

type ShippingItem = {
  variant_id: number;
  quantity:   number;
};

/**
 * Estimate shipping rates for given items to a destination.
 */
export async function estimateShipping(
  items:       ShippingItem[],
  recipient:   ShippingAddress,
  currency:    string = "USD",
  locale:      string = "en_US",
): Promise<PrintfulShippingRate[]> {
  return pf<PrintfulShippingRate[]>("/shipping/rates", {
    method: "POST",
    body:   JSON.stringify({ recipient, items, currency, locale }),
  });
}

// ─── Orders ───────────────────────────────────────────────────────────────────

type RetailCosts = {
  subtotal:  string;
  shipping:  string;
  tax?:      string;
  discount?: string;
};

/**
 * Create and confirm an order for fulfillment.
 * externalId should be your internal MerchOrder.id for reconciliation.
 */
export async function createOrder(
  externalId:   string,
  recipient:    ShippingAddress,
  items:        CreateOrderItem[],
  retailCosts:  RetailCosts,
  shipping:     string = "STANDARD",
): Promise<PrintfulOrder> {
  // Create draft first
  const draft = await pf<PrintfulOrder>("/orders", {
    method: "POST",
    body:   JSON.stringify({
      external_id:  externalId,
      shipping,
      recipient,
      items,
      retail_costs: retailCosts,
    }),
  });

  // Confirm to move to production
  return pf<PrintfulOrder>(`/orders/${draft.id}/confirm`, { method: "POST" });
}

/**
 * Get order status and shipment info.
 */
export async function getOrder(orderId: string | number): Promise<PrintfulOrder> {
  return pf<PrintfulOrder>(`/orders/${orderId}`);
}

/**
 * Cancel an order (only possible before it enters production).
 */
export async function cancelOrder(orderId: string | number): Promise<PrintfulOrder> {
  return pf<PrintfulOrder>(`/orders/${orderId}/cancel`, { method: "DELETE" });
}
