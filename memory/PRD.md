# SSNC Speed Networking PWA - PRD

## Problem Statement
Build a PWA website for Speed Networking event "SSNC" with Admin panel, User portal, Volunteer scanner, and Live leaderboard screen.

## Architecture
- **Backend**: FastAPI + MongoDB (modular routes in /app/backend/routes/)
- **Frontend**: React + Shadcn UI + Tailwind CSS (dark theme, CSS variables for easy color changes)
- **Auth**: JWT-based (admin email/password, user phone/password, volunteer phone/password)
- **Database Collections**: admins, users, volunteers, events, categories, subcategories, event_registrations, table_assignments, table_captains, references, attendance, site_settings, whatsapp_messages

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
- Download Sample CSV buttons added to all 3 admin CSV upload locations
- PWA Support: manifest.json, service worker, app icons, install prompt
- Camera-based QR Scanner for Volunteers
- Moved Table & Round Configuration from "Create Event" form into dedicated "Configuration" tab

## What's Been Implemented (2026-03-25)
- Removed "Import from Phone Book" (Contact Picker API) feature
- WhatsApp social link default country code 91 (India)
- CSV download for Seating data in admin Events
- Removed "Made with Emergent" branding badge

## What's Been Implemented (2026-03-26)
- SGCCI & SBC Branding with dynamic logo system (5 separate uploads)
- Color Theme Update: SGCCI blue (#32329A)
- Dark/Light Theme Toggle with localStorage persistence
- N+1 Query Optimization: Fixed all 8 patterns via db_helpers.py
- Seating Validation with verification badges
- Duplicate Captain Prevention
- WhatsApp Integration (flexiwaba API): Admin Settings config, Send Welcome/Assignments, Delivery Status

## What's Been Implemented (2026-03-27)
- **WhatsApp Broadcast Timeout Fix**: Replaced synchronous HTTP-blocking broadcast with FastAPI BackgroundTasks using asyncio.create_task. Now processes 496+ users without HTTP timeout.
- **Real-time Progress Bar**: Frontend polls GET /api/admin/whatsapp/job/{job_id} every 1.5s showing processing count, percentage, sent/skipped/failed stats
- **Separate Welcome & Assignment Lists**: Delivery logs split into Welcome Messages section and Table Assignment Messages section with independent progress bars, counters, and delivery logs
- **Broadcast Complete Summary**: Green banner appears when job finishes with final stats
- **Status API Enhancement**: GET /api/admin/whatsapp/status/{event_id} now returns 'welcome' and 'assignment' sub-objects
- **Retry with Progress**: Retry Failed button now also returns job_id and shows progress bar

## What's Been Implemented (2026-03-31)
- **Edit User**: Admin can edit any user's details (name, phone, email, business, category, subcategory, position) via PUT /api/admin/users/{user_id} with phone uniqueness validation
- **Delete User with Cascade**: Deleting a user removes all related data: event registrations, table captains, attendance, references, WA messages, and removes from table_assignments arrays
- **Delete All Users**: Bulk delete with "DELETE ALL" confirmation text, clears all user-related collections
- **Edit UI**: Pencil icon per row opens pre-filled dialog with all user fields including category/subcategory dropdowns
- **Delete All UI**: Red button with count, confirmation dialog listing all cascading effects

## P0 Features Remaining
- Razorpay payment integration

## P1 Features Remaining
- File upload for profile pictures and company logos
- Collaboration category tagging in category management UI
- Email/SMS notifications

## P2 Features
- Admin analytics dashboard with charts
- Export reports (CSV/PDF)
- Multi-event concurrent support
- Speaker timer display on live screen
- Spot registration workflow

## Next Tasks
1. Integrate Razorpay payment gateway
2. File upload for profile pictures
3. Admin analytics dashboard
