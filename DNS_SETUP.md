# Domain and DNS setup (Netlify registrar, Cloudflare DNS)

Nothing in this guide has been done for you. No domain is registered, no DNS record was created, and nothing was pointed at production. **Every record value below must be copied from the provider's own dashboard.** Examples use `your-domain.example` and `<site-name>.netlify.app` as placeholders, and I have not invented any verification tokens or account-specific values.

## 0. Check first: can the Netlify registrar delegate to Cloudflare?

Your plan (register at Netlify, run DNS at Cloudflare) needs the registrar to let you change the domain's **authoritative nameservers** to Cloudflare's two.

I could not confirm this from Netlify's public documentation. Their support guides describe Netlify as DNS provider and note that Netlify has historically not been a registrar, so what the registrar tab offers for a domain bought through Netlify may differ from what I can read. Before buying:

1. In Netlify, open the domain after registration (**Domains > your domain**) and look for a way to set **custom nameservers** (or "use external DNS").
2. If it does not exist, you have two options: (a) keep Netlify DNS and skip Cloudflare, or (b) register (or transfer) the domain at a registrar that supports custom nameservers (Cloudflare Registrar, which makes this step unnecessary, or another registrar).
3. Decide before you buy, because a domain registered with limited controls can be hard to move for the first 60 days (standard ICANN transfer lock).

Netlify's guidance for external DNS: use either Netlify DNS or an external DNS provider, not both, because mixing them can break HTTPS certificate issuance. Source: [Configure external DNS](https://docs.netlify.com/manage/domains/configure-domains/configure-external-dns/).

## 1. Register the domain

1. Netlify > **Domains** > search and register your domain. Complete payment yourself.
2. Enable domain lock and WHOIS privacy if offered.

## 2. Add the domain to Cloudflare

Per [Cloudflare's full DNS setup](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/):

1. Cloudflare dashboard > **Domains** > **Onboard a domain**, enter the apex domain (`your-domain.example`), choose the Free plan.
2. Review the imported records carefully. The automatic scan can miss records (apex, `www`, MX, SPF, DKIM, DMARC). Activating with missing records causes outages.
3. Cloudflare shows two nameservers. **Copy them exactly.**

## 3. Update the authoritative nameservers

1. At the registrar, **turn DNSSEC off first** (changing nameservers with DNSSEC on can make the domain unreachable).
2. Replace the existing nameservers with the two Cloudflare nameservers. Remove the old ones.
3. Wait for Cloudflare to mark the zone **Active** (up to 24 hours; usually much faster). Cloudflare emails you.
4. Verify delegation:

```bash
dig ns your-domain.example @1.1.1.1
nslookup -type=ns your-domain.example 1.1.1.1
```

5. Once Active, re-enable DNSSEC from Cloudflare.

## 4. Point the domain at Netlify

First add the domain to the site: Netlify > the Medyra site > **Domain management** > **Add a domain**, enter `your-domain.example`. Netlify also adds the `www` variant. Choose the primary domain.

Netlify recommends a subdomain as primary when using external DNS, because an apex domain resolves to a load balancer address rather than through Netlify's CDN directly. If you want the bare domain as primary, it works with the records below.

At Cloudflare > **DNS** > **Records**, create (values from [Netlify's external DNS docs](https://docs.netlify.com/manage/domains/configure-domains/configure-external-dns/); **confirm them in your site's "Pending DNS verification" panel**, which shows the exact values for your site):

| Type | Name | Value | Proxy status |
| --- | --- | --- | --- |
| CNAME (flattened at the apex) | `@` | `apex-loadbalancer.netlify.com` | **DNS only** |
| CNAME | `www` | `<site-name>.netlify.app` (the target Netlify shows you) | **DNS only** |

If you cannot use a flattened CNAME at the apex, Netlify's documented fallback is an **A** record for `@` with value `75.2.60.5`. (Cloudflare supports CNAME at the apex through flattening; confirm in Cloudflare's current docs when you create the record, as I could not verify that page.)

### Keep Netlify records DNS-only until HTTPS works

Set the proxy status to **DNS only (grey cloud)** for both records. Cloudflare's orange-cloud proxy sits in front of Netlify and, together with Netlify's own certificate provisioning, is a common cause of redirect loops and failed certificates. Only consider enabling the proxy later, after everything works, and then set Cloudflare SSL/TLS mode to **Full (strict)**. For Netlify, leaving it DNS-only is the supported, lowest-risk setup.

## 5. Verify HTTPS

1. Netlify > Domain management > **HTTPS** > wait for the certificate (Let's Encrypt) to be provisioned. Click **Verify DNS configuration**, then **Provision certificate** if it hasn't started.
2. Visit `https://your-domain.example` and `https://www.your-domain.example`. Both should load Medyra with a valid certificate and redirect to your chosen primary domain.
3. Check `https://your-domain.example/api/health`.
4. If the certificate fails: confirm both records are DNS-only, there are no conflicting `A`/`AAAA`/`CNAME` records for the same name, CAA records (if any) allow Let's Encrypt, and propagation has finished.

## 6. Authentication callback URLs

After the domain works, update, in this order:

1. Netlify env: `NEXT_PUBLIC_SITE_URL = https://your-domain.example`, then redeploy.
2. Supabase (production project) > Authentication > URL Configuration: **Site URL** `https://your-domain.example`; **Redirect URLs** add `https://your-domain.example/auth/callback` (and the `www` form if you serve it).
3. Keep `http://localhost:3000/**` only in the **development** project.

## 7. DNS records for Resend

Resend gives you the exact records after you add your sending domain (Resend > Domains > Add domain). It typically asks for DKIM records, an SPF record on a `send` subdomain, and an MX record for bounce handling, but **the names and values are generated for your account**. Copy them from the Resend dashboard into Cloudflare exactly, with proxy status **DNS only**. Never copy example values from the internet, and never edit the values. Then click **Verify** in Resend. DMARC is a record you author yourself; see EMAIL_SETUP.md.

If you also receive mail on this domain (for example `you@your-domain.example`), keep those MX records separate from Resend's and don't overwrite them.

## 8. Order of operations checklist

1. Decide registrar capability (section 0). 2. Register. 3. Add to Cloudflare. 4. Change nameservers, wait for Active. 5. Add domain in Netlify. 6. Create DNS-only records. 7. Wait for HTTPS. 8. Update Site URL / redirect URLs. 9. Add Resend records and verify. 10. Run the checklist in DEPLOYMENT.md on the real domain.
