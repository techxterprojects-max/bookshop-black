import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const kind = body.kind === "wholesale" ? "wholesale" : "general";
    const required = kind === "general" ? ["name", "email", "message"] : ["businessName", "contactName", "email", "quantity", "message"];
    if (required.some(key => !String(body[key] ?? "").trim())) {
      return NextResponse.json({ error: "Please complete all required fields." }, { status: 400 });
    }
    // Configure an email provider or database here before launch. Do not silently discard submissions.
    if (!process.env.INQUIRY_TO_EMAIL || !process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: "The inquiry form is designed, but email delivery is not configured yet. Please contact the site owner." }, { status: 503 });
    }
    const email = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.INQUIRY_FROM_EMAIL || "LXE Creative Website <onboarding@resend.dev>",
        to: [process.env.INQUIRY_TO_EMAIL],
        subject: kind === "wholesale" ? "New LXE Creative wholesale inquiry" : "New LXE Creative contact message",
        reply_to: body.email,
        text: Object.entries(body).map(([key, value]) => `${key}: ${String(value)}`).join("\n"),
      }),
    });
    if (!email.ok) return NextResponse.json({ error: "We could not send your message right now. Please try again later." }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid form submission." }, { status: 400 });
  }
}
