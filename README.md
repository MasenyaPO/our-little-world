# Our Little World 🌍

A private, secure, Progressive Web App (PWA) designed exclusively as a shared digital space for two people. 

## Features (Version 2)
*   **Home:** rename your space, custom partner nickname, free-text mood (plus quick presets), invite-code panel until your partner joins.
*   **Important Dates:** add / edit / delete, categories, notes, "next up" highlight, anniversary counts, past dates separated.
*   **Memories:** photos *and videos*, full-screen swipeable viewer, edit / delete, "added by" labels, collapsible replies.
*   **Love Notes:** edit / delete, author labels, fixed-height cards with "Read more", replies.
*   **Plans:** add / edit / delete, target dates, progress bar, category filter, "Surprise us" picker.
*   **Couple Q&A:** blind answers (kept), edit / delete your answer, write your own questions (creator can edit / delete).

## Technology Stack
*   **Frontend:** React, TypeScript, Vite
*   **Styling:** CSS Modules
*   **Backend & Database:** Supabase (PostgreSQL, Auth)
*   **Media storage:** Cloudflare R2, served through Cloudflare Pages Functions (`/functions`) with signed URLs
*   **Hosting:** Cloudflare Pages
*   **PWA:** `vite-plugin-pwa` for manifest generation and offline asset caching

## Security Architecture
This application enforces strict data isolation using PostgreSQL Row Level Security (RLS). 
*   Users authenticate via Supabase Auth.
*   The `relationship_members` table binds exactly two users to a single tenant space.
*   RLS policies ensure users can only query, insert, or update records associated with their specific `relationship_id`.
*   Media lives in a private R2 bucket. Every upload/sign/delete call is checked against the caller's Supabase session and space; files are served only through short-lived HMAC-signed links.

## Local Development Setup

1. **Install dependencies:**
   ```bash
   npm install

See **SETUP-V2.md** for the one-time Supabase + Cloudflare setup.
