/* ═══════════════════════════════════════════════════════════════════════
   HeadyStore — app.js
   Reverse Marketplace • Patent #25 & #26
   Real AI-powered product search + Stripe checkout
   NO fake data. NO stock photos. NO wrong vendors.
   ═══════════════════════════════════════════════════════════════════════ */

const PHI = 1.618033988749895;
const API_BASE = "https://headyapi.com";

// ─── Stripe Init ───────────────────────────────────────────────────
let stripeInstance = null;
try {
    if (window.STRIPE_PK && window.Stripe) {
        stripeInstance = Stripe(window.STRIPE_PK);
    }
} catch (e) { console.warn('Stripe.js not available:', e.message); }

// ═══════════════════════════════════════════════════════════════════
// VENDOR REGISTRY — only map vendors to what they ACTUALLY sell
// ═══════════════════════════════════════════════════════════════════
const VENDORS = {
    amazon: {
        name: 'Amazon', icon: '🛒', categories: ['*'],
        url: (q) => `https://www.amazon.com/s?k=${enc(q)}`
    },
    bestbuy: {
        name: 'Best Buy', icon: '🏪', categories: ['electronics', 'audio', 'monitors', 'smart-home', 'gaming', 'phones', 'cameras', 'watches', 'computers', 'keyboards', 'tablets'],
        url: (q) => `https://www.bestbuy.com/site/searchpage.jsp?st=${enc(q)}`
    },
    bhphoto: {
        name: 'B&H Photo', icon: '📷', categories: ['electronics', 'cameras', 'audio', 'monitors', 'computers'],
        url: (q) => `https://www.bhphotovideo.com/c/search?Ntt=${enc(q)}`
    },
    newegg: {
        name: 'Newegg', icon: '💻', categories: ['electronics', 'computers', 'monitors', 'gaming', 'keyboards'],
        url: (q) => `https://www.newegg.com/p/pl?d=${enc(q)}`
    },
    nike: {
        name: 'Nike', icon: '👟', categories: ['shoes', 'athletic', 'clothing', 'sportswear'],
        url: (q) => `https://www.nike.com/w?q=${enc(q)}`
    },
    zappos: {
        name: 'Zappos', icon: '👠', categories: ['shoes', 'clothing', 'bags'],
        url: (q) => `https://www.zappos.com/search?term=${enc(q)}`
    },
    footlocker: {
        name: 'Foot Locker', icon: '🏃', categories: ['shoes', 'athletic', 'sportswear'],
        url: (q) => `https://www.footlocker.com/search?query=${enc(q)}`
    },
    stockx: {
        name: 'StockX', icon: '📈', categories: ['shoes', 'sneakers', 'streetwear', 'watches'],
        url: (q) => `https://stockx.com/search?s=${enc(q)}`
    },
    nordstrom: {
        name: 'Nordstrom', icon: '👗', categories: ['shoes', 'clothing', 'bags', 'watches', 'fashion'],
        url: (q) => `https://www.nordstrom.com/sr?keyword=${enc(q)}`
    },
    wayfair: {
        name: 'Wayfair', icon: '🏠', categories: ['furniture', 'home', 'lighting'],
        url: (q) => `https://www.wayfair.com/keyword.php?keyword=${enc(q)}`
    },
    ikea: {
        name: 'IKEA', icon: '🪑', categories: ['furniture', 'home', 'lighting'],
        url: (q) => `https://www.ikea.com/us/en/search/?q=${enc(q)}`
    },
    rei: {
        name: 'REI', icon: '⛰️', categories: ['outdoor', 'shoes', 'bags', 'athletic', 'camping'],
        url: (q) => `https://www.rei.com/search?q=${enc(q)}`
    },
    gamestop: {
        name: 'GameStop', icon: '🎮', categories: ['gaming', 'consoles'],
        url: (q) => `https://www.gamestop.com/search/?q=${enc(q)}`
    },
    bookshop: {
        name: 'Bookshop.org', icon: '📚', categories: ['books'],
        url: (q) => `https://bookshop.org/search?keywords=${enc(q)}`
    },
};

function enc(s) { return encodeURIComponent(s); }

// ═══════════════════════════════════════════════════════════════════
// CATEGORY DETECTION — map natural language to product categories
// ═══════════════════════════════════════════════════════════════════
const CATEGORY_KEYWORDS = {
    shoes: ['shoe', 'sneaker', 'boot', 'running', 'jordan', 'nike', 'adidas', 'slipper', 'sandal', 'heel', 'loafer'],
    audio: ['headphone', 'earphone', 'earbud', 'speaker', 'audio', 'noise cancel', 'soundbar', 'bluetooth speaker'],
    electronics: ['laptop', 'tablet', 'computer', 'charger', 'cable', 'usb', 'adapter', 'power bank', 'ssd', 'hard drive'],
    keyboards: ['keyboard', 'keycap', 'mechanic', 'typing', 'switch'],
    monitors: ['monitor', 'display', 'screen', '4k', 'ultrawide'],
    'smart-home': ['smart home', 'homekit', 'thermostat', 'alexa', 'echo', 'nest', 'ring', 'smart plug', 'smart bulb'],
    gaming: ['game', 'gaming', 'console', 'controller', 'playstation', 'xbox', 'steam deck'],
    phones: ['phone', 'iphone', 'samsung galaxy', 'pixel', 'smartphone', 'cell'],
    cameras: ['camera', 'lens', 'tripod', 'photo', 'dslr', 'mirrorless', 'gopro'],
    watches: ['watch', 'smartwatch', 'fitness tracker', 'garmin', 'apple watch', 'fitbit'],
    furniture: ['chair', 'desk', 'stand', 'ergonomic', 'couch', 'sofa', 'table', 'shelf', 'bookcase'],
    bags: ['bag', 'backpack', 'tote', 'briefcase', 'laptop bag', 'messenger', 'duffel', 'suitcase'],
    clothing: ['shirt', 'pants', 'jacket', 'coat', 'hoodie', 'dress', 'jeans', 'shorts', 'sweater'],
    books: ['book', 'novel', 'textbook', 'kindle', 'ebook', 'paperback', 'hardcover'],
    outdoor: ['camping', 'tent', 'hiking', 'climbing', 'outdoor', 'kayak', 'fishing'],
};

function detectCategories(query) {
    const q = query.toLowerCase();
    const matched = [];
    for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
        if (kws.some(k => q.includes(k))) matched.push(cat);
    }
    return matched.length > 0 ? matched : ['general'];
}

function getVendorsForCategories(categories) {
    const result = [];
    for (const v of Object.values(VENDORS)) {
        if (v.categories.includes('*')) { result.push(v); continue; }
        if (categories.some(c => v.categories.includes(c))) result.push(v);
    }
    // Sort: category-specific vendors first, Amazon (general) last
    return result.sort((a, b) => {
        const ag = a.categories.includes('*') ? 1 : 0;
        const bg = b.categories.includes('*') ? 1 : 0;
        return ag - bg;
    }).slice(0, 6);
}

// ─── Shopping System Prompt ────────────────────────────────────────
const SHOPPING_SYSTEM_PROMPT = `You are HeadyStore AI — a Reverse Marketplace shopping assistant.
The user will describe what they want to buy and a budget.
Your job is to search the internet and return REAL product recommendations.

IMPORTANT RULES:
1. Return ONLY real products that actually exist and can be purchased online
2. Include real prices in USD
3. Include real vendor/store names — ONLY vendors that actually sell the product category
4. Include a real purchase URL for each product
5. Include the actual product image URL from the vendor page
6. Return 4-8 products, sorted by relevance to the query
7. Include a "match" score (0-100) for how well each product fits the query
8. Stay within the stated budget

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "products": [
    {
      "name": "Exact Real Product Name",
      "vendor": "Real Store Name",
      "price": 99.99,
      "url": "https://real-store.com/real-product-page",
      "image_url": "https://real-product-image.jpg",
      "match": 95,
      "description": "Brief 1-line description",
      "category": "emoji for this category"
    }
  ],
  "summary": "Brief 1-line summary of what was found"
}`;

// ─── Real AI Product Search ────────────────────────────────────────
async function searchProducts(query, budget, style) {
    const userMessage = `Find real products to buy: "${query}". Budget: $${budget}. Style preference: ${style}. Return JSON only.`;

    // Try HeadyAPI first
    try {
        const response = await fetch(`${API_BASE}/api/v1/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "heady-flash",
                messages: [
                    { role: "system", content: SHOPPING_SYSTEM_PROMPT },
                    { role: "user", content: userMessage }
                ],
                temperature: 0.3,
                response_format: { type: "json_object" },
            }),
        });

        if (response.ok) {
            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || data.response;
            const parsed = JSON.parse(content);
            if (parsed.products?.length > 0) return parsed;
        }
    } catch (err) {
        console.warn("HeadyAPI search failed:", err.message);
    }

    // Try backend store search (Perplexity-powered)
    try {
        const response = await fetch(`${API_BASE}/api/store/search`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query, budget, style }),
        });
        if (response.ok) {
            const result = await response.json();
            if (result.products?.length > 0) return result;
        }
    } catch (err) {
        console.warn("Store search endpoint also failed:", err.message);
    }

    // Honest fallback: category-intelligent vendor search links
    // These are NOT fake products. They are clearly labeled search links.
    return generateVendorSearchLinks(query, budget);
}

// ═══════════════════════════════════════════════════════════════════
// HONEST FALLBACK — vendor search links, NOT fake products
// No fake prices. No stock photos. No wrong vendors.
// ═══════════════════════════════════════════════════════════════════
function generateVendorSearchLinks(query, budget) {
    const categories = detectCategories(query);
    const vendors = getVendorsForCategories(categories);

    const products = vendors.map((v, i) => ({
        name: `Search ${v.name} →`,
        vendor: v.name,
        price: 0,
        url: v.url(query),
        image_url: '',  // No fake images
        match: 90 - (i * 3),
        description: `Browse real ${categories[0]} results on ${v.name}`,
        category: v.icon,
        _isSearchLink: true,
    }));

    return {
        products,
        summary: `${vendors.length} ${categories.join('/')} retailers ready to search. Click to browse real results.`,
        _fallback: true,
    };
}

// ═══════════════════════════════════════════════════════════════════
// RENDER — different card layouts for real products vs search links
// ═══════════════════════════════════════════════════════════════════
function renderProducts(products, isFallback) {
    return products.map((p, i) => {
        if (p._isSearchLink || isFallback) {
            return renderSearchLinkCard(p, i);
        }
        return renderProductCard(p, i);
    }).join('');
}

// Real product card — shows actual product image, name, price, vendor
function renderProductCard(p, i) {
    const imgSection = p.image_url
        ? `<img src="${p.image_url}" alt="${escapeHTML(p.name)}"
            style="max-height:160px;width:100%;object-fit:contain;"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
           <div class="product-img-fallback" style="display:none;font-size:3rem;justify-content:center;align-items:center;height:160px;">${p.category || '🛍️'}</div>`
        : `<div style="font-size:3rem;display:flex;justify-content:center;align-items:center;height:160px;">${p.category || '🛍️'}</div>`;

    return `
    <div class="product-card" data-index="${i}">
        <a href="${p.url}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit;">
            <div class="product-img">${imgSection}</div>
            <div class="product-info">
                <div class="product-name">${escapeHTML(p.name)}</div>
                <div class="product-vendor">via ${escapeHTML(p.vendor)}</div>
                ${p.description ? `<div class="product-desc">${escapeHTML(p.description)}</div>` : ''}
                <div class="product-bottom">
                    <span class="product-price">$${p.price.toFixed(2)}</span>
                    <span class="product-match">${p.match}% match</span>
                </div>
            </div>
        </a>
        <div class="product-actions">
            <button class="btn-buy" onclick="handleBuyNow(${i})">Buy Now →</button>
            <a href="${p.url}" target="_blank" rel="noopener" class="btn-save" style="text-decoration:none;">↗ View</a>
            <button class="btn-save" onclick="saveProduct(${i})">♡</button>
        </div>
    </div>`;
}

// Search link card — honest "Search [Vendor]" button, no fake product data
function renderSearchLinkCard(p, i) {
    return `
    <div class="product-card search-link-card" data-index="${i}">
        <a href="${p.url}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit;">
            <div class="product-img" style="display:flex;justify-content:center;align-items:center;font-size:3.5rem;height:160px;background:rgba(124,92,255,0.08);">
                ${p.category}
            </div>
            <div class="product-info">
                <div class="product-name">${escapeHTML(p.name)}</div>
                <div class="product-desc">${escapeHTML(p.description)}</div>
            </div>
        </a>
        <div class="product-actions">
            <a href="${p.url}" target="_blank" rel="noopener" class="btn-buy" style="text-decoration:none;display:inline-block;text-align:center;">Browse ${escapeHTML(p.vendor)} →</a>
        </div>
    </div>`;
}

// ─── HTML Escaping ─────────────────────────────────────────────────
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ─── Saved Products ────────────────────────────────────────────────
let currentProducts = [];
let savedProducts = [];

function saveProduct(index) {
    const product = currentProducts[index];
    if (product && !savedProducts.find(p => p.name === product.name)) {
        savedProducts.push(product);
        showToast(`♡ Saved "${product.name}"`);
    }
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
        position:fixed; bottom:24px; right:24px; z-index:999;
        background:#7c5cff; color:white; padding:12px 24px;
        border-radius:100px; font-size:0.9rem; font-weight:600;
        animation: slideUp 0.4s ease-out;
        box-shadow: 0 4px 20px rgba(124,92,255,0.3);
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ─── Stripe Checkout ───────────────────────────────────────────────
async function handleBuyNow(index) {
    const product = currentProducts[index];
    if (!product) return;

    // Search links don't go through Stripe — they go directly to the vendor
    if (product._isSearchLink) {
        window.open(product.url, '_blank');
        return;
    }

    // Real products: try Stripe checkout session
    if (stripeInstance && product.price > 0) {
        try {
            showToast('Opening checkout...');

            const response = await fetch(`${API_BASE}/api/store/checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    product_name: product.name,
                    price: Math.round(product.price * 100),
                    vendor: product.vendor,
                    vendor_url: product.url,
                    image_url: product.image_url || null,
                    success_url: window.location.href + '?checkout=success',
                    cancel_url: window.location.href + '?checkout=cancel',
                }),
            });

            if (response.ok) {
                const { sessionId, url } = await response.json();
                if (url) {
                    window.location.href = url;
                } else if (sessionId) {
                    await stripeInstance.redirectToCheckout({ sessionId });
                }
                return;
            }
        } catch (err) {
            console.warn('Stripe checkout failed, falling back to vendor:', err.message);
        }
    }

    // Fallback: open vendor URL directly
    window.open(product.url, '_blank');
}

function checkCheckoutResult() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
        showToast('✅ Purchase successful! Order confirmed.');
        window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('checkout') === 'cancel') {
        showToast('Checkout cancelled — your storefront is still here');
        window.history.replaceState({}, '', window.location.pathname);
    }
}

// ─── Dissolving Timer ──────────────────────────────────────────────
let timerInterval = null;
function startTimer(seconds = 900) {
    if (timerInterval) clearInterval(timerInterval);
    let remaining = seconds;
    const timerEl = document.getElementById('sf-timer');

    timerInterval = setInterval(() => {
        remaining--;
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

        if (remaining <= 60) timerEl.style.color = '#ff4444';
        if (remaining <= 0) {
            clearInterval(timerInterval);
            dissolveStorefront();
        }
    }, 1000);
}

// ─── Dissolve Animation ────────────────────────────────────────────
function dissolveStorefront() {
    const sf = document.getElementById('storefront');
    sf.style.transition = 'opacity 1s ease-out, transform 1s ease-out';
    sf.style.opacity = '0';
    sf.style.transform = 'translateY(20px)';
    setTimeout(() => {
        sf.style.display = 'none';
        sf.style.opacity = '1';
        sf.style.transform = 'none';
        if (timerInterval) clearInterval(timerInterval);
        currentProducts = [];
    }, 1000);
}

// ─── Search Handler ────────────────────────────────────────────────
async function handleSearch() {
    const input = document.getElementById('search-input');
    const query = input.value.trim();
    if (!query) {
        input.focus();
        input.placeholder = "Type what you're looking for...";
        return;
    }

    const btn = document.getElementById('search-btn');
    const btnText = btn.querySelector('.btn-text');
    const btnLoading = btn.querySelector('.btn-loading');

    btnText.style.display = 'none';
    btnLoading.style.display = 'flex';
    btn.disabled = true;

    const budget = parseInt(document.getElementById('budget-slider').value);
    const style = getActiveStyle();

    try {
        const result = await searchProducts(query, budget, style);
        currentProducts = result.products || [];

        if (currentProducts.length === 0) {
            showToast("No results found — try a different query");
            return;
        }

        const sf = document.getElementById('storefront');
        const isFallback = !!result._fallback;

        document.getElementById('sf-title').textContent = isFallback
            ? `Search ${currentProducts.length} retailers for "${truncate(query, 40)}"`
            : `${currentProducts.length} products found for "${truncate(query, 40)}"`;

        document.getElementById('sf-subtitle').textContent = isFallback
            ? `Live product search unavailable — browse real ${detectCategories(query).join('/')} retailers directly`
            : result.summary || `AI-curated • Budget: $${budget} • Style: ${style}`;

        document.getElementById('sf-grid').innerHTML = renderProducts(currentProducts, isFallback);

        sf.style.display = 'block';
        sf.scrollIntoView({ behavior: 'smooth', block: 'start' });
        startTimer(900);

    } catch (err) {
        console.error("Search failed:", err);
        showToast("Search failed — check your connection");
    } finally {
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
        btn.disabled = false;
    }
}

function truncate(str, len) {
    return str.length > len ? str.slice(0, len) + '...' : str;
}

function getActiveStyle() {
    const active = document.querySelector('.tag.active');
    return active ? active.textContent : 'Minimal';
}

// ─── Event Listeners ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    checkCheckoutResult();

    document.getElementById('search-btn').addEventListener('click', handleSearch);
    document.getElementById('search-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    const slider = document.getElementById('budget-slider');
    const display = document.getElementById('budget-display');
    slider.addEventListener('input', () => {
        display.textContent = `$${slider.value}`;
    });

    document.querySelectorAll('.tag').forEach(tag => {
        tag.addEventListener('click', () => {
            document.querySelectorAll('.tag').forEach(t => t.classList.remove('active'));
            tag.classList.add('active');
        });
    });

    document.querySelectorAll('.quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('search-input').value = btn.dataset.query;
            handleSearch();
        });
    });

    document.getElementById('sf-dissolve').addEventListener('click', dissolveStorefront);
    document.getElementById('sf-refine').addEventListener('click', handleSearch);

    window.addEventListener('scroll', () => {
        const nav = document.getElementById('nav');
        nav.style.background = window.scrollY > 50
            ? 'rgba(10, 10, 15, 0.95)'
            : 'rgba(10, 10, 15, 0.7)';
    });
});
