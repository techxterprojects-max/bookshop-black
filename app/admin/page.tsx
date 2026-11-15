
"use client";

import { useEffect, useState } from "react";
import type { FormEvent, CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type Product = {
  id: number;
  title: string;
  category: string;
  price: number;
  description: string;
  amazon_url: string | null;
  image_url: string | null;
  back_image_url: string | null;
  gallery_images: string[] | null;
  active: boolean;
};

type Order = {
  id: number;
  status: string;
  fulfillment_status: string | null;
  customer_email: string | null;
  customer_name: string | null;
  amount_total: number;
  created_at: string;
  shipping_carrier: string | null;
  tracking_number: string | null;
  items: { title?: string; quantity?: number }[] | null;
  phone: string | null;
  shipping_name: string | null;
  shipping_address: Record<string, unknown> | string | null;
  currency: string | null;
  paid_at: string | null;
  fulfilled_at: string | null;
};

const emptyProduct = {
  title: "",
  category: "kids",
  price: "9.99",
  description: "",
  amazon_url: "",
  image_url: "",
  back_image_url: "",
  gallery_images: [] as string[],
  active: true,
};

export default function AdminPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [orderFulfillmentDraft, setOrderFulfillmentDraft] =
    useState("unfulfilled");
  const [orderCarrierDraft, setOrderCarrierDraft] = useState("");
  const [orderTrackingDraft, setOrderTrackingDraft] = useState("");
  const [draft, setDraft] = useState(emptyProduct);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState("Checking admin access...");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function loadDashboard() {
    const supabase = getSupabaseBrowser();

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    if (!user) {
      setSignedIn(false);
      setAuthorized(false);
      setMessage("Please sign in with your admin account.");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || profile?.role !== "admin") {
      setAuthorized(false);
      setMessage("This account does not have admin permissions.");
      return;
    }

    const [productResult, orderResult] = await Promise.all([
      supabase.from("products").select("*").order("id", { ascending: true }),
      supabase
        .from("orders")
        .select(
          "id,status,fulfillment_status,customer_email,customer_name,phone,shipping_name,shipping_address,amount_total,currency,created_at,paid_at,fulfilled_at,shipping_carrier,tracking_number,items"
        )
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (productResult.error) {
      setMessage("Could not load books: " + productResult.error.message);
      return;
    }

    if (orderResult.error) {
      setMessage("Could not load orders: " + orderResult.error.message);
      return;
    }

    setProducts(productResult.data || []);
    setOrders(orderResult.data || []);
    setSignedIn(true);
    setAuthorized(true);
    setMessage("");
  }

  useEffect(() => {
    const supabase = getSupabaseBrowser();

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSignedIn(true);
        loadDashboard().catch(() =>
          setMessage("Unable to load the admin dashboard.")
        );
      } else {
        setMessage("Sign in with your admin account.");
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSignedIn(!!session);

        if (!session) {
          setAuthorized(false);
          setMessage("Please sign in with your admin account.");
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const { error } = await getSupabaseBrowser().auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      setSignedIn(true);
      await loadDashboard();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to sign in."
      );
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await getSupabaseBrowser().auth.signOut();
    setSignedIn(false);
    setAuthorized(false);
    setMessage("You have signed out.");
  }

  async function uploadBookImage(
    file: File | undefined,
    side: "front" | "back"
  ) {
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("Please choose a JPG, PNG, or WebP image.");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setMessage("Please choose an image smaller than 8 MB.");
      return;
    }

    setUploading(true);
    setMessage("");

    try {
      const supabase = getSupabaseBrowser();
      const safeName = file.name.toLowerCase().replace(/[^a-z0-9.-]+/g, "-");
      const path = `${Date.now()}-${crypto.randomUUID()}-${side}-${safeName}`;

      const { error } = await supabase.storage
        .from("product-covers")
        .upload(path, file, {
          cacheControl: "31536000",
          upsert: false,
          contentType: file.type,
        });

      if (error) throw error;

      const { data } = supabase.storage
        .from("product-covers")
        .getPublicUrl(path);

      const field = side === "front" ? "image_url" : "back_image_url";

      setDraft((current) => ({
        ...current,
        [field]: data.publicUrl,
      }));

      setMessage(
        `${side === "front" ? "Front" : "Back"} cover uploaded. Save the book to apply the image.`
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Image upload failed."
      );
    } finally {
      setUploading(false);
    }
  }

  async function uploadAdditionalImages(files: FileList | null) {
    if (!files || files.length === 0) return;

    const selectedFiles = Array.from(files);

    if (
      selectedFiles.some(
        (file) =>
          !["image/jpeg", "image/png", "image/webp"].includes(file.type)
      )
    ) {
      setMessage("Use JPG, PNG, or WebP images only.");
      return;
    }

    if (selectedFiles.some((file) => file.size > 8 * 1024 * 1024)) {
      setMessage("Each image must be smaller than 8 MB.");
      return;
    }

    setUploading(true);
    setMessage("Uploading additional book images...");

    try {
      const supabase = getSupabaseBrowser();
      const uploadedUrls: string[] = [];

      for (const file of selectedFiles) {
        const safeName = file.name
          .toLowerCase()
          .replace(/[^a-z0-9.-]+/g, "-");
        const path = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;

        const { error } = await supabase.storage
          .from("product-covers")
          .upload(path, file, {
            cacheControl: "31536000",
            upsert: false,
            contentType: file.type,
          });

        if (error) throw error;

        const { data } = supabase.storage
          .from("product-covers")
          .getPublicUrl(path);

        uploadedUrls.push(data.publicUrl);
      }

      setDraft((current) => ({
        ...current,
        gallery_images: [...current.gallery_images, ...uploadedUrls],
      }));

      setMessage(
        `${uploadedUrls.length} additional image(s) uploaded. Save the book to apply them.`
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Additional image upload failed."
      );
    } finally {
      setUploading(false);
    }
  }

  async function saveProduct(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const supabase = getSupabaseBrowser();

    const payload = {
      title: draft.title.trim(),
      category: draft.category,
      price: Number(draft.price),
      description: draft.description,
      amazon_url: draft.amazon_url || null,
      image_url: draft.image_url || null,
      back_image_url: draft.back_image_url || null,
      gallery_images: draft.gallery_images,
      active: draft.active,
      updated_at: new Date().toISOString(),
    };

    try {
      const result = editingId
        ? await supabase
            .from("products")
            .update(payload)
            .eq("id", editingId)
        : await supabase.from("products").insert(payload);

      if (result.error) throw result.error;

      setDraft(emptyProduct);
      setEditingId(null);
      setMessage("Book saved successfully.");
      await loadDashboard();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save book."
      );
    } finally {
      setBusy(false);
    }
  }

  function editOrder(order: Order) {
    setEditingOrderId(order.id);
    setOrderFulfillmentDraft(order.fulfillment_status || "unfulfilled");
    setOrderCarrierDraft(order.shipping_carrier || "");
    setOrderTrackingDraft(order.tracking_number || "");
  }

  async function saveOrderShipping(orderId: number) {
    setBusy(true);
    setMessage("");

    const nextFulfillment = orderFulfillmentDraft;
    const isFulfilled =
      nextFulfillment === "shipped" || nextFulfillment === "delivered";
    const supabase = getSupabaseBrowser();

    try {
      const { error } = await supabase
        .from("orders")
        .update({
          fulfillment_status: nextFulfillment,
          shipping_carrier: orderCarrierDraft.trim() || null,
          tracking_number: orderTrackingDraft.trim() || null,
          fulfilled_at: isFulfilled ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (error) throw error;

      setEditingOrderId(null);
      setMessage(`Shipping details for order #${orderId} were saved.`);
      await loadDashboard();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to update this order."
      );
    } finally {
      setBusy(false);
    }
  }

  function formatShippingAddress(address: Order["shipping_address"]) {
    if (!address) return "Address not provided";
    if (typeof address === "string") return address;

    const preferredKeys = [
      "line1",
      "address_line1",
      "street",
      "line2",
      "address_line2",
      "city",
      "state",
      "province",
      "postal_code",
      "zip",
      "country",
    ];

    const values = preferredKeys
      .map((key) => address[key])
      .filter((value): value is string => typeof value === "string" && !!value.trim())
      .map((value) => value.trim());

    if (values.length) return values.join(", ");

    return (
      Object.values(address)
        .filter((value): value is string => typeof value === "string" && !!value.trim())
        .map((value) => value.trim())
        .join(", ") || "Address not provided"
    );
  }

  async function deleteProduct(product: Product) {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${product.title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    setBusy(true);
    setMessage("");

    try {
      const { error } = await getSupabaseBrowser()
        .from("products")
        .delete()
        .eq("id", product.id);

      if (error) throw error;

      if (editingId === product.id) {
        setEditingId(null);
        setDraft(emptyProduct);
      }

      setMessage(`"${product.title}" was deleted successfully.`);
      await loadDashboard();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to delete book."
      );
    } finally {
      setBusy(false);
    }
  }

  function editProduct(product: Product) {
    setEditingId(product.id);
    setDraft({
      title: product.title,
      category: product.category,
      price: String(product.price),
      description: product.description || "",
      amazon_url: product.amazon_url || "",
      image_url: product.image_url || "",
      back_image_url: product.back_image_url || "",
      gallery_images: product.gallery_images || [],
      active: product.active,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const inputStyle: CSSProperties = {
    width: "100%",
    padding: "11px 12px",
    border: "1px solid #ead8e9",
    borderRadius: 10,
    background: "#fff",
    font: "inherit",
  };

  const buttonStyle: CSSProperties = {
    border: 0,
    borderRadius: 999,
    padding: "11px 18px",
    background: "#d52b91",
    color: "white",
    fontWeight: 750,
    cursor: "pointer",
  };

  const panelStyle: CSSProperties = {
    background: "white",
    borderRadius: 18,
    padding: 22,
    marginBottom: 22,
    boxShadow: "0 8px 28px rgba(75,35,75,.07)",
  };

  const labelStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 14,
    fontWeight: 650,
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#fff7fc",
        color: "#38243c",
        padding: "30px 18px",
      }}
    >
      <div style={{ maxWidth: 1150, margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            marginBottom: 28,
            flexWrap: "wrap",
          }}
        >
          <div>
            <Link
              href="/"
              style={{
                color: "#d52b91",
                fontWeight: 800,
                textDecoration: "none",
              }}
            >
              ← View storefront
            </Link>
            <h1 style={{ fontSize: 34, margin: "10px 0 0" }}>
              LXE Creative Admin
            </h1>
            <p style={{ color: "#755d78", margin: 0 }}>
              Manage books, covers, and customer orders.
            </p>
          </div>

          {signedIn && (
            <button onClick={signOut} style={buttonStyle}>
              Sign out
            </button>
          )}
        </header>

        {message && (
          <p
            role="status"
            style={{
              background: "white",
              borderRadius: 12,
              padding: 14,
              marginBottom: 20,
            }}
          >
            {message}
          </p>
        )}

        {!signedIn && (
          <form onSubmit={signIn} style={panelStyle}>
            <h2>Admin sign in</h2>

            <label style={labelStyle}>
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
              />
            </label>

            <label style={{ ...labelStyle, marginTop: 14 }}>
              Password
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
              />
            </label>

            <button
              disabled={busy}
              style={{ ...buttonStyle, marginTop: 18 }}
            >
              {busy ? "Signing in..." : "Sign in"}
            </button>
          </form>
        )}

        {signedIn && authorized && (
          <>
            <section style={panelStyle}>
              <h2>{editingId ? "Edit book" : "Add a new book"}</h2>

              <form
                onSubmit={saveProduct}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
                  gap: 15,
                }}
              >
                <label style={labelStyle}>
                  Book title
                  <input
                    required
                    value={draft.title}
                    onChange={(e) =>
                      setDraft({ ...draft, title: e.target.value })
                    }
                    style={inputStyle}
                  />
                </label>

                <label style={labelStyle}>
                  Category
                  <select
                    value={draft.category}
                    onChange={(e) =>
                      setDraft({ ...draft, category: e.target.value })
                    }
                    style={inputStyle}
                  >
                    <option value="kids">Kids</option>
                    <option value="adult">Adult & puzzles</option>
                  </select>
                </label>

                <label style={labelStyle}>
                  Price (USD)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={draft.price}
                    onChange={(e) =>
                      setDraft({ ...draft, price: e.target.value })
                    }
                    style={inputStyle}
                  />
                </label>

                <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
                  Description
                  <textarea
                    value={draft.description}
                    onChange={(e) =>
                      setDraft({ ...draft, description: e.target.value })
                    }
                    style={{ ...inputStyle, minHeight: 90 }}
                  />
                </label>

                <label style={labelStyle}>
                  Upload FRONT cover
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={uploading}
                    onChange={(e) =>
                      uploadBookImage(e.target.files?.[0], "front")
                    }
                    style={inputStyle}
                  />
                  {draft.image_url && (
                    <Image
                      src={draft.image_url}
                      alt="Front cover preview"
                      width={130}
                      height={170}
                      unoptimized
                      style={{
                        width: 130,
                        height: 170,
                        objectFit: "contain",
                        borderRadius: 8,
                        background: "#fff7fc",
                      }}
                    />
                  )}
                </label>

                <label style={labelStyle}>
                  Upload BACK cover
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={uploading}
                    onChange={(e) =>
                      uploadBookImage(e.target.files?.[0], "back")
                    }
                    style={inputStyle}
                  />
                  {draft.back_image_url && (
                    <Image
                      src={draft.back_image_url}
                      alt="Back cover preview"
                      width={130}
                      height={170}
                      unoptimized
                      style={{
                        width: 130,
                        height: 170,
                        objectFit: "contain",
                        borderRadius: 8,
                        background: "#fff7fc",
                      }}
                    />
                  )}
                </label>

                <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
                  Additional Book Images
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    disabled={uploading}
                    onChange={(e) => {
                      uploadAdditionalImages(e.target.files);
                      e.target.value = "";
                    }}
                    style={inputStyle}
                  />
                  <span style={{ fontSize: 12, color: "#755d78" }}>
                    Select multiple interior pages, sample illustrations,
                    and other book images. Maximum 8 MB per image.
                  </span>
                </label>

                {draft.gallery_images.length > 0 && (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))",
                      gap: 12,
                    }}
                  >
                    {draft.gallery_images.map((url, index) => (
                      <div key={`${url}-${index}`}>
                        <Image
                          src={url}
                          alt={`Additional book image ${index + 1}`}
                          width={110}
                          height={140}
                          unoptimized
                          style={{
                            width: "100%",
                            height: 140,
                            objectFit: "contain",
                            background: "#fff7fc",
                            borderRadius: 8,
                          }}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((current) => ({
                              ...current,
                              gallery_images: current.gallery_images.filter(
                                (_, i) => i !== index
                              ),
                            }))
                          }
                          style={{
                            ...buttonStyle,
                            background: "#806b82",
                            padding: "6px 10px",
                            marginTop: 5,
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <label style={labelStyle}>
                  Front cover image URL
                  <input
                    value={draft.image_url}
                    onChange={(e) =>
                      setDraft({ ...draft, image_url: e.target.value })
                    }
                    placeholder="https://..."
                    style={inputStyle}
                  />
                </label>

                <label style={labelStyle}>
                  Back cover image URL
                  <input
                    value={draft.back_image_url}
                    onChange={(e) =>
                      setDraft({ ...draft, back_image_url: e.target.value })
                    }
                    placeholder="https://..."
                    style={inputStyle}
                  />
                </label>

                <label style={labelStyle}>
                  Amazon product URL
                  <input
                    value={draft.amazon_url}
                    onChange={(e) =>
                      setDraft({ ...draft, amazon_url: e.target.value })
                    }
                    placeholder="https://www.amazon.com/dp/..."
                    style={inputStyle}
                  />
                </label>

                <label
                  style={{
                    ...labelStyle,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={draft.active}
                    onChange={(e) =>
                      setDraft({ ...draft, active: e.target.checked })
                    }
                  />
                  Visible in storefront
                </label>

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "end",
                    flexWrap: "wrap",
                  }}
                >
                  <button disabled={busy || uploading} style={buttonStyle}>
                    {busy
                      ? "Saving..."
                      : editingId
                        ? "Save changes"
                        : "Add book"}
                  </button>

                  {editingId !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setDraft(emptyProduct);
                      }}
                      style={{
                        ...buttonStyle,
                        background: "#806b82",
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </section>

            <section style={panelStyle}>
              <h2>Books ({products.length})</h2>

              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th>Book</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Visibility</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id}>
                        <td>
                          <strong>{product.title}</strong>
                          {product.image_url && (
                            <div>
                              <Image
                                src={product.image_url}
                                alt={product.title}
                                width={48}
                                height={62}
                                unoptimized
                                style={{
                                  width: 48,
                                  height: 62,
                                  objectFit: "cover",
                                  borderRadius: 6,
                                  marginTop: 6,
                                }}
                              />
                            </div>
                          )}
                        </td>
                        <td>{product.category}</td>
                        <td>${Number(product.price).toFixed(2)}</td>
                        <td>{product.active ? "Published" : "Hidden"}</td>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => editProduct(product)}
                              style={{
                                ...buttonStyle,
                                padding: "7px 12px",
                              }}
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => deleteProduct(product)}
                              style={{
                                ...buttonStyle,
                                background: "#b42318",
                                padding: "7px 12px",
                                opacity: busy ? 0.6 : 1,
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section style={panelStyle}>
              <h2>Order management ({orders.length})</h2>

              <p style={{ color: "#755d78", marginTop: 0 }}>
                Review customer and payment details, then update shipping and tracking.
                Payment status should only be changed by verified Stripe events.
              </p>

              {orders.length === 0 ? (
                <p>
                  No orders yet. New orders will appear here after checkout creates
                  them.
                </p>
              ) : (
                <div style={{ display: "grid", gap: 16 }}>
                  {orders.map((order) => (
                    <article
                      key={order.id}
                      style={{
                        border: "1px solid #ead8e9",
                        borderRadius: 14,
                        padding: 16,
                        background: "#fff",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <strong>Order #{order.id}</strong>
                          <div style={{ fontSize: 12, color: "#806b82" }}>
                            Placed {new Date(order.created_at).toLocaleString()}
                          </div>
                        </div>

                        <strong>
                          {new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: (order.currency || "usd").toUpperCase(),
                          }).format(Number(order.amount_total || 0) / 100)}
                        </strong>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit,minmax(210px,1fr))",
                          gap: 12,
                          marginTop: 14,
                        }}
                      >
                        <div>
                          <strong>Customer</strong>
                          <div>
                            {order.customer_name ||
                              order.shipping_name ||
                              "Name not provided"}
                          </div>
                          <div>{order.customer_email || "Email not provided"}</div>
                          <div>{order.phone || "Phone not provided"}</div>
                        </div>

                        <div>
                          <strong>Ship to</strong>
                          <div>
                            {order.shipping_name ||
                              order.customer_name ||
                              "Recipient not provided"}
                          </div>
                          <div>
                            {formatShippingAddress(order.shipping_address)}
                          </div>
                        </div>

                        <div>
                          <strong>Payment</strong>
                          <div>Status: {order.status || "Unknown"}</div>
                          <div>
                            Paid:{" "}
                            {order.paid_at
                              ? new Date(order.paid_at).toLocaleString()
                              : "Not recorded"}
                          </div>
                        </div>

                        <div>
                          <strong>Items</strong>
                          <div>
                            {(order.items || [])
                              .map(
                                (item) =>
                                  `${item.title || "Book"} × ${item.quantity || 1}`
                              )
                              .join(", ") || "No item details recorded"}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          marginTop: 14,
                          paddingTop: 12,
                          borderTop: "1px solid #f0e5ef",
                        }}
                      >
                        <div style={{ marginBottom: 10 }}>
                          <strong>Shipping</strong>
                          <div>
                            {order.fulfillment_status || "unfulfilled"}
                            {order.shipping_carrier
                              ? ` · ${order.shipping_carrier}`
                              : ""}
                            {order.tracking_number
                              ? ` · Tracking: ${order.tracking_number}`
                              : ""}
                          </div>
                          {order.fulfilled_at && (
                            <div style={{ fontSize: 12, color: "#806b82" }}>
                              Fulfilled{" "}
                              {new Date(order.fulfilled_at).toLocaleString()}
                            </div>
                          )}
                        </div>

                        {editingOrderId === order.id ? (
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "repeat(auto-fit,minmax(180px,1fr))",
                              gap: 10,
                              alignItems: "end",
                            }}
                          >
                            <label style={labelStyle}>
                              Fulfillment status
                              <select
                                value={orderFulfillmentDraft}
                                onChange={(e) =>
                                  setOrderFulfillmentDraft(e.target.value)
                                }
                                style={inputStyle}
                              >
                                <option value="unfulfilled">Unfulfilled</option>
                                <option value="processing">Processing</option>
                                <option value="shipped">Shipped</option>
                                <option value="delivered">Delivered</option>
                              </select>
                            </label>

                            <label style={labelStyle}>
                              Shipping carrier
                              <input
                                value={orderCarrierDraft}
                                onChange={(e) =>
                                  setOrderCarrierDraft(e.target.value)
                                }
                                placeholder="USPS, UPS, FedEx..."
                                style={inputStyle}
                              />
                            </label>

                            <label style={labelStyle}>
                              Tracking number
                              <input
                                value={orderTrackingDraft}
                                onChange={(e) =>
                                  setOrderTrackingDraft(e.target.value)
                                }
                                placeholder="Enter tracking number"
                                style={inputStyle}
                              />
                            </label>

                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                flexWrap: "wrap",
                              }}
                            >
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => saveOrderShipping(order.id)}
                                style={buttonStyle}
                              >
                                {busy ? "Saving..." : "Save shipping"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingOrderId(null)}
                                style={{
                                  ...buttonStyle,
                                  background: "#806b82",
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => editOrder(order)}
                            style={{
                              ...buttonStyle,
                              padding: "8px 14px",
                            }}
                          >
                            Update shipping
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  textAlign: "left",
  fontSize: 14,
};
