/**
 * Brevo email campaign service
 * Handles blast campaigns: newsletters, product announcements, waitlist emails, promo drops.
 */

import { getBrevoClient } from "./client";

const FROM_EMAIL = () => process.env.BREVO_FROM_EMAIL ?? "hello@indiethis.com";
const FROM_NAME = () => process.env.BREVO_FROM_NAME ?? "IndieThis";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateCampaignOptions {
  name: string;
  subject: string;
  fromEmail?: string;
  fromName?: string;
  /** Brevo list IDs to send to */
  listIds: number[];
  /** Inline HTML content (use this OR templateId) */
  htmlContent?: string;
  /** Brevo template ID (use this OR htmlContent) */
  templateId?: number;
  /** Schedule send — ISO 8601 datetime string. Omit to save as draft. */
  scheduledAt?: string;
  /** Reply-to address */
  replyTo?: string;
  tag?: string;
}

export interface AddContactOptions {
  email: string;
  firstName?: string;
  lastName?: string;
  /** Brevo list IDs to add the contact to */
  listIds?: number[];
  attributes?: Record<string, string | number | boolean>;
  updateEnabled?: boolean;
}

// ---------------------------------------------------------------------------
// Campaign management
// ---------------------------------------------------------------------------

/**
 * Create an email campaign (draft or scheduled).
 * Returns the Brevo campaign ID.
 */
export async function createEmailCampaign(
  options: CreateCampaignOptions
): Promise<number> {
  const client = getBrevoClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await client.emailCampaigns.createEmailCampaign({
    name: options.name,
    subject: options.subject,
    sender: {
      email: options.fromEmail ?? FROM_EMAIL(),
      name: options.fromName ?? FROM_NAME(),
    },
    recipients: { listIds: options.listIds },
    ...(options.htmlContent && { htmlContent: options.htmlContent }),
    ...(options.templateId && { templateId: options.templateId }),
    ...(options.scheduledAt && { scheduledAt: options.scheduledAt }),
    ...(options.replyTo && { replyTo: options.replyTo }),
    ...(options.tag && { tag: options.tag }),
  });

  // @getbrevo/brevo v2: result may wrap body in `.data`
  return result?.data?.id ?? result?.id ?? 0;
}

/**
 * Immediately send a saved campaign by its ID.
 */
export async function sendCampaignNow(campaignId: number): Promise<void> {
  const client = getBrevoClient();
  await client.emailCampaigns.sendEmailCampaignNow({ campaignId });
}

/**
 * Reschedule a campaign to send at a future datetime.
 * `scheduledAt` — ISO 8601 string, e.g. "2026-04-01T10:00:00+00:00"
 */
export async function scheduleCampaign(
  campaignId: number,
  scheduledAt: string
): Promise<void> {
  const client = getBrevoClient();
  await client.emailCampaigns.updateEmailCampaign({ campaignId, scheduledAt });
}

/**
 * Create and immediately send a campaign in one call.
 */
export async function createAndSendCampaign(
  options: Omit<CreateCampaignOptions, "scheduledAt">
): Promise<number> {
  const id = await createEmailCampaign(options);
  await sendCampaignNow(id);
  return id;
}

// ---------------------------------------------------------------------------
// Pre-built campaign templates
// ---------------------------------------------------------------------------

export async function sendWaitlistAnnouncementCampaign(params: {
  listId: number;
  launchDate: string;
  earlyAccessLink: string;
}): Promise<number> {
  return createAndSendCampaign({
    name: `Waitlist Announcement — ${new Date().toISOString().slice(0, 10)}`,
    subject: "IndieThis is almost here — you're on the list 🎤",
    listIds: [params.listId],
    htmlContent: `
      <h1>You're in.</h1>
      <p>IndieThis launches on <strong>${params.launchDate}</strong>. As a waitlist member, you get early access.</p>
      <p><a href="${params.earlyAccessLink}">Claim Early Access →</a></p>
      <p>AI tools, merch storefronts, beat marketplace, studio bookings — all in one place.</p>
      <p>— The IndieThis Team</p>
    `,
    tag: "waitlist",
  });
}

export async function sendFeatureLaunchCampaign(params: {
  listIds: number[];
  featureName: string;
  featureDescription: string;
  ctaLabel: string;
  ctaUrl: string;
}): Promise<number> {
  return createAndSendCampaign({
    name: `Feature Launch — ${params.featureName}`,
    subject: `New on IndieThis: ${params.featureName}`,
    listIds: params.listIds,
    htmlContent: `
      <h1>${params.featureName} is live</h1>
      <p>${params.featureDescription}</p>
      <p><a href="${params.ctaUrl}">${params.ctaLabel} →</a></p>
    `,
    tag: "feature-launch",
  });
}

export async function sendMonthlyNewsletter(params: {
  listIds: number[];
  month: string;
  htmlContent: string;
}): Promise<number> {
  return createAndSendCampaign({
    name: `Newsletter — ${params.month}`,
    subject: `IndieThis — ${params.month} updates for independent artists`,
    listIds: params.listIds,
    htmlContent: params.htmlContent,
    tag: "newsletter",
  });
}

// ---------------------------------------------------------------------------
// Contact management
// ---------------------------------------------------------------------------

/**
 * Add or update a contact in Brevo. Merges attributes and list memberships.
 */
export async function upsertContact(options: AddContactOptions): Promise<void> {
  const client = getBrevoClient();

  const attributes: Record<string, string | number | boolean> = {};
  if (options.firstName) attributes["FIRSTNAME"] = options.firstName;
  if (options.lastName) attributes["LASTNAME"] = options.lastName;
  if (options.attributes) Object.assign(attributes, options.attributes);

  await client.contacts.createContact({
    email: options.email,
    updateEnabled: options.updateEnabled ?? true,
    ...(Object.keys(attributes).length > 0 && { attributes }),
    ...(options.listIds?.length && { listIds: options.listIds }),
  });
}

/**
 * Add a waitlist signup — creates contact and adds to the waitlist list.
 */
export async function addWaitlistSignup(params: {
  email: string;
  firstName?: string;
  referralSource?: string;
}): Promise<void> {
  const waitlistListId = Number(process.env.BREVO_WAITLIST_LIST_ID ?? 1);
  await upsertContact({
    email: params.email,
    firstName: params.firstName,
    listIds: [waitlistListId],
    ...(params.referralSource && {
      attributes: { REFERRAL_SOURCE: params.referralSource },
    }),
    updateEnabled: true,
  });
}

/**
 * Unsubscribe a contact from a specific list (does not delete the contact).
 * Uses the v2 SDK request shape: { listId, body: { emails } }
 */
export async function removeFromList(
  email: string,
  listId: number
): Promise<void> {
  const client = getBrevoClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client.contacts.removeContactFromList as any)({
    listId,
    body: { emails: [email] },
  });
}
