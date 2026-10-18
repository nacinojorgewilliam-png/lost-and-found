# Hanap QCU — Lost & Found and Campus Finder

A free, static web app for Quezon City University.

- **Students and staff** browse found and lost items on a campus map, report what they found or lost, and look up rooms and offices.
- **The Lost & Found desk** reviews reports and publishes them from `admin.html`.

It runs entirely on GitHub Pages: no server and no database.

| File | What it is |
|---|---|
| `index.html` | Public site: feed, map, campus places and the report wizard |
| `admin.html` | Desk page: inbox, items, places and site settings; publishes to GitHub |
| `assets/core.js`, `assets/app.css` | Shared code and styles |
| `data/campus.geojson` | Campus outline, buildings and roads, from © OpenStreetMap contributors (ODbL). 27 KB, about 3.5 KB gzipped |
| `data/db.json` | Starter data. The live copy sits on the `data` branch |
| `data/sample.json` | Made-up demo data. Open `index.html?demo` to preview it |

## Set up

1. **Publish the site.** Push this folder to a GitHub repository and turn on **Settings → Pages** for the default branch.
2. **Create a token.** On GitHub go to **Settings → Developer settings → Fine-grained tokens**.
   - Give it access to this repository only.
   - Set **Contents** to **Read and write**.
3. **Connect the desk page.** Open `https://<you>.github.io/<repo>/admin.html` and choose **Connection**. Enter the owner, repository and token.
   - The first save creates a `data` branch holding `data/db.json`.
   - Data edits then never trigger a Pages rebuild.
4. **Fill in the site.** In admin, under **Places**:
   - Click each building on the map and name it.
   - Add the **Lost & Found desk** (type "Lost & Found desk"), the registrar, faculty rooms and so on.
5. **Site settings (optional).** In **Site**:
   - Set the desk e-mail address and opening hours.
   - Add a **Cloudinary** cloud name and an *unsigned* upload preset if students should be able to upload photos from their phones. The free tier is enough. Without it, students paste image links.

## How a report reaches the desk (no server needed)

The report wizard packs the report into a link: `admin.html#submit=…`. The student then either:

- shows the **QR code** at the desk, or
- e-mails or messages the link.

The desk opens the link, and the report lands in the **Inbox**. From there the desk reviews it, posts it and presses **Publish**.

The student's name and contact stay in the desk browser's inbox. They are never published.

## Why it costs (almost) nothing to run

- **Data:** read from `raw.githubusercontent.com` (GitHub's CDN), cached in the browser and revalidated with ETags. An unchanged list costs a few hundred bytes.
- **Photos:** stored as links only, never uploaded to GitHub. Thumbnails are resized on the fly, by Cloudinary or the free `images.weserv.nl` proxy, so a phone loads about 30 KB per photo instead of several MB.
- **Map:** satellite (Esri) and street (CARTO) tiles come from their CDNs. **Blueprint** mode draws the campus from the 3.5 KB outline file and downloads no map images at all.
- **Code:** Leaflet loads from unpkg; walking directions open in Google Maps; QR codes come from `api.qrserver.com`.
