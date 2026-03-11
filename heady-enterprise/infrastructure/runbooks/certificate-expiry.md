# Runbook: Certificate Renewal Procedures

**Severity:** P1 (if expired), P2 (if expiring within fib(9)=34 days)
**Team:** Infrastructure On-Call
**Version:** 3.2.2

---

## φ Quick Reference

```
φ = 1.618033988749895
Certificate alert windows:
  Warning:  fib(9)=34 days before expiry
  Critical: fib(6)=8 days before expiry
  Page:     fib(4)=3 days before expiry
9 domains total, fib(2)=1 wildcard per domain family
cert-manager auto-renews 30 days before expiry
```

---

## Domains and Certificates

| Domain | Secret Name | Type |
|--------|-------------|------|
| headyme.com, www.headyme.com, api.headyme.com | tls-headyme-com | Let's Encrypt |
| headyconnection.com | tls-headyconnection-com | Let's Encrypt |
| headyconnection.org | tls-headyconnection-org | Let's Encrypt |
| headyos.com | tls-headyos-com | Let's Encrypt |
| heady.exchange | tls-heady-exchange | Let's Encrypt |
| heady.investments | tls-heady-investments | Let's Encrypt |
| headysystems.com | tls-headysystems-com | Let's Encrypt |
| heady-ai.com | tls-headyai-com | Let's Encrypt |
| admin.headyme.com | tls-admin-headyme-com | Let's Encrypt |

---

## Detection

```bash
# List all certificates and their expiry
kubectl get certificates -n heady-system
kubectl get certificaterequests -n heady-system

# Check specific certificate status
kubectl describe certificate tls-headyme-com -n heady-system

# Check expiry dates (manual)
kubectl get secret tls-headyme-com -n heady-system \
  -o jsonpath='{.data.tls\.crt}' | base64 -d | \
  openssl x509 -noout -dates

# Check all certs
for domain in headyme-com headyconnection-com headyconnection-org headyos-com heady-exchange heady-investments headysystems-com headyai-com admin-headyme-com; do
  echo -n "$domain: "
  kubectl get secret tls-$domain -n heady-system \
    -o jsonpath='{.data.tls\.crt}' | base64 -d | \
    openssl x509 -noout -enddate 2>/dev/null || echo "NOT FOUND"
done
```

---

## Auto-Renewal (cert-manager)

cert-manager automatically renews certificates 30 days before expiry.

```bash
# Check cert-manager is running
kubectl get pods -n cert-manager

# Check ClusterIssuer status
kubectl describe clusterissuer letsencrypt-production

# Force renewal of a specific certificate
kubectl annotate certificate tls-headyme-com -n heady-system \
  cert-manager.io/issue-temporary-certificate=true

# Delete and recreate (force re-issue)
kubectl delete certificate tls-headyme-com -n heady-system
# cert-manager will recreate it from the Ingress annotation
```

---

## Manual Emergency Renewal

If cert-manager fails, use certbot directly:

```bash
# Install certbot
pip install certbot certbot-dns-cloudflare

# Renew with DNS-01 challenge (works even without HTTP access)
certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /etc/cloudflare.ini \
  -d headyme.com \
  -d "*.headyme.com" \
  --preferred-challenges dns-01 \
  --non-interactive \
  --agree-tos \
  -m eric@headyconnection.org

# Upload to Kubernetes secret
kubectl create secret tls tls-headyme-com \
  --cert=/etc/letsencrypt/live/headyme.com/fullchain.pem \
  --key=/etc/letsencrypt/live/headyme.com/privkey.pem \
  -n heady-system \
  --dry-run=client -o yaml | kubectl apply -f -
```

---

## Verification

```bash
# Confirm certificate is valid
echo | openssl s_client -connect headyme.com:443 -servername headyme.com 2>/dev/null | \
  openssl x509 -noout -dates -subject

# Check all 9 domains in parallel
for domain in headyme.com headyconnection.com headyconnection.org headyos.com heady.exchange heady.investments headysystems.com heady-ai.com admin.headyme.com; do
  echo -n "$domain: "
  echo | timeout 5 openssl s_client -connect $domain:443 -servername $domain 2>/dev/null | \
    openssl x509 -noout -enddate 2>/dev/null || echo "UNREACHABLE"
done
```

---

## Escalation

| Time | Action |
|------|--------|
| T+0 | On-call paged (if expired) |
| T+fib(5)=5m | Secondary on-call |
| T+fib(6)=8m | Infrastructure lead |
| T+fib(7)=13m | Engineering director |
| T+fib(8)=21m | Executive escalation |

**Note:** Certificate rotation must complete within fib(8)=21 minutes for Enterprise SLO compliance.
