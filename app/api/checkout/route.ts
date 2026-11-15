import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import type { Database } from "@/lib/database.types";

type CartItemInput = {
  productId?: unknown;
  quantity?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeKey || !supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Payment system is not configured correctly." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid checkout request." },
      { status: 400 }
    );
  }

  if (!isRecord(body)) {
    return NextResponse.json(
      { error: "Invalid checkout request." },
      { status: 400 }
    );
  }

  const items = body.items;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "Your shopping bag is empty." },
      { status: 400 }
    );
  }

  const quantities = new Map<number, number>();

  for (const item of items as CartItemInput[]) {
    if (!isRecord(item)) {
      return NextResponse.json(
        { error: "One or more cart items are invalid." },
        { status: 400 }
      );
    }

    const productId = Number(item.productId);
    const quantity = Number(item.quantity);

    if (
      !Number.isInteger(productId) ||
      productId < 1 ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 20
    ) {
      return NextResponse.json(
        { error: "One or more cart items are invalid." },
        { status: 400 }
      );
    }

    const totalQuantity = (quantities.get(productId) || 0) + quantity;
    if (totalQuantity > 20) {
      return NextResponse.json(
        { error: "Maximum quantity per product is 20." },
        { status: 400 }
      );
    }
    quantities.set(productId, totalQuantity);
  }

  try {
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const productIds = Array.from(quantities.keys());
    const { data: products, error } = await supabase
      .from("products")
      .select("id, title, price")
      .in("id", productIds)
      .eq("active", true);

    if (error) {
      console.error("Supabase product lookup error:", error);
      return NextResponse.json(
        { error: "Unable to verify your products." },
        { status: 500 }
      );
    }

    if (!products || products.length !== productIds.length) {
      return NextResponse.json(
        { error: "One or more products are unavailable." },
        { status: 400 }
      );
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
      products.map((product) => {
        const priceInCents = Math.round(Number(product.price) * 100);

        if (
          !Number.isFinite(priceInCents) ||
          priceInCents < 1 ||
          !product.title.trim()
        ) {
          throw new Error(`Invalid checkout data for product ${product.id}`);
        }

        return {
          quantity: quantities.get(product.id)!,
          price_data: {
            currency: "usd",
            unit_amount: priceInCents,
            product_data: {
              name: product.title,
            },
          },
        };
      });

    const stripe = new Stripe(stripeKey);
    const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const origin = configuredSiteUrl
      ? new URL(configuredSiteUrl).origin
      : new URL(request.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: new URL("/?checkout=success", origin).toString(),
      cancel_url: new URL("/?checkout=cancelled", origin).toString(),
      shipping_address_collection: {
        allowed_countries: ["US"],
      },
      billing_address_collection: "required",
      metadata: {
        product_ids: productIds.join(","),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);

    return NextResponse.json(
      { error: "Unable to start checkout. Please try again." },
      { status: 500 }
    );
  }
}
