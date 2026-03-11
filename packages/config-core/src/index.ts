export const domainRegistry = {
  "headyme.com": {
    "role": "command_center",
    "runtime": "cloudflare_pages"
  },
  "headysystems.com": {
    "role": "architecture_brand",
    "runtime": "cloudflare_pages"
  },
  "headyconnection.org": {
    "role": "nonprofit_hub",
    "runtime": "cloudflare_pages"
  },
  "headybuddy.org": {
    "role": "companion_entry",
    "runtime": "cloudflare_worker"
  },
  "headymcp.com": {
    "role": "mcp_gateway",
    "runtime": "cloudflare_worker"
  },
  "headyapi.com": {
    "role": "liquid_gateway",
    "runtime": "cloudflare_worker"
  },
  "headyio.com": {
    "role": "developer_portal",
    "runtime": "cloudflare_pages"
  },
  "headybot.com": {
    "role": "automation_surface",
    "runtime": "cloud_run"
  },
  "headycloud.com": {
    "role": "cloud_control",
    "runtime": "cloud_run"
  },
  "headyos.com": {
    "role": "os_distribution",
    "runtime": "cloudflare_pages"
  }
} as const;

            export function resolveDomain(host: string) {
              return domainRegistry[host as keyof typeof domainRegistry] ?? null;
            }
