/**
 * @heady-ai/content-engine — SEO Generator
 * 
 * Generates <head> tags from domain meta.json.
 */

interface SEOMeta {
    title: string;
    description: string;
    keywords?: string[];
    ogImage?: string;
}

/**
 * Generate HTML head tags from SEO metadata.
 */
export function generateHeadTags(meta: SEOMeta, domain: string): string {
    const tags: string[] = [];

    tags.push(`<title>${escapeHtml(meta.title)}</title>`);
    tags.push(`<meta name="description" content="${escapeHtml(meta.description)}" />`);

    if (meta.keywords && meta.keywords.length > 0) {
        tags.push(`<meta name="keywords" content="${escapeHtml(meta.keywords.join(', '))}" />`);
    }

    // Open Graph
    tags.push(`<meta property="og:title" content="${escapeHtml(meta.title)}" />`);
    tags.push(`<meta property="og:description" content="${escapeHtml(meta.description)}" />`);
    tags.push(`<meta property="og:type" content="website" />`);
    tags.push(`<meta property="og:url" content="https://${domain}" />`);

    if (meta.ogImage) {
        tags.push(`<meta property="og:image" content="https://${domain}${meta.ogImage}" />`);
    }

    // Twitter Card
    tags.push(`<meta name="twitter:card" content="summary_large_image" />`);
    tags.push(`<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`);
    tags.push(`<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`);

    // Canonical
    tags.push(`<link rel="canonical" href="https://${domain}" />`);

    return tags.join('\n    ');
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
