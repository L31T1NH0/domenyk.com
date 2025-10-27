# Deployment Configuration

## Feature Flags

- `FEATURE_MDX_RENDERER`: Set to `"true"` to render blog posts using the MDX pipeline instead of the legacy remark-html renderer. Leave unset or any other value to keep the fallback renderer.
- `FEATURE_POST_REFERENCES`: Set to `"true"` to enable automatic conversion of `@post(slug)` markers into inline post reference cards. When disabled, the markers are rendered as literal text.

Both flags can be configured per-environment through your deployment provider's environment variable management tools.
