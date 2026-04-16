# SSNC Speed Networking PWA — Product Requirements

## Original Problem Statement
Build a PWA for a speed networking event "SSNC". Admin manages events, users, categories, seating, badges, live screen, WhatsApp broadcasts. Users register/login via phone, update profiles, pass references. Volunteers scan QR codes, check-in attendees. Live screen for banquet hall.

## User Personas
- **Admin**: Full event management, seating algorithm, badge assignment, WhatsApp broadcasts, sponsor settings
- **User**: Phone-only login, profile with vCard/photo/logo, pass references, view table assignments
- **Volunteer**: Scan QR, check-in attendees, view badge numbers
- **Live Screen**: Banquet hall display — light mode, sponsors, leaderboards, timer, attendance

## Core Requirements
- Strict seating algorithm (no rematches, no subcategory clashes)
- QR code generation >25KB for Meta/Flexiwaba WhatsApp API
- Background job for table assignment (progress bar, no timeout)
- Bounded notification queue with MongoDB backlog for WhatsApp
- Separated login routes (User /login, Admin /admin/login, Volunteer /volunteer/login)
- Sequential badge pre-allocation by admin (not at scan time)
- Configurable sponsor heading, titles, names, logos on live screen
- Required contact_name and contact_phone when passing references
- Referrer info sent as "Name - Phone" in WhatsApp notifications

## Architecture
- Frontend: React + TailwindCSS + Shadcn UI
- Backend: FastAPI + Motor (async MongoDB)
- Database: MongoDB
- File Storage: Local uploads (QR codes, profile pics, logos)
- WhatsApp: Flexiwaba API (background tasks)

## What's Been Implemented
- Full admin panel (dashboard, events, categories, users, volunteers, settings)
- Event management with Registrations tab (badge #, CSV download), Seating tab (assign tables with progress bar, CSV), WhatsApp tab
- User profiles with photo/logo uploads, vCard generation
- Reference passing with required fields, bounded notification queue
- Volunteer QR scanning and check-in
- Live screen (light mode) with configurable sponsors
- Seating algorithm with time limits (45s budget)
- Performance optimizations (connection pool, indexes, GZip, QR size optimization)
- Load tested: 1000 concurrent references at 402 req/sec, 100% success

## P0 Features (Complete)
- [x] Event creation and management
- [x] User registration via CSV upload
- [x] Seating algorithm (strict constraints)
- [x] Badge pre-allocation
- [x] QR code generation >25KB
- [x] WhatsApp broadcasts (welcome, assignments, references)
- [x] Live screen with sponsors
- [x] Volunteer check-in
- [x] Reference passing with notifications
- [x] Performance for 1200 concurrent users
- [x] AI-powered Category & Subcategory Clash Groups (Feb 2026)
- [x] Subcategory clash group seating logic fix — NameError in _count_violations (Feb 2026)
- [x] OpenAI API key in Settings + auto AI clash detection on Assign Tables (Feb 2026)
- [x] Categories page simplified — removed AI button and inline clash group inputs (Feb 2026)
- [x] Download All QR Codes as ZIP (PNGs named by badge number) in Registrations tab (Feb 2026)
- [x] Badge Print CSV download (Badge#, Name, Company, Category, SubCategory, Round table numbers) (Feb 2026)
- [x] Quick Reference via QR scan or badge number input (Apr 2026)
- [x] Reactivate Event button after accidental "Finish Event" (Apr 2026)
- [x] Live Screen Tones — upload MP3s for round start, conclude start, conclude end, round end (Apr 2026)
- [x] Clear All References before event starts (Apr 2026)
- [x] Reference Enable/Disable toggle — users can see table members but can't pass refs until admin enables (Apr 2026)

## P2 Features (Backlog)
- [ ] Admin analytics dashboard
- [ ] Export reports (CSV/PDF)
- [ ] Admin view for all references passed

## Credentials
- Admin: admin@ssnc.com / admin123 at /admin/login
- User: phone 9327331017 at /login (no password)
- Volunteer: phone 9876543210 / password a@a.com at /volunteer/login
- Live Screen: password ssnc2026 at /live
