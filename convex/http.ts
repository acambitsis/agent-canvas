/**
 * Convex HTTP routes for webhooks
 *
 * Handles WorkOS webhook events for real-time org membership sync
 */

import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { ORG_ROLES } from "./lib/validators";

const http = httpRouter();

/**
 * WorkOS webhook handler for organization membership events
 *
 * Events handled:
 * - organization_membership.created: User added to org
 * - organization_membership.updated: User's role changed
 * - organization_membership.deleted: User removed from org
 */
http.route({
  path: "/workos/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Get the webhook secret from environment
    const webhookSecret = process.env.WORKOS_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("WORKOS_WEBHOOK_SECRET not configured");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    // Verify HMAC signature
    const signature = request.headers.get("WorkOS-Signature");
    if (!signature) {
      return new Response("Missing signature", { status: 401 });
    }

    const body = await request.text();

    // Parse the signature header (format: "t=timestamp,v1=signature")
    const sigParts = signature.split(",").reduce(
      (acc, part) => {
        const [key, value] = part.split("=");
        acc[key] = value;
        return acc;
      },
      {} as Record<string, string>
    );

    const timestamp = sigParts["t"];
    const signatureHash = sigParts["v1"];

    if (!timestamp || !signatureHash) {
      return new Response("Invalid signature format", { status: 401 });
    }

    // Verify timestamp is within 5 minutes to prevent replay attacks
    const timestampNum = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestampNum) > 300) {
      return new Response("Timestamp too old", { status: 401 });
    }

    // Compute expected signature
    const signedPayload = `${timestamp}.${body}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(signedPayload)
    );

    // Use constant-time comparison to prevent timing attacks
    // Convert the received signature from hex to bytes for comparison
    const receivedBytes = new Uint8Array(
      signatureHash.match(/.{2}/g)?.map((byte) => parseInt(byte, 16)) || []
    );
    const expectedBytes = new Uint8Array(signatureBuffer);

    // Constant-time comparison: always compare all bytes
    if (receivedBytes.length !== expectedBytes.length) {
      console.error("Webhook signature verification failed: length mismatch");
      return new Response("Invalid signature", { status: 401 });
    }

    let mismatch = 0;
    for (let i = 0; i < expectedBytes.length; i++) {
      mismatch |= receivedBytes[i] ^ expectedBytes[i];
    }

    if (mismatch !== 0) {
      console.error("Webhook signature verification failed");
      return new Response("Invalid signature", { status: 401 });
    }

    // Parse the event
    let event: {
      event: string;
      data: {
        id: string;
        user_id: string;
        organization_id: string;
        role?: { slug: string };
        status?: string;
      };
    };

    try {
      event = JSON.parse(body);
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const eventType = event.event;
    const data = event.data;
    const timestamp_ms = Date.now();

    console.log(`Processing webhook event: ${eventType}`);

    try {
      switch (eventType) {
        case "organization_membership.created":
        case "organization_membership.updated": {
          // Upsert the membership
          await ctx.runMutation(internal.orgMemberships.upsertMembershipInternal, {
            workosUserId: data.user_id,
            workosOrgId: data.organization_id,
            role: data.role?.slug || ORG_ROLES.MEMBER,
            timestamp: timestamp_ms,
          });
          break;
        }

        case "organization_membership.deleted": {
          // Remove the membership
          await ctx.runMutation(internal.orgMemberships.removeMembershipInternal, {
            workosUserId: data.user_id,
            workosOrgId: data.organization_id,
            timestamp: timestamp_ms,
          });
          break;
        }

        default:
          // Ignore other event types
          console.log(`Ignoring webhook event type: ${eventType}`);
      }

      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("Error processing webhook:", error);
      return new Response("Internal error", { status: 500 });
    }
  }),
});

// Export the router
export default http;
