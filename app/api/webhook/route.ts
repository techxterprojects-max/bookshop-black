
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeKey || !webhookSecret || !supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Webhook environment variables are missing." },
      { status: 500 }
    );
  }

  const stripe = new Stripe(stripeKey);
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature." },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    );
  } catch (error) {
    console.error("Stripe signature verification failed:", error);
    return NextResponse.json(
      { error: "Invalid webhook signature." },
      { status: 400 }
    );
  }

  try {
    if (
      event.type !== "checkout.session.completed" &&
      event.type !== "checkout.session.async_payment_succeeded"
    ) {
      return NextResponse.json({ received: true });
    }

    // Retrieve the session using the SDK's API version, not the webhook's version.
    const session = await stripe.checkout.sessions.retrieve(event.data.object.id);

    // Only record successfully paid sessions.
    if (session.payment_status !== "paid") {
      return NextResponse.json({ received: true });
    }

    const lineItems = await stripe.checkout.sessions.listLineItems(
      session.id,
      { limit: 100 }
    );

    const items = lineItems.data.map((item) => ({
      title: item.description || "Book",
      quantity: item.quantity || 1,
    }));

    const shippingDetails = session.collected_information?.shipping_details;
    const customerDetails = session.customer_details;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error } = await supabase
      .from("orders")
      .upsert(
        {
          stripe_session_id: session.id,
          customer_email: customerDetails?.email || session.customer_email,
          customer_name: customerDetails?.name || shippingDetails?.name || null,
          phone: customerDetails?.phone || null,
          shipping_name: shippingDetails?.name || null,
          shipping_address: shippingDetails?.address || null,
          amount_total: session.amount_total || 0,
          currency: session.currency || "usd",
          status: "paid",
          fulfillment_status: "unfulfilled",
          items,
          paid_at: new Date().toISOString(),
        },
        { onConflict: "stripe_session_id" }
      );

    if (error) {
      console.error("Supabase order save failed:", error);
      return NextResponse.json(
        { error: "Unable to save order." },
        { status: 500 }
      );
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook processing failed:", error);
    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500 }
    );
  }
}
