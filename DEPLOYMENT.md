# Deployment Configuration

## Feature Flags

- `FEATURE_MDX_RENDERER`: Set to `"true"` to render blog posts using the MDX pipeline instead of the legacy remark-html renderer. Leave unset or any other value to keep the fallback renderer.
- `FEATURE_POST_REFERENCES`: Set to `"true"` to enable automatic conversion of `@post(slug)` markers into inline post reference cards. When disabled, the markers are rendered as literal text.

Both flags can be configured per-environment through your deployment provider's environment variable management tools.

## Privacy Notes

- The comments API no longer stores or exposes raw visitor IP addresses. Sanitized HTML is persisted for every comment and only the cleaned markup is sent back to clients.

## Scheduled jobs

- Configure a cron job (for example, using Vercel Cron) to call `POST https://<your-domain>/api/cron/analytics` at least once per day.
- Provide the shared secret through `ANALYTICS_CRON_SECRET` (or `CRON_SECRET`/`VERCEL_CRON_SECRET`). The cron request must send `Authorization: Bearer <secret>`.
- Optionally set `ANALYTICS_CRON_LOOKBACK_DAYS` to control how many trailing days are recomputed on each run (defaults to 3, capped at 30).
