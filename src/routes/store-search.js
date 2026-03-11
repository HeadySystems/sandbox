/**
 * HeadyStore Search Route — /api/store/search
 * Cascades through available AI providers for REAL product search:
 *   1. Perplexity Sonar (best — has built-in web search)
 *   2. OpenAI GPT-4o (good — can reference real products)
 *   3. Gemini (good — can reference real products)
 *   4. Honest fallback — category-intelligent vendor search links
 *
 * NO fake data. NO stock photos. NO wrong vendors.
 * Part of PPA #26: Dynamic User-Specific E-Commerce
 */

const SHOPPING_SYSTEM_PROMPT = `You are a product search engine. Given a user query and budget, find REAL products available for purchase online RIGHT NOW.

CRITICAL RULES:
- Every product MUST be a real, currently-available item
- Every URL MUST be a real, working product page URL
- Every image_url MUST be a real product image from the vendor's website
- Every price MUST be the actual current price
- Only recommend vendors that ACTUALLY SELL the product category
- Do NOT invent products or make up URLs

Return ONLY valid JSON — no markdown, no explanation, no code fences:
{
  "products": [
    {
      "name": "Exact Real Product Name",
      "vendor": "Real Store Name",
      "price": 99.99,
      "url": "https://real-vendor.com/real-product-page",
      "image_url": "https://real-vendor.com/images/real-product.jpg",
      "match": 95,
      "description": "Brief 1-line description",
      "category": "emoji"
    }
  ],
  "summary": "Brief summary of results"
}`;

// ═══════════════════════════════════════════════════════════════
// VENDOR REGISTRY — only map vendors to what they actually sell
// ═══════════════════════════════════════════════════════════════
const VENDOR_REGISTRY = {
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

// ═══════════════════════════════════════════════════════════════
// CATEGORY DETECTION
// ═══════════════════════════════════════════════════════════════
const CATEGORY_KEYWORDS = {
    shoes: ['shoe', 'sneaker', 'boot', 'running', 'jordan', 'nike', 'adidas', 'slipper', 'sandal', 'heel', 'loafer'],
    audio: ['headphone', 'earphone', 'earbud', 'speaker', 'audio', 'noise cancel', 'soundbar'],
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
    for (const v of Object.values(VENDOR_REGISTRY)) {
        if (v.categories.includes('*')) { result.push(v); continue; }
        if (categories.some(c => v.categories.includes(c))) result.push(v);
    }
    return result.sort((a, b) => {
        const ag = a.categories.includes('*') ? 1 : 0;
        const bg = b.categories.includes('*') ? 1 : 0;
        return ag - bg;
    }).slice(0, 6);
}

// ═══════════════════════════════════════════════════════════════
// AI PROVIDER CASCADE — try each provider that has a key
// ═══════════════════════════════════════════════════════════════
async function searchWithPerplexity(userMessage) {
    const key = process.env.PERPLEXITY_API_KEY || process.env.AI_PROVIDER_PERPLEXITY_KEY;
    if (!key) return null;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'sonar',
            messages: [
                { role: 'system', content: SHOPPING_SYSTEM_PROMPT },
                { role: 'user', content: userMessage },
            ],
            temperature: 0.2,
            max_tokens: 2000,
        }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return extractJSON(data.choices?.[0]?.message?.content);
}

async function searchWithOpenAI(userMessage) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return null;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: SHOPPING_SYSTEM_PROMPT },
                { role: 'user', content: userMessage },
            ],
            temperature: 0.2,
            max_tokens: 2000,
            response_format: { type: 'json_object' },
        }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return extractJSON(data.choices?.[0]?.message?.content);
}

async function searchWithGemini(userMessage) {
    const key = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY_HEADY;
    if (!key) return null;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: SHOPPING_SYSTEM_PROMPT + '\n\n' + userMessage }]
            }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 2000 },
        }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return extractJSON(content);
}

function extractJSON(content) {
    if (!content) return null;
    try {
        // Try direct parse first
        const parsed = JSON.parse(content);
        if (parsed.products?.length > 0) return parsed;
    } catch (e) {
        // Extract JSON from fenced code or mixed text
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.products?.length > 0) return parsed;
            } catch (e2) { /* fall through */ }
        }
    }
    return null;
}

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════
async function storeSearchHandler(req, res) {
    try {
        const { query, budget = 200, style = 'minimal' } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        const userMessage = `Find 4-6 real products to buy: "${query}". Maximum budget: $${budget}. Style: ${style}. Search the internet for actual products with REAL prices, REAL store URLs, and REAL product image URLs from the vendor pages. Only include vendors that actually sell this type of product.`;

        // Cascade through available AI providers
        const providers = [
            { name: 'perplexity', fn: searchWithPerplexity },
            { name: 'openai', fn: searchWithOpenAI },
            { name: 'gemini', fn: searchWithGemini },
        ];

        for (const provider of providers) {
            try {
                console.log(`[store-search] Trying ${provider.name}...`);
                const result = await provider.fn(userMessage);
                if (result?.products?.length > 0) {
                    console.log(`[store-search] ${provider.name} returned ${result.products.length} products`);
                    return res.json({
                        ...result,
                        _provider: provider.name,
                    });
                }
            } catch (err) {
                console.warn(`[store-search] ${provider.name} failed:`, err.message);
            }
        }

        // Honest fallback: category-intelligent vendor search links
        const categories = detectCategories(query);
        const vendors = getVendorsForCategories(categories);

        const products = vendors.map((vendor, i) => ({
            name: `Search ${vendor.name} →`,
            vendor: vendor.name,
            price: 0,
            url: vendor.url(query),
            image_url: '',
            match: 90 - (i * 3),
            description: `Browse real ${categories[0] || 'product'} results on ${vendor.name}`,
            category: vendor.icon,
            _isSearchLink: true,
        }));

        return res.json({
            products,
            summary: `Live product search unavailable — browse ${vendors.length} ${categories.join('/')} retailers directly`,
            _fallback: true,
            _categories: categories,
        });

    } catch (err) {
        console.error('Store search error:', err);
        res.status(500).json({ error: 'Search failed', message: err.message });
    }
}

module.exports = { storeSearchHandler };
