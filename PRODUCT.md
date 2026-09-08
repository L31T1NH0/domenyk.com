# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Readers visiting a personal site to browse essays, posts, notes, and short updates. Admin users also manage notes and visibility from the same surfaces.

## Product Purpose

The site publishes Domenyk's writing and short-form notes in a compact public feed. Success means readers can quickly move between all content, posts, and notes without the interface getting in the way.

## Positioning

Domenyk's personal publishing site brings longer writing and short-form notes together. The author's voice and published work are the basis of the site's identity.

## Operating Context

Readers browse the public home on desktop and mobile, switch between all content, posts, and notes, and search published content. Desktop layouts also support browsing parallel feeds and complementary navigation through archives and categories.

Admin users manage published content and visibility. The public site can also show writing in progress.

## Capabilities and Constraints

- Publish and browse articles, notes, and note threads.
- Find content through feed filters, search, archives, and categories.
- Help first-time visitors understand who Domenyk is and find an author-selected starting point. This onboarding addition is approved but not yet implemented; the introduction copy and selected texts remain undecided.
- Preserve existing publishing, reading, and admin workflows when extending the home.

## Brand Commitments

Quiet, direct, text-first.

Preserve the existing monochrome identity and the name Domenyk.

## Evidence on Hand

- Existing public home and feed: `src/app/(public)/page.tsx` and `src/app/(public)/HomeTimeline.tsx`.
- Existing archives, categories, and writing-in-progress navigation: `src/components/timeline/TimelineUtilityRail.tsx`.
- Available profile image: `public/images/profile.jpg`.
- Published content is loaded through the site's content layer. Use real content and author-selected links; do not invent biographical claims or featured titles.

## Product Principles

- Keep reading and discovering the author's work central to the experience.
- Make longer writing and short updates easy to browse together or separately.
- Help newcomers find a starting point while preserving quick access for returning readers.
- Keep mobile navigation direct and lightweight.

## Anti-references

Avoid generic landing-page patterns, oversized decorative UI, heavy card systems, and visual effects that compete with reading.

## Design Principles

- Keep the timeline compact and readable.
- Prefer direct controls over explanatory labels.
- Preserve the existing monochrome, text-led identity.
- Make mobile navigation fast with minimal chrome.

## Accessibility & Inclusion

Maintain keyboard-accessible controls, semantic labels, readable contrast, and reduced reliance on motion for navigation.
