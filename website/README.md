# Run Club project website

Standalone static documentation for GitHub Pages at <https://msettles.github.io/run-club/>. It has no Firebase connection, analytics, sign-in or payment integration. The production club app stays on Firebase Hosting.

## Build and check

Use Node 24:

```bash
npm ci --prefix website
npm run check --prefix website
```

Both `build` and `check` build the HTML and validate internal page/asset links and heading fragments. Output is `website/dist/`, ignored by Git. This package has its own dependency lockfile; app dependencies are unchanged.

Preview the project path locally:

```bash
mkdir -p tmp/pages-preview
ln -sfn ../../website/dist tmp/pages-preview/run-club
python3 -m http.server 5187 --directory tmp/pages-preview
```

Open `http://localhost:5187/run-club/`. The host must serve directory indexes; a `file:` URL will not reproduce project-path links.

## Edit content

- `pages/`: Home, Features, Help, Setup and Roadmap.
- `build.mjs`: explicit published-page manifest, HTML layout, link handling and metadata.
- `assets/site.css`: responsive styling.
- `../docs/help/` and selected setup/permission guides: shared Markdown sources.

Only manifest-listed content and approved platform assets are published. The builder never copies the entire repository, private data, temporary output, audit records or the Firebase app build. Guides outside the manifest link to their source on GitHub. The trusted Markdown can include HTML; never render visitor input with this builder.

## Publishing

The **Project website** workflow checks relevant pull requests and builds/deploys `main` using the official Pages actions. Deployment is restricted to the platform repository; club forks do not automatically publish a second platform site. Enable **Settings → Pages → Source: GitHub Actions** in the platform repository. No Firebase deployment or app version bump is required.

`DOCS_SITE_URL` controls the canonical origin and subpath; the workflow pins the platform address. Test an alternate path with:

```bash
DOCS_SITE_URL=https://example.org/guide/ npm run check --prefix website
```

Build the default address again before previewing or deploying. For a future custom domain, update that workflow URL and the Pages domain setting together.

## Search and funding

Content pages have static HTML, unique titles/descriptions, canonical URLs and social metadata. The sitemap includes published pages and excludes the `noindex` 404 page. The robots file permits crawling. Google discovery/indexing is not guaranteed. After publication, the owner can verify the URL-prefix property in Google Search Console and submit the sitemap. No Search Console verification account is configured here.

Ko-fi remains a TODO. Add a payment link or `.github/FUNDING.yml` only after the owner creates and verifies the maintainer support account.
