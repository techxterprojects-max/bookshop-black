 "use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type Product = {
  id: number;
  title: string;
  category: string;
  price: number;
  description: string;
  amazonUrl: string;
  image_url: string | null;
  back_image_url: string | null;
  gallery_images: string[] | null;
  active: boolean;
};
type CartItem = { productId: number; quantity: number };
type Page = "home" | "shop" | "about" | "reviews" | "faq" | "contact";

const amazonProductLinks = [
  { title: "A-Z Feelings", url: "https://www.amazon.com/dp/B0H3C2PW1H" },
  { title: "A-Z Manners", url: "https://www.amazon.com/dp/B0H6ZY1HWB" },
  { title: "A-Z Community", url: "https://www.amazon.com/dp/B0H7M9RHV5" },
  { title: "Can I Leave Early?", url: "https://www.amazon.com/dp/B0HB2Z9L1C" },
  { title: "Unavailable by Choice", url: "https://www.amazon.com/dp/B0HQ6NQPFZ" },
  { title: "A-Z Bible Characters", url: "https://www.amazon.com/dp/B0HNR6JF7T" },
  { title: "1,2,3... SWEETS!", url: "https://www.amazon.com/dp/B0H9GWNQVC" },
  { title: "Spot-tastic Adventures", url: "https://www.amazon.com/dp/B0GY9W3W64" },
] as const;

function getAmazonProductUrl(title: string, savedUrl: string | null) {
  const savedUrlIsGeneric =
    !savedUrl || /^https?:\/\/(www\.)?amazon\.com\/?$/i.test(savedUrl.trim());
  if (!savedUrlIsGeneric) return savedUrl;

  const normalizedTitle = title.toLowerCase();
  return (
    amazonProductLinks.find(({ title: match }) =>
      normalizedTitle.startsWith(match.toLowerCase())
    )?.url || savedUrl || "https://amazon.com"
  );
}

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

function ProductCard({ product, onAdd, onDetails }: {
  product: Product; onAdd: (id: number) => void; onDetails: (product: Product) => void;
}) {
  return <article className="product-card">
    <button className={`product-cover ${product.category === "adult" ? "adult-cover" : ""}`} onClick={() => onDetails(product)} aria-label={`View ${product.title}`}>
      {product.image_url ? (
        <Image
          src={product.image_url}
          alt={`${product.title} front cover`}
          fill
          unoptimized
          style={{ objectFit: "contain", display: "block" }}
        />
      ) : (
        <>
          <span className="cover-kicker">LXE Creative</span>
          <strong className="cover-title">
            {product.title.split(":")[0]}
          </strong>
          <span className="cover-brand">Color • Learn • Create</span>
        </>
      )}
    </button>
    <div className="product-info">
      <div className="product-category">{product.category === "kids" ? "Kids (Ages 3-8)" : "Adult & Puzzles"}</div>
      <h3 className="product-title" onClick={() => onDetails(product)}>{product.title}</h3>
      <p className="product-description">{product.description}</p>
      <div className="product-footer">
        <span className="product-price">{money(product.price)}</span>
        <div className="card-actions">
          <button className="btn-icon" onClick={() => onAdd(product.id)} title="Add to Bag" aria-label="Add to bag"><i className="fa-solid fa-bag-shopping" /></button>
          <a className="btn-icon btn-amazon" href={product.amazonUrl} target="_blank" rel="noreferrer" title="Buy on Amazon" aria-label="Buy on Amazon"><i className="fa-brands fa-amazon" /></a>
        </div>
      </div>
    </div>
  </article>;
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [page, setPage] = useState<Page>("home");
  const [filter, setFilter] = useState<"all" | "kids" | "adult">("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [generalStatus, setGeneralStatus] = useState("");
  const [wholesaleStatus, setWholesaleStatus] = useState("");

  useEffect(() => {
    async function loadProducts() {
      try {
        const { data, error } = await getSupabaseBrowser()
          .from("products")
          .select("*")
          .eq("active", true)
          .order("id", { ascending: true });

        if (error) throw error;

        const formattedProducts: Product[] = (data || []).map((product) => ({
          id: product.id,
          title: product.title,
          category: product.category,
          price: Number(product.price),
          description: product.description || "",
          amazonUrl: getAmazonProductUrl(product.title, product.amazon_url),
          image_url: product.image_url,
          back_image_url: product.back_image_url,
          gallery_images: product.gallery_images || [],
          active: product.active,
        }));

        setProducts(formattedProducts);
      } catch (error) {
        console.error("Unable to load books:", error);
        setProductsError("Books could not be loaded. Please try again later.");
      } finally {
        setProductsLoading(false);
      }
    }

    loadProducts();
  }, []);

  useEffect(() => {
    // Restore the saved cart after hydration to avoid a server/client markup mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { const saved = localStorage.getItem("lxe-cart"); if (saved) setCart(JSON.parse(saved)); } catch {}
  }, []);
  useEffect(() => { localStorage.setItem("lxe-cart", JSON.stringify(cart)); }, [cart]);

  const cartCount = cart.reduce((sum, item) => (
    products.some((product) => product.id === item.productId)
      ? sum + item.quantity
      : sum
  ), 0);
  const subtotal = cart.reduce((sum, item) => {
    const product = products.find(p => p.id === item.productId);
    return sum + (product?.price ?? 0) * item.quantity;
  }, 0);
  const visibleProducts = useMemo(() => products.filter(p => filter === "all" || p.category === filter), [filter, products]);

  function navigate(next: Page) {
    setPage(next); setMobileMenu(false); setSelected(null); setCartOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function addToCart(id: number) {
    setCart(current => current.some(item => item.productId === id)
      ? current.map(item => item.productId === id ? { ...item, quantity: item.quantity + 1 } : item)
      : [...current, { productId: id, quantity: 1 }]);
    setSelected(null); setCartOpen(true);
  }
  function changeQuantity(id: number, delta: number) {
    setCart(current => current.map(item => item.productId === id ? { ...item, quantity: item.quantity + delta } : item).filter(item => item.quantity > 0));
  }

  async function checkout() {
    if (!cart.length) return;
    const response = await fetch("/api/checkout", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: cart }),
    });
    const data = await response.json();
    if (!response.ok) { alert(data.error || "Checkout is not configured yet. Add your Stripe environment keys."); return; }
    if (data.url) window.location.href = data.url;
  }

  async function submitForm(event: FormEvent<HTMLFormElement>, kind: "general" | "wholesale") {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = Object.fromEntries(new FormData(form).entries());
    const response = await fetch("/api/inquiries", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ...formData }),
    });
    const data = await response.json();
    if (response.ok) {
      form.reset();
      if (kind === "general") {
        setGeneralStatus("Thank you! Your message has been received.");
      } else {
        setWholesaleStatus("Thank you! Your wholesale inquiry has been received.");
      }
    } else {
      const message = data.error || "The form could not be submitted. Please try again.";
      if (kind === "general") {
        setGeneralStatus(message);
      } else {
        setWholesaleStatus(message);
      }
    }
  }

  const navItems: { id: Page; label: string }[] = [
    { id: "home", label: "Home" }, { id: "shop", label: "Shop" }, { id: "about", label: "About" },
    { id: "reviews", label: "Reviews" }, { id: "faq", label: "FAQ" }, { id: "contact", label: "Contact & Wholesale" },
  ];

  return <>
    <div className="announcement-bar">🌈 ✨ FREE shipping on US orders over $35! Shop all 8 magical coloring books below! 💖</div>
    <header>
      <div className="nav-container">
        <button className="logo logo-home" onClick={() => navigate("home")} aria-label="LXE Creative home">
          <Image
            src="/LXE Creative Crown Logo.png"
            alt="LXE Creative by Angelica White"
            width={180}
            height={120}
            unoptimized
            priority
            className="header-logo"
          />
        </button>
        <button className="mobile-menu-button" aria-label="Toggle navigation" onClick={() => setMobileMenu(!mobileMenu)}>☰</button>
        <nav className={`nav-links ${mobileMenu ? "mobile-open" : ""}`}>
          {navItems.map(item => <button key={item.id} className={page === item.id ? "active" : ""} onClick={() => navigate(item.id)}>{item.label}</button>)}
        </nav>
        <div className="nav-actions">
          <button className="cart-btn" aria-label="Open shopping bag" onClick={() => setCartOpen(true)}>
            <i className="fa-solid fa-bag-shopping" /> <span className="cart-badge">{cartCount}</span>
          </button>
        </div>
      </div>
    </header>

    <main className="page-shell">
      {page === "home" && <>
        <section className="hero">
          <div className="hero-content"><h1>Spark Joy &amp; Creativity in <span>Every Page!</span></h1>
            <p>Welcome to LXE Creative by Angelica White! Discover vibrant, playful coloring books designed for kids&apos; early learning and cozy adult relaxation.</p>
            <button className="btn-rainbow" onClick={() => navigate("shop")}>Shop Coloring Books <i className="fa-solid fa-sparkles" /></button>
          </div>
          <div className="hero-banner-art"><i className="fa-solid fa-book-open" /><h3>8 Published Books</h3><p>Buy Directly Here or on Amazon!</p></div>
        </section>
        <div className="section-header"><h2>Featured Magic Books</h2><button className="btn-rainbow small" onClick={() => navigate("shop")}>View All Books</button></div>
        {productsError ? <p role="status">{productsError}</p> : productsLoading ? <p role="status">Loading books...</p> : products.length ? <div className="products-grid">{products.slice(0, 4).map(p => <ProductCard key={p.id} product={p} onAdd={addToCart} onDetails={setSelected} />)}</div> : <p>No books are currently available.</p>}
      </>}

      {page === "shop" && <>
        <div className="section-header">
          <h2>Magic Book Collection</h2>
          <div className="filter-buttons">
            {(["all", "kids", "adult"] as const).map(value => <button key={value} className={`filter-btn ${filter === value ? "active" : ""}`} onClick={() => setFilter(value)}>{value === "all" ? "All Books" : value === "kids" ? "Kids (Ages 3-8)" : "Adult & Puzzles"}</button>)}
          </div>
        </div>
        {productsError ? <p role="status">{productsError}</p> : productsLoading ? <p role="status">Loading books...</p> : visibleProducts.length ? <div className="products-grid">{visibleProducts.map(p => <ProductCard key={p.id} product={p} onAdd={addToCart} onDetails={setSelected} />)}</div> : <p>No books match this filter.</p>}
      </>}

      {page === "about" && <section className="about-section">
        <div className="about-text"><h2>Created with Love &amp; Fun!</h2>
          <p>LXE Creative was founded by Angelica White to bring vibrant educational tools and joyful coloring experiences to families and creative souls everywhere.</p>
          <p>From social-emotional kids&apos; books like <em>A-Z Feelings</em> to relaxing adult puzzle escapes like <em>Unavailable by Choice</em>, every book is packed with charm, educational value, and imagination.</p>
          <button className="btn-rainbow" onClick={() => navigate("shop")}>Shop All Titles</button>
        </div>
        <div className="about-image"><i className="fa-solid fa-crown" /><h3>Angelica White</h3><p>Author &amp; Creator</p></div>
      </section>}

      {page === "reviews" && <><div className="section-header"><h2>Loved by Readers &amp; Educators!</h2></div>
        <div className="reviews-grid">
          <div className="review-card"><div className="review-stars">★★★★★</div><p className="review-text">&quot;A-Z Feelings has been an incredible tool in our homeschool routine. My 5-year-old daughter loves coloring the pages while we talk about emotions.&quot;</p><div className="review-author">— Sarah M., Parent</div></div>
          <div className="review-card"><div className="review-stars">★★★★★</div><p className="review-text">&quot;Unavailable by Choice is my absolute favorite evening unwind ritual. The designs are cozy, intricate, and truly help quiet the mind after work.&quot;</p><div className="review-author">— Jessica L., Verified Buyer</div></div>
          <div className="review-card"><div className="review-stars">★★★★★</div><p className="review-text">&quot;Spot-tastic Adventures is a huge hit in our house! High-quality pages and delightful dalmatian artwork that keeps the kids entertained for hours.&quot;</p><div className="review-author">— David K., Educator</div></div>
        </div>
      </>}

      {page === "faq" && <section className="faq-container">
        <div className="section-header"><h2>Frequently Asked Questions</h2></div>
        {[
          ["What age group are the children's books designed for?", "Our educational children's books (such as the A-Z series) are specifically designed for children ages 3 to 8, featuring bold outlines, engaging characters, and developmental learning prompts."],
          ["Can I purchase these books on Amazon as well?", "Yes! All 8 coloring books are available for purchase directly here on our website or through Amazon via the “Buy on Amazon” button on each book. Add the correct Amazon product links before launch."],
          ["What are your shipping and fulfillment times?", "Direct website orders are packaged with care and shipped within 1–3 business days. You will receive an automated tracking notification as soon as your order leaves our studio. Confirm these fulfillment details before launch."]
        ].map(([q,a]) => <details className="faq-item" key={q}><summary className="faq-question">{q}</summary><div className="faq-answer">{a}</div></details>)}
      </section>}

      {page === "contact" && <div className="contact-grid">
        <section className="contact-box"><h2>General Inquiries</h2><p>Have questions about your order, shipping, or our books? Send us a message and we&apos;ll get back to you shortly.</p>
          <form className="contact-form" onSubmit={e => submitForm(e, "general")}>
            <div className="form-group"><input name="name" placeholder="Your Name" required /></div>
            <div className="form-group"><input name="email" type="email" placeholder="Your Email Address" required /></div>
            <div className="form-group"><textarea name="message" placeholder="How can we help you?" required /></div>
            <button className="btn-submit" type="submit">Send Message</button><p className="form-status">{generalStatus}</p>
          </form>
        </section>
        <section className="contact-box"><h2>Wholesale Inquiries</h2><p>Interested in stocking LXE Creative books at your boutique, bookstore, or school? Fill out our wholesale application below.</p>
          <form className="contact-form" onSubmit={e => submitForm(e, "wholesale")}>
            <div className="form-group"><input name="businessName" placeholder="Business / Store Name" required /></div>
            <div className="form-group"><input name="contactName" placeholder="Contact Person Name" required /></div>
            <div className="form-group"><input name="email" type="email" placeholder="Business Email Address" required /></div>
            <div className="form-group"><select name="quantity" required defaultValue=""><option value="" disabled>Estimated Order Quantity</option><option value="25-50">25 – 50 copies</option><option value="50-100">50 – 100 copies</option><option value="100+">100+ copies</option></select></div>
            <div className="form-group"><textarea name="message" placeholder="Tell us about your store or organization..." required /></div>
            <button className="btn-submit" type="submit">Submit Wholesale Application</button><p className="form-status">{wholesaleStatus}</p>
          </form>
        </section>
      </div>}
    </main>

    <footer><div className="footer-container">
      <button className="logo logo-home" onClick={() => navigate("home")} aria-label="LXE Creative home">
        <Image
          src="/LXE Creative Crown Logo.png"
          alt="LXE Creative by Angelica White"
          width={180}
          height={120}
          unoptimized
          className="header-logo"
        />
      </button>
      <div className="footer-links">
        {navItems.map(item => <button key={item.id} onClick={() => navigate(item.id)}>{item.label}</button>)}
        <Link className="admin-login-link" href="/admin">Admin Login</Link>
      </div>
      <div className="copyright">© 2026 LXE Creative by Angelica White. All rights reserved.</div>
    </div></footer>

    <div className={`overlay ${cartOpen || selected ? "open" : ""}`} onClick={() => {setCartOpen(false); setSelected(null);}} />
    <aside className={`cart-drawer ${cartOpen ? "open" : ""}`} aria-label="Shopping bag">
      <div className="cart-header"><h3>Your Shopping Bag</h3><button className="cart-close" onClick={() => setCartOpen(false)} aria-label="Close cart"><i className="fa-solid fa-xmark" /></button></div>
      <div className="cart-body">
        {!cart.length ? <div className="cart-empty">Your shopping bag is empty.</div> : cart.map(item => {
          const p = products.find(product => product.id === item.productId);
          if (!p) return null;
          return <div className="cart-row" key={p.id}><div><strong>{p.title}</strong><p>{money(p.price)} each</p><div className="quantity-controls"><button onClick={() => changeQuantity(p.id, -1)} aria-label="Decrease quantity">−</button><span>{item.quantity}</span><button onClick={() => changeQuantity(p.id, 1)} aria-label="Increase quantity">+</button></div></div><button onClick={() => setCart(current => current.filter(i => i.productId !== p.id))}>Remove</button></div>;
        })}
      </div>
      <div className="cart-footer"><div className="cart-total"><span>Subtotal:</span><span>{money(subtotal)}</span></div><button className="btn-checkout" disabled={!cart.length} onClick={checkout}>Proceed to Checkout</button><p className="cart-note">Shipping and taxes calculated at checkout.</p></div>
    </aside>

    {selected && <div className="modal open" role="dialog" aria-modal="true">
      <button className="modal-close" onClick={() => setSelected(null)} aria-label="Close details"><i className="fa-solid fa-xmark" /></button>
      <div className="modal-content">
        <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
          {selected.image_url && (
            <Image
              src={selected.image_url}
              alt={`${selected.title} front cover`}
              width={220}
              height={290}
              unoptimized
              style={{ width: "min(42%, 220px)", height: 290, objectFit: "contain", borderRadius: 10 }}
            />
          )}
          {selected.back_image_url && (
            <Image
              src={selected.back_image_url}
              alt={`${selected.title} back cover`}
              width={220}
              height={290}
              unoptimized
              style={{ width: "min(42%, 220px)", height: 290, objectFit: "contain", borderRadius: 10 }}
            />
          )}
          {(selected.gallery_images || []).map((url, index) => (
            <Image
              key={`${url}-${index}`}
              src={url}
              alt={`${selected.title} additional preview ${index + 1}`}
              width={220}
              height={290}
              unoptimized
              style={{ width: "min(42%, 220px)", height: 290, objectFit: "contain", borderRadius: 10 }}
            />
          ))}
          {!selected.image_url &&
            !selected.back_image_url &&
            !selected.gallery_images?.length && (
            <div className={`product-cover ${selected.category === "adult" ? "adult-cover" : ""}`}>
              <span className="cover-kicker">LXE Creative</span>
              <strong className="cover-title">{selected.title}</strong>
              <span className="cover-brand">Angelica White</span>
            </div>
          )}
        </div>
        <h2>{selected.title}</h2><p>{selected.description}</p><h3>{money(selected.price)}</h3><button className="btn-rainbow" onClick={() => addToCart(selected.id)}>Add to Website Cart</button><a className="btn-amazon-modal" href={selected.amazonUrl} target="_blank" rel="noreferrer"><i className="fa-brands fa-amazon" /> Buy on Amazon</a></div>
    </div>}
  </>;
}
