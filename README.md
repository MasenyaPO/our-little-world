# Our Little World 🌍

A private, secure, Progressive Web App (PWA) designed exclusively as a shared digital space for two people. 

## Features (Version 1)
*   **Home Dashboard:** Live relationship duration counter and daily status updates.
*   **Important Dates:** Shared calendar with recurring event tracking and countdowns.
*   **Our Memories:** Chronological photo timeline backed by private cloud storage.
*   **Love Notes:** A space for affectionate messages and appreciation.
*   **Bucket List:** Shared goal tracking with pending and completed states.
*   **Couple Q&A:** Blind-answer daily prompts enforced by database security policies.

## Technology Stack
*   **Frontend:** React 18, TypeScript, Vite
*   **Styling:** CSS Modules
*   **Backend & Database:** Supabase (PostgreSQL, Auth, Storage)
*   **Hosting:** Cloudflare Pages
*   **PWA:** `vite-plugin-pwa` for manifest generation and offline asset caching

## Security Architecture
This application enforces strict data isolation using PostgreSQL Row Level Security (RLS). 
*   Users authenticate via Supabase Auth.
*   The `relationship_members` table binds exactly two users to a single tenant space.
*   RLS policies ensure users can only query, insert, or update records associated with their specific `relationship_id`.
*   Private Storage Buckets ensure uploaded media cannot be accessed without an authorized session.

## Local Development Setup

1. **Install dependencies:**
   ```bash
   npm install