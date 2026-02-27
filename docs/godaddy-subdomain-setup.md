# Setting Up a Subdomain on GoDaddy

This guide walks you through pointing a subdomain (e.g., `app.yourdomain.com`) to a static file host for the SEO Automator dashboard.

---

## Option A: Point to Vercel

1. Deploy your `frontend/` folder to Vercel
2. In Vercel project settings, go to **Domains** and add `app.yourdomain.com`
3. Vercel will show you a CNAME value (e.g., `cname.vercel-dns.com`)
4. Log in to GoDaddy > **My Products** > find your domain > **DNS**
5. Add a new record:
   - **Type**: CNAME
   - **Name**: `app`
   - **Value**: the CNAME from Vercel (e.g., `cname.vercel-dns.com`)
   - **TTL**: 1 Hour
6. Save. DNS propagation typically takes 10–30 minutes.

---

## Option B: Point to Netlify

1. Deploy `frontend/` to Netlify (drag and drop or CLI)
2. In Netlify > **Domain settings** > add custom domain `app.yourdomain.com`
3. Netlify will provide a CNAME target (e.g., `yoursite.netlify.app`)
4. In GoDaddy DNS, add:
   - **Type**: CNAME
   - **Name**: `app`
   - **Value**: `yoursite.netlify.app`
5. Save and wait for propagation.

---

## Option C: Point to a VPS / Web Server

If you're hosting the static files on your own server:

1. Find your server's public IP address
2. In GoDaddy DNS, add:
   - **Type**: A
   - **Name**: `app`
   - **Value**: your server IP
   - **TTL**: 1 Hour
3. Configure your web server (nginx/Apache) to serve the `frontend/` files for the subdomain

**Nginx example:**
```nginx
server {
    listen 80;
    server_name app.yourdomain.com;
    root /var/www/seo-automator;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## Notes

- GoDaddy requires the root domain to be registered with them for subdomain DNS management
- If your site uses HTTPS (recommended), also configure an SSL certificate via your host or Let's Encrypt
- TTL changes may take up to 48 hours in rare cases, though usually much faster
