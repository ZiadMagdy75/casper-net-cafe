# CASPER NET CAFE

Published page: https://ziadmagdy75.github.io/casper-net-cafe/

Netlify’s `netlify.app` address does not open from this network (`ERR_CONNECTION_TIMED_OUT`), so the public page is on GitHub Pages.

The printable QR code opens that page. Files are in `print/`:

- `print/casper-net-cafe-qr.png` — 2401×2401 PNG
- `print/casper-net-cafe-qr.svg` — vector QR code
- `print/casper-net-cafe-card.svg` — A6 card
- `print/index.html` — print preview

A one-page link hub for customers. One QR code opens this page. The page holds the café’s TikTok, Instagram, Facebook, WhatsApp, and Google Maps links.

The QR code is not generated from your computer. Publish the site first, then run the generator with that public `https` address. The script checks that the address is really this page, then writes a high-resolution PNG, an SVG, and a printable card.

## Preview on this computer

```bash
node scripts/preview.mjs
```

Open `http://127.0.0.1:4173`. That address is only for checking the layout. Do not put it in the QR code.

## Publish on Netlify

1. Create a free account at [https://app.netlify.com](https://app.netlify.com).
2. Drag this project folder onto [https://app.netlify.com/drop](https://app.netlify.com/drop). Leave out the `node_modules` folder.
3. Open **Site configuration → Change site name** and pick a name you want to keep, such as `casper-net-cafe`. The public address will look like `https://casper-net-cafe.netlify.app`.
4. Do this before you print the QR code. If you rename the site later, the printed code will still point at the old address.

You can also deploy with the Netlify CLI:

```bash
npx netlify-cli login
npx netlify-cli init
npx netlify-cli deploy --prod --dir .
```

`netlify.toml` already sets this folder as a static site. There is no build step.

## Publish on GitHub Pages

1. Create a **public** GitHub repository and push this project to the `main` branch.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select branch `main` and folder `/ (root)`, then save.
5. Wait until GitHub shows the site address. It looks like `https://USERNAME.github.io/REPOSITORY/`.

Use the address GitHub shows, including the repository name. A project site is not hosted at the bare `github.io` domain.

## Generate the QR code

After the public page loads in a browser:

```bash
npm install
npm run qr -- https://your-published-site
```

Replace `https://your-published-site` with the exact Netlify or GitHub Pages address. The generator will:

- reject `localhost`, private IPs, and placeholder hosts
- open the page and confirm it is CASPER NET CAFE, with all five links
- draw a black-on-white QR code at error correction level H
- decode the PNG and stop if the scan result is not that same URL

It writes:

| File | Use |
| --- | --- |
| `print/casper-net-cafe-qr.png` | High-resolution PNG, at least 2400 pixels, for print shops |
| `print/casper-net-cafe-qr.svg` | Vector QR code, 82 mm square |
| `print/casper-net-cafe-card.svg` | A6 card with the name and the code |
| `print/index.html` | On-screen sheet with a Print button |
| `print/source-url.txt` | The exact URL stored in the code |

Check the generator without creating a file:

```bash
npm run qr:test
```

Open `print/index.html` in a browser, choose **Print card**, and print at **100% scale**. The code should be at least 3 cm wide. Scan it with a phone before you print a stack. The phone should open the link page, not a list of addresses.

If the public URL changes, run the generator again and reprint.

## Links on the page

- TikTok: https://www.tiktok.com/@casper.netcafe
- Instagram: https://www.instagram.com/casper.netcafe
- Facebook: https://www.facebook.com/share/1Ae7Lu9hPu/
- WhatsApp: https://wa.me/201099101365
- Google Maps: https://maps.app.goo.gl/M37ATTRgbqHuvhDWA

## Credits

Outfit and Oxanium are used under the SIL Open Font License. The license texts are in `fonts/`. The social icons are from [Simple Icons](https://simpleicons.org/) (CC0).
