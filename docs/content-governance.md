# Content Governance

## Rules

### Centralization Rule

If any content appears in 2+ domain content folders, it **must** be moved to `content/global/` and referenced rather than duplicated.

### Update Cascade

Any headline or CTA change must update:

1. `site.json` in the domain folder
2. `hero.json` in the domain folder
3. `meta.json` in the domain folder
4. `configs/domains.json` registry (if CTA or SEO changed)

### Content Ownership

- **Global content**: Owned by brand team, changes require review
- **Product content**: Owned by product leads
- **Domain content**: Owned by domain leads, must align with global brand voice

### Quality Standards

- No placeholder text in production
- All headlines must be actionable and benefit-oriented
- Every page must have a clear primary CTA
- SEO meta descriptions ≤ 160 characters
- SEO titles ≤ 60 characters

### Review Cadence

- **Weekly**: Content accuracy check on active domains
- **Monthly**: SEO performance review
- **Quarterly**: Full content audit against brand-core.md

## Validation

Run `node scripts/validate-content.mjs` before any content deploy. This checks:

- All domains in `configs/domains.json` have matching content folders
- Required files exist (`site.json`, `hero.json`, `meta.json`)
- JSON files parse without errors
- SEO constraints met (title length, description length)
