# Static Assets

This folder is a lightweight Cloudflare Pages project for static files that need a stable public URL. It is separate from the existing Worker code so it can host CSS, images, fonts, and miscellaneous files without assuming any app framework or build step.

## Recommended Cloudflare Pages Settings

For client handover, prefer a new Git-connected Pages project owned by the client:

- Git repository: the client-owned `phonic-marketing` repository
- Production branch: `main`
- Root directory: `static-assets`
- Build command: leave blank / none
- Build output directory: `public`

For a manual Direct Upload project, use the same root/output layout and deploy with:

```bash
npm run deploy:assets
```

When configuring either deployment method, use:

- Root directory: `static-assets`
- Build command: leave blank / none
- Build output directory: `public`

The output directory is relative to the Pages root. Cloudflare serves files inside `public` from the domain root, so `public/css/ashby-embed.css` becomes:

```text
https://<cloudflare-pages-project>.pages.dev/css/ashby-embed.css
```

Use the temporary `*.pages.dev` domain in Ashby while this asset host is being tested or whitelisted.

Cloudflare Direct Upload projects cannot later be converted to native Git integration. Choose the Git-connected project during initial client setup if automatic deployments from `main` are required.

## Folder Layout

```text
public/
  _headers
  assets/
    audio/
      phonic-voice-sample-1.mp3
      phonic-voice-sample-2.mp3
    video/
      how-it-works-v011-hevc-safari.mp4
      how-it-works-v011-vp9-chrome.webm
  css/
    ashby-embed.css
  js/
    request-a-call-form.js
```

Only directories containing tracked files are shown. Git does not preserve empty directories; add `assets/images/`, `assets/fonts/`, or `assets/misc/` when those asset types are needed.

- Put CSS files in `public/css/`.
- Put browser JavaScript in `public/js/`.
- Put audio and video in the matching subdirectories under `public/assets/`.
- Put images in `public/assets/images/` and fonts in `public/assets/fonts/` when needed.
- Put other downloadable or hosted files in `public/assets/misc/` when needed.

The `_headers` file adds basic security and cache headers. CSS is cached briefly so Ashby styling changes can roll out quickly. General assets use a longer cache window; prefer versioned or fingerprinted filenames before increasing cache lifetimes.
