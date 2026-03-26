# SSNC Speed Networking PWA - PRD

## Problem Statement
Build a PWA website for Speed Networking event "SSNC" with Admin panel, User portal, Volunteer scanner, and Live leaderboard screen.

## Architecture
- **Backend**: FastAPI + MongoDB (modular routes in /app/backend/routes/)
- **Frontend**: React + Shadcn UI + Tailwind CSS (dark theme, CSS variables for easy color changes)
- **Auth**: JWT-based (admin email/password, user phone/password, volunteer phone/password)
- **Database Collections**: admins, users, volunteers, events, categories, subcategories, event_registrations, table_assignments, table_captains, references, attendance, site_settings

## User Personas
1. **Admin**: Event organizer - creates events, manages categories, uploads users, assigns tables, controls rounds
2. **User/Attendee**: Business professional - registers, views tables, punches references, shares vCard
3. **Volunteer**: Venue staff - scans QR codes, validates entry, directs people to tables
4. **Live Screen Viewer**: Projected display showing real-time leaderboards and timers

## Core Requirements
- Event CRUD with table layout and round configuration
- Smart seating algorithm (no competitors at same table, collaboration-friendly, no repeat meetings)
- CSV bulk user import
- QR code generation (venue entry + digital business card)
- Reference punching system (only table members visible)
- Live leaderboard with round timer
- Table captain management
- Password-protected live screen

## What's Been Implemented (2026-03-23)
- Full backend API with 40+ endpoints across 6 route modules
- Admin panel: Dashboard, Events (CRUD + CSV upload + seat allocation + round control), Categories, Users, Volunteers, Settings
- User portal: Dashboard (QR code, table assignments), Profile editor, Reference punching, Reference viewing
- Volunteer scanner: QR scan/manual entry, attendance marking, table direction display
- Live screen: Password-protected, real-time stats, 3 leaderboards (givers, receivers, tables), round timer
- Public profile: vCard page with contact info, social links, QR code, save-as-contact
- Smart seating algorithm in /app/backend/seating.py
- Default admin: admin@ssnc.com / admin123
- Default live screen password: ssnc2026

## What's Been Implemented (2026-03-24)
- Download Sample CSV buttons added to all 3 admin CSV upload locations:
  - User Management (inside Upload CSV dialog)
  - Business Categories (in top action bar)
  - Event Management (in registrations tab)
- PWA Support: manifest.json, service worker (sw.js), app icons (192x192, 512x512), install prompt popup
  - Apple meta tags for iOS home screen support
  - InstallPrompt component shows "Install SSNC App" banner when browser supports it
- Camera-based QR Scanner for Volunteers:
  - Uses html5-qrcode library for real camera scanning
  - Toggle between Camera Scan and Manual Entry modes
  - Auto-extracts user ID from profile URLs
  - Stops camera after successful scan
- Moved Table & Round Configuration from "Create Event" form into a dedicated "Configuration" tab inside event detail
  - Admins can now adjust tables, chairs, rounds, etc. anytime as registrations grow

## What's Been Implemented (2026-03-25)
- Removed "Import from Phone Book" (Contact Picker API) feature from Pass Reference flow
  - The native Contact Picker API could not handle 5000+ contacts and crashed the PWA
  - Users now manually type contact details (name, phone, email) in the Pass Reference dialog
- WhatsApp social link default country code 91 (India) on Profile and Registration pages
- CSV download for Seating data in admin Events (all rounds with names, phone, email, position, business, category)
- Removed "Made with Emergent" branding badge

## What's Been Implemented (2026-03-26)
- **SGCCI & SBC Branding**: Added SGCCI and SBC logos to login page, admin sidebar, user header, volunteer header
- **Color Theme Update**: Changed primary color from violet to SGCCI blue (#32329A)
- **Dark/Light Theme Toggle**: 
  - Created ThemeContext with localStorage persistence
  - Theme toggle button (sun/moon) available on login page, admin sidebar, user header
  - Updated all CSS variables for both dark and light modes
  - Replaced all hardcoded dark-mode colors (bg-black/30, border-white/10, text-white, etc.) with theme-aware Tailwind classes
- **Admin Logo Upload**: 
  - New "App Logo" section in admin Settings page
  - Upload endpoint (POST /api/admin/upload-logo) saves to /app/backend/uploads/
  - Public branding endpoint (GET /api/public/branding) for retrieving logo without auth
  - StaticFiles mount serves uploaded logos via /api/uploads/
  - This eliminates all PWA crash issues related to the Contact Picker API

## P0 Features Remaining
- WhatsApp API integration (user to provide docs later)
- Razorpay payment integration

## P1 Features Remaining
- File upload for profile pictures and company logos (currently URL-based)
- Collaboration category tagging in category management UI
- Email/SMS notifications

## P2 Features
- Admin analytics dashboard with charts
- Export reports (CSV/PDF)
- Multi-event concurrent support
- Speaker timer display on live screen
- Spot registration workflow

## Next Tasks
1. Add WhatsApp API integration when documentation is provided
2. Integrate Razorpay payment gateway
3. Add camera QR scanner for volunteer dashboard
4. File upload for profile pictures
5. PWA manifest.json and service worker
