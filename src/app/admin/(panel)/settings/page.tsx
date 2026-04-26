import { Settings, ShieldCheck, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { requireAdminAccess } from "@/lib/require-admin-access";

type IntegrationItem = {
  name:     string;
  key:      string;
  env:      string | undefined;
  required: boolean;        // missing required → red, missing optional → amber
  hint?:    string;         // shown when missing
};

type IntegrationGroup = {
  title: string;
  items: IntegrationItem[];
};

export default async function AdminSettingsPage() {
  const { session } = await requireAdminAccess("settings");

  // ─────────────────────────────────────────────────────────────────────────
  // Categorised integration map. Each entry reads its env var live; "required"
  // marks anything the platform genuinely cannot run without (auth, DB, core
  // payments). Optional entries (analytics, third-party AI add-ons, secondary
  // OAuth) flag amber instead of red so the page tells you what's missing
  // without screaming about features you haven't enabled yet.
  // ─────────────────────────────────────────────────────────────────────────
  const groups: IntegrationGroup[] = [
    {
      title: "Core",
      items: [
        { name: "Database URL",        key: "DATABASE_URL",       env: process.env.DATABASE_URL,       required: true },
        { name: "Direct URL (Prisma)", key: "DIRECT_URL",         env: process.env.DIRECT_URL,         required: true,  hint: "Required for Prisma migrations" },
        { name: "NextAuth Secret",     key: "AUTH_SECRET",        env: process.env.AUTH_SECRET,        required: true },
        { name: "NextAuth URL",        key: "NEXTAUTH_URL",       env: process.env.NEXTAUTH_URL,       required: true },
        { name: "App URL (public)",    key: "NEXT_PUBLIC_APP_URL",env: process.env.NEXT_PUBLIC_APP_URL,required: true },
        { name: "Cron Secret",         key: "CRON_SECRET",        env: process.env.CRON_SECRET,        required: true,  hint: "Protects /api/cron endpoints" },
        { name: "Admin Password",      key: "ADMIN_PASSWORD",     env: process.env.ADMIN_PASSWORD,     required: true },
      ],
    },
    {
      title: "Payments — Stripe",
      items: [
        { name: "Stripe Secret Key",       key: "STRIPE_SECRET_KEY",       env: process.env.STRIPE_SECRET_KEY,       required: true },
        { name: "Stripe Webhook Secret",   key: "STRIPE_WEBHOOK_SECRET",   env: process.env.STRIPE_WEBHOOK_SECRET,   required: true },
        { name: "Stripe Publishable Key",  key: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", env: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, required: true },
        { name: "Price — Launch",          key: "STRIPE_PRICE_LAUNCH",     env: process.env.STRIPE_PRICE_LAUNCH,     required: false },
        { name: "Price — Push",            key: "STRIPE_PRICE_PUSH",       env: process.env.STRIPE_PRICE_PUSH,       required: false },
        { name: "Price — Reign",           key: "STRIPE_PRICE_REIGN",      env: process.env.STRIPE_PRICE_REIGN,      required: false },
        { name: "Price — Studio Pro",      key: "STRIPE_PRICE_STUDIO_PRO", env: process.env.STRIPE_PRICE_STUDIO_PRO, required: false },
        { name: "Price — Studio Elite",    key: "STRIPE_PRICE_STUDIO_ELITE",env: process.env.STRIPE_PRICE_STUDIO_ELITE,required: false },
        { name: "Price — Video Canvas",    key: "STRIPE_PRICE_VIDEO_CANVAS",env: process.env.STRIPE_PRICE_VIDEO_CANVAS,required: false },
      ],
    },
    {
      title: "AI & Compute",
      items: [
        { name: "Anthropic (Claude)",         key: "ANTHROPIC_API_KEY",                env: process.env.ANTHROPIC_API_KEY,                required: true },
        { name: "Replicate API Token",        key: "REPLICATE_API_TOKEN",              env: process.env.REPLICATE_API_TOKEN,              required: true },
        { name: "Replicate — Mastering Model",key: "REPLICATE_MASTERING_MODEL_VERSION",env: process.env.REPLICATE_MASTERING_MODEL_VERSION,required: true,  hint: "Cog DSP version SHA — bump after each cog push" },
        { name: "Replicate — Mix Model",      key: "REPLICATE_MIX_MODEL_VERSION",      env: process.env.REPLICATE_MIX_MODEL_VERSION,      required: true,  hint: "Mix-console Cog version SHA" },
        { name: "Replicate — Generic Model",  key: "REPLICATE_MODEL_VERSION",          env: process.env.REPLICATE_MODEL_VERSION,          required: false },
        { name: "fal.ai Key",                 key: "FAL_KEY",                          env: process.env.FAL_KEY,                          required: true,  hint: "Cover art, song analysis, demucs stem separation" },
        { name: "Runway API",                 key: "RUNWAY_API_KEY",                   env: process.env.RUNWAY_API_KEY,                   required: false, hint: "Optional — video studio fallback" },
        { name: "Auphonic API",               key: "AUPHONIC_API_KEY",                 env: process.env.AUPHONIC_API_KEY,                 required: false },
        { name: "ACRCloud Token",             key: "ACRCLOUD_TOKEN",                   env: process.env.ACRCLOUD_TOKEN,                   required: false, hint: "Audio fingerprinting for reference library" },
      ],
    },
    {
      title: "Storage & Uploads",
      items: [
        { name: "Supabase URL",          key: "SUPABASE_URL",          env: process.env.SUPABASE_URL,          required: true },
        { name: "Supabase Service Key",  key: "SUPABASE_SERVICE_KEY",  env: process.env.SUPABASE_SERVICE_KEY,  required: true },
        { name: "UploadThing Token",     key: "UPLOADTHING_TOKEN",     env: process.env.UPLOADTHING_TOKEN,     required: true },
        { name: "AWS Access Key",        key: "AWS_ACCESS_KEY_ID",     env: process.env.AWS_ACCESS_KEY_ID,     required: false, hint: "S3 — used by reference-library ingest" },
        { name: "AWS Secret",            key: "AWS_SECRET_ACCESS_KEY", env: process.env.AWS_SECRET_ACCESS_KEY, required: false },
        { name: "AWS Region",            key: "AWS_REGION",            env: process.env.AWS_REGION,            required: false },
      ],
    },
    {
      title: "Email & Marketing — Brevo",
      items: [
        { name: "Brevo API Key",           key: "BREVO_API_KEY",            env: process.env.BREVO_API_KEY,            required: true },
        { name: "Brevo From Email",        key: "BREVO_FROM_EMAIL",         env: process.env.BREVO_FROM_EMAIL,         required: true },
        { name: "Brevo From Name",         key: "BREVO_FROM_NAME",          env: process.env.BREVO_FROM_NAME,          required: false },
        { name: "Brevo Artists List ID",   key: "BREVO_ARTISTS_LIST_ID",    env: process.env.BREVO_ARTISTS_LIST_ID,    required: false },
        { name: "Brevo Studios List ID",   key: "BREVO_STUDIOS_LIST_ID",    env: process.env.BREVO_STUDIOS_LIST_ID,    required: false },
        { name: "Brevo Waitlist List ID",  key: "BREVO_WAITLIST_LIST_ID",   env: process.env.BREVO_WAITLIST_LIST_ID,   required: false },
        { name: "Brevo Newsletter List ID",key: "BREVO_NEWSLETTER_LIST_ID", env: process.env.BREVO_NEWSLETTER_LIST_ID, required: false },
        { name: "Brevo SMS Sender",        key: "BREVO_SMS_SENDER",         env: process.env.BREVO_SMS_SENDER,         required: false },
      ],
    },
    {
      title: "OAuth Providers",
      items: [
        { name: "Google Client ID",     key: "GOOGLE_CLIENT_ID",     env: process.env.GOOGLE_CLIENT_ID,     required: false, hint: "Required for Google sign-in" },
        { name: "Google Client Secret", key: "GOOGLE_CLIENT_SECRET", env: process.env.GOOGLE_CLIENT_SECRET, required: false },
        { name: "Facebook Client ID",   key: "FACEBOOK_CLIENT_ID",   env: process.env.FACEBOOK_CLIENT_ID,   required: false, hint: "Required for Facebook sign-in" },
        { name: "Facebook Client Secret",key:"FACEBOOK_CLIENT_SECRET",env: process.env.FACEBOOK_CLIENT_SECRET,required: false },
      ],
    },
    {
      title: "Video — Remotion",
      items: [
        { name: "Remotion Serve URL",     key: "REMOTION_SERVE_URL",     env: process.env.REMOTION_SERVE_URL,     required: false, hint: "Required for music video stitching" },
        { name: "Remotion Function Name", key: "REMOTION_FUNCTION_NAME", env: process.env.REMOTION_FUNCTION_NAME, required: false },
      ],
    },
    {
      title: "Analytics & Workflows",
      items: [
        { name: "PostHog Project Token", key: "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", env: process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN, required: false },
        { name: "PostHog Host",          key: "NEXT_PUBLIC_POSTHOG_HOST",          env: process.env.NEXT_PUBLIC_POSTHOG_HOST,          required: false },
        { name: "Inngest Event Key",     key: "INNGEST_EVENT_KEY",                 env: process.env.INNGEST_EVENT_KEY,                 required: false },
        { name: "Inngest Signing Key",   key: "INNGEST_SIGNING_KEY",               env: process.env.INNGEST_SIGNING_KEY,               required: false },
      ],
    },
    {
      title: "Other Integrations",
      items: [
        { name: "Printful API Key", key: "PRINTFUL_API_KEY", env: process.env.PRINTFUL_API_KEY, required: false, hint: "Required for merch storefront" },
        { name: "YouTube API Key",  key: "YOUTUBE_API_KEY",  env: process.env.YOUTUBE_API_KEY,  required: false, hint: "oEmbed fallback / metadata" },
        { name: "App Webhook URL",  key: "APP_WEBHOOK_URL",  env: process.env.APP_WEBHOOK_URL,  required: false },
      ],
    },
    {
      title: "Feature Flags",
      items: [
        { name: "Mastering Paywall Disabled", key: "MASTERING_PAYWALL_DISABLED", env: process.env.MASTERING_PAYWALL_DISABLED, required: false, hint: "Set to '1' to bypass payment in dev" },
      ],
    },
  ];

  // Aggregate counts for the summary banner
  let totalRequired      = 0;
  let missingRequired    = 0;
  let totalOptional      = 0;
  let missingOptional    = 0;
  for (const g of groups) {
    for (const it of g.items) {
      if (it.required) {
        totalRequired++;
        if (!it.env) missingRequired++;
      } else {
        totalOptional++;
        if (!it.env) missingOptional++;
      }
    }
  }
  const allRequiredOk = missingRequired === 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Platform Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Environment configuration and integrations</p>
      </div>

      {/* Summary banner */}
      <div className="rounded-2xl border px-5 py-4 flex items-center gap-3"
           style={{
             backgroundColor: "var(--card)",
             borderColor:     allRequiredOk ? "#34C75944" : "#E85D4A55",
           }}>
        {allRequiredOk
          ? <CheckCircle2 size={18} style={{ color: "#34C759" }} />
          : <AlertCircle  size={18} style={{ color: "#E85D4A" }} />}
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">
            {allRequiredOk
              ? "All required integrations configured."
              : `${missingRequired} required integration${missingRequired === 1 ? "" : "s"} missing.`}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totalRequired - missingRequired}/{totalRequired} required · {totalOptional - missingOptional}/{totalOptional} optional configured
          </p>
        </div>
      </div>

      {/* One card per group */}
      {groups.map((group) => {
        const groupMissingRequired = group.items.filter(i => i.required && !i.env).length;
        const groupMissingOptional = group.items.filter(i => !i.required && !i.env).length;
        return (
          <div key={group.title} className="rounded-2xl border overflow-hidden"
               style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b"
                 style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2">
                <Settings size={15} className="text-accent" />
                <h2 className="text-sm font-semibold text-foreground">{group.title}</h2>
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">
                {groupMissingRequired > 0
                  ? <span style={{ color: "#E85D4A" }}>{groupMissingRequired} missing</span>
                  : groupMissingOptional > 0
                    ? <span style={{ color: "#D4A843" }}>{groupMissingOptional} optional</span>
                    : <span style={{ color: "#34C759" }}>All set</span>}
              </span>
            </div>
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {group.items.map(({ name, key, env, required, hint }) => {
                const configured = !!env;
                // Required missing → red. Optional missing → amber. Configured → green.
                const statusColor = configured
                  ? "#34C759"
                  : required ? "#E85D4A" : "#D4A843";
                const statusLabel = configured
                  ? "Configured"
                  : required ? "Missing" : "Not set";
                return (
                  <div key={key} className="flex items-center justify-between px-5 py-3.5 gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{name}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">{key}</p>
                      {!configured && hint && (
                        <p className="text-[11px] mt-1" style={{ color: "#888" }}>{hint}</p>
                      )}
                    </div>
                    <span className="flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap"
                          style={{ color: statusColor }}>
                      {configured
                        ? <CheckCircle2 size={13} />
                        : <XCircle      size={13} />}
                      {statusLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Admin identity */}
      <div className="rounded-2xl border p-5 space-y-3"
           style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2 pb-2 border-b"
             style={{ borderColor: "var(--border)" }}>
          <ShieldCheck size={15} className="text-accent" />
          <h2 className="text-sm font-semibold text-foreground">Admin Account</h2>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-foreground">{session.name}</p>
          <p className="text-xs text-muted-foreground">{session.email}</p>
          <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1"
                style={{ backgroundColor: "#E85D4A18", color: "#E85D4A" }}>
            {session.role}
          </span>
        </div>
      </div>
    </div>
  );
}
