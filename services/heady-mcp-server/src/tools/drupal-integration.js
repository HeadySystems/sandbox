/**
 * Heady™ Drupal CMS Integration
 * Connects MCP tools to the Drupal content management layer
 *
 * Drupal powers the content backend for:
 *   - headysystems.com (enterprise pages, docs)
 *   - headyconnection.org (nonprofit content, programs)
 *   - headyconnection.com (community forums, events)
 *   - heady-ai.com (research papers, publications)
 *   - headyex.com (marketplace listings, agent pages)
 *
 * Uses JSON:API (Drupal core) for content CRUD
 * Uses Drupal MCP module for tool registration
 */
'use strict';

const { PHI, TIMEOUTS } = require('../config/phi-constants');

const DRUPAL_BASE = process.env.DRUPAL_BASE_URL || 'https://cms.headysystems.com';
const DRUPAL_API_KEY = process.env.DRUPAL_API_KEY || '';

/**
 * Drupal JSON:API client
 */
async function drupalRequest(path, opts = {}) {
  const url = `${DRUPAL_BASE}${path}`;
  const method = opts.method || 'GET';
  const timeout = (opts.timeout || TIMEOUTS.REQUEST) * 1000;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const headers = {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    };
    if (DRUPAL_API_KEY) {
      headers['Authorization'] = `Bearer ${DRUPAL_API_KEY}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return { error: `Drupal ${response.status}: ${text.slice(0, 200)}`, url };
    }

    return await response.json();
  } catch (err) {
    return {
      error: err.message,
      url,
      hint: 'Drupal CMS may not be running. Check DRUPAL_BASE_URL env var.',
    };
  }
}

/**
 * Drupal MCP Tool Definitions
 * These extend the HeadyMCP tool set with CMS capabilities
 */
const DRUPAL_TOOLS = [
  {
    name: 'heady_cms_content',
    description: 'Manage Drupal CMS content — create, read, update, delete pages, articles, and custom content types across all HEADY sites.',
    category: 'cms',
    phiTier: 3,
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'get', 'create', 'update', 'delete'], description: 'CRUD action' },
        content_type: { type: 'string', enum: ['page', 'article', 'documentation', 'research_paper', 'agent_listing', 'program', 'event', 'forum_post'], default: 'page' },
        site: { type: 'string', enum: ['headysystems', 'headyconnection-org', 'headyconnection-com', 'heady-ai', 'headyex', 'headyos', 'headyme', 'headyfinance'], description: 'Target site' },
        id: { type: 'string', description: 'Content UUID (for get/update/delete)' },
        title: { type: 'string', description: 'Content title' },
        body: { type: 'string', description: 'Content body (HTML or Markdown)' },
        fields: { type: 'object', description: 'Additional Drupal fields' },
        limit: { type: 'integer', default: 10, description: 'Max results for list' },
      },
      required: ['action'],
    },
    handler: async (args) => {
      const { action, content_type, site, id, title, body, fields, limit } = args;
      const nodeType = content_type || 'page';

      switch (action) {
        case 'list':
          return drupalRequest(
            `/jsonapi/node/${nodeType}?filter[field_site]=${site || ''}&page[limit]=${limit || 10}&sort=-created`
          );

        case 'get':
          if (!id) throw new Error('id required for get');
          return drupalRequest(`/jsonapi/node/${nodeType}/${id}?include=field_tags,field_image`);

        case 'create':
          return drupalRequest(`/jsonapi/node/${nodeType}`, {
            method: 'POST',
            body: {
              data: {
                type: `node--${nodeType}`,
                attributes: {
                  title: title || 'Untitled',
                  body: { value: body || '', format: 'full_html' },
                  field_site: site || 'headysystems',
                  ...fields,
                },
              },
            },
          });

        case 'update':
          if (!id) throw new Error('id required for update');
          return drupalRequest(`/jsonapi/node/${nodeType}/${id}`, {
            method: 'PATCH',
            body: {
              data: {
                type: `node--${nodeType}`,
                id,
                attributes: {
                  ...(title && { title }),
                  ...(body && { body: { value: body, format: 'full_html' } }),
                  ...fields,
                },
              },
            },
          });

        case 'delete':
          if (!id) throw new Error('id required for delete');
          return drupalRequest(`/jsonapi/node/${nodeType}/${id}`, { method: 'DELETE' });

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
  },

  {
    name: 'heady_cms_taxonomy',
    description: 'Manage Drupal taxonomies — tags, categories, and vocabulary terms for content organization.',
    category: 'cms',
    phiTier: 4,
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'get', 'create'], description: 'Action' },
        vocabulary: { type: 'string', enum: ['tags', 'categories', 'research_areas', 'agent_categories', 'service_tiers'], default: 'tags' },
        name: { type: 'string', description: 'Term name (for create)' },
        id: { type: 'string', description: 'Term UUID' },
      },
      required: ['action'],
    },
    handler: async (args) => {
      const { action, vocabulary, name, id } = args;
      switch (action) {
        case 'list':
          return drupalRequest(`/jsonapi/taxonomy_term/${vocabulary}?sort=name`);
        case 'get':
          return drupalRequest(`/jsonapi/taxonomy_term/${vocabulary}/${id}`);
        case 'create':
          return drupalRequest(`/jsonapi/taxonomy_term/${vocabulary}`, {
            method: 'POST',
            body: {
              data: {
                type: `taxonomy_term--${vocabulary}`,
                attributes: { name: name || 'Untitled' },
              },
            },
          });
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
  },

  {
    name: 'heady_cms_media',
    description: 'Manage Drupal media — images, files, videos for all HEADY sites.',
    category: 'cms',
    phiTier: 4,
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'get', 'upload'], description: 'Action' },
        media_type: { type: 'string', enum: ['image', 'document', 'video', 'remote_video'], default: 'image' },
        id: { type: 'string', description: 'Media UUID' },
        filename: { type: 'string', description: 'Filename for upload' },
      },
      required: ['action'],
    },
    handler: async (args) => {
      const { action, media_type, id } = args;
      switch (action) {
        case 'list':
          return drupalRequest(`/jsonapi/media/${media_type}?sort=-created&page[limit]=20`);
        case 'get':
          return drupalRequest(`/jsonapi/media/${media_type}/${id}?include=field_media_image`);
        default:
          return { status: 'stub', action, note: 'Upload requires multipart — use Drupal admin or REST API directly.' };
      }
    },
  },

  {
    name: 'heady_cms_views',
    description: 'Execute Drupal Views — pre-built queries for content listings, reports, dashboards.',
    category: 'cms',
    phiTier: 4,
    inputSchema: {
      type: 'object',
      properties: {
        view_id: { type: 'string', description: 'Drupal View machine name' },
        display_id: { type: 'string', default: 'default', description: 'View display' },
        filters: { type: 'object', description: 'View contextual filters' },
      },
      required: ['view_id'],
    },
    handler: async (args) => {
      const { view_id, display_id, filters } = args;
      let path = `/jsonapi/views/${view_id}/${display_id || 'default'}`;
      if (filters) {
        const params = Object.entries(filters).map(([k, v]) => `views-filter[${k}]=${v}`).join('&');
        path += `?${params}`;
      }
      return drupalRequest(path);
    },
  },

  {
    name: 'heady_cms_search',
    description: 'Search Drupal content via Search API — full-text search across all HEADY sites with Solr/Elasticsearch backend.',
    category: 'cms',
    phiTier: 4,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        site: { type: 'string', description: 'Filter by site' },
        content_type: { type: 'string', description: 'Filter by content type' },
        limit: { type: 'integer', default: 10 },
      },
      required: ['query'],
    },
    handler: async (args) => {
      const { query, site, content_type, limit } = args;
      let path = `/jsonapi/index/site_search?filter[fulltext]=${encodeURIComponent(query)}&page[limit]=${limit || 10}`;
      if (site) path += `&filter[field_site]=${site}`;
      if (content_type) path += `&filter[type]=${content_type}`;
      return drupalRequest(path);
    },
  },
];

module.exports = { DRUPAL_TOOLS, drupalRequest };
