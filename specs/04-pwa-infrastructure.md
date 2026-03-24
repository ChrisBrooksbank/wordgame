# Phase 4: PWA Infrastructure

## Overview

Make the app installable, offline-capable, and notification-ready — turning the web app into a native-feeling experience.

## User Stories

- As a player, I want to install the game on my home screen like a native app
- As a player, I want to play offline (airplane mode, subway, etc.)
- As a player, I want a daily reminder notification so I don't break my streak
- As a player, I want the app to load fast even on slow connections

## Requirements

### Service Worker
- [ ] Workbox-based service worker with precaching
- [ ] Cache-first strategy for static assets (JS, CSS, images, fonts)
- [ ] Cache-first for word list DAWG binary
- [ ] Network-first for dynamic data (future: leaderboards, daily puzzle metadata)
- [ ] Offline fallback page if network-first resources unavailable
- [ ] Background sync queue for deferred actions (future: score submission)

### Web App Manifest
- [ ] Complete manifest.json with app name, short name, description
- [ ] Theme color and background color (forge amber/dark theme)
- [ ] App icons at all required sizes (48, 72, 96, 128, 144, 192, 512)
- [ ] Maskable icon variant
- [ ] Display mode: standalone
- [ ] Orientation: portrait (primary), landscape (allowed)
- [ ] Start URL and scope configured

### Offline Detection
- [ ] Online/offline status indicator in UI
- [ ] Graceful degradation: all game modes playable offline
- [ ] Queue network-dependent actions for when connection returns
- [ ] Show "offline" badge subtly (not blocking gameplay)

### Push Notifications (Cloudflare Workers)
- [ ] Notification permission request — only after player completes first Daily Forge
- [ ] Daily reminder: "Your Daily Forge is ready! 🔥" at player's preferred time
- [ ] Streak warning: "Your streak is at risk! Play today to keep it alive" (evening)
- [ ] Cloudflare Worker endpoint for push subscription management
- [ ] VAPID key generation and storage

### Install Prompt
- [ ] Custom install banner (not browser default)
- [ ] Show after 3rd session or 2nd Daily Forge completion
- [ ] Dismissible, doesn't re-show for 7 days after dismissal
- [ ] Different messaging for iOS (Add to Home Screen instructions)

### Performance
- [ ] LCP < 2 seconds
- [ ] INP < 100ms
- [ ] JS bundle < 80KB gzipped (game logic)
- [ ] Word list lazy-loaded after initial render
- [ ] Code splitting per game mode

## Acceptance Criteria

- [ ] App installable on Chrome (Android), Safari (iOS), Edge, Firefox
- [ ] All game modes functional in airplane mode
- [ ] Service worker caches all critical assets
- [ ] Lighthouse PWA audit score ≥ 90
- [ ] Push notifications delivered on schedule
- [ ] Install prompt appears at correct timing
- [ ] Bundle size within target

## Out of Scope

- Cross-device sync (Phase 7)
- Backend API beyond push notification endpoints (Phase 7)
