# Website Build Skill product site

Product page and source-rendered guides for [website-build-skill](https://github.com/aunysillyme/website-build-skill). Canonical site: https://website-build-skill.aunysillyme.dev/.

This site lives outside the canonical skill repository. The package privacy gate restricts portfolio branding and product-domain identifiers, so its rules and npm files remain unchanged.

## Build and verify

Node 22 or later. Run `npm ci`, `npm run build`, and `npm run check`. Serve `dist/` with a static server for local review. Vercel builds the same output using the committed lockfile.

## Refresh source documentation

`source/` contains only the explicit public Markdown list in `source-lock.json`, copied from its recorded immutable WBS commit. Build verifies every SHA-256 digest. To adopt a reviewed WBS revision, run `npm run source:refresh -- <40-character-commit>`, review the source diff and package version, run the build/checks, commit, and push. The refresh script copies data only and never executes WBS source. npm latest is checked separately at build time and by the browser; only matching rendered release notes are shown. This is an explicit refresh, not an unattended schedule.

## Publishing

Dedicated Vercel project `website-build-skill`, scope `aunysillymes-projects`. Main branch site pushes rebuild through its Git integration. Deployment protection stays enabled for previews. Cloudflare authoritative DNS serves the dedicated product subdomain. Public `build-info.json` identifies both WBS source commit and deployed site commit.

## Design and provenance

Adapted from [model-orchestrator](https://github.com/aunysillyme/model-orchestrator/tree/main/website): fonts, palette, sidebar, spacing, navigation tracker, sanitized Markdown renderer and reduced-motion trailer behavior. Reuses Auny's avatar, existing 14.5-second WBS trailer and 0.1.13 terminal recording. No new social image or analytics was introduced. Product method provenance is linked in the footer.

## Recovery

On failed checks, do not promote the build. Use Vercel rollback to a previously verified deployment and compare live build-info.json to the intended commit. No uptime monitor or unattended recovery service is configured.
