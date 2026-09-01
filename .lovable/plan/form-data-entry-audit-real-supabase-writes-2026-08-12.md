# Form & Data-Entry Audit → Real Supabase Writes

## What I found

Verified by reading every file that contains a form or submit action, plus all server functions and the existing migrations.

**Already writing to the database correctly** (awaited call, error checked, success shown only after the server confirms):

- Owner onboarding (`/onboarding/owner`) → `shops`, `services`, `user_roles`
- Owner dashboard: shop details → `shops`; services add/edit/delete → `services`; weekly hours → `shop_hours`
- Customer account profile edit → `profiles`
- Feedback status buttons → `customer_feedback.status`

**Real gaps:**

1. **The booking page (`/shop`) saves nothing.** Barber cards, the date strip, time slots and the "Confirm Booking" button are static markup — nothing is written to `bookings`. This is the one place where user input truly disappears.
2. **The barber calendar (`/barber`) is static** — hardcoded appointments instead of real bookings, and status changes cannot be saved.
3. **No customer feedback form exists.** Nothing can create a `customer_feedback` row, so the Feedback Intelligence page can never fill up from the app.
4. **Writes don't return the saved row.** None of the working writes use `.select()`, so the UI trusts "no error" rather than the row the database actually stored.
5. **Validation is thin.** Shop name/URL are the only truly required fields; phone, avatar URL, service names and hours ordering are loosely checked.
6. **Missing database guarantees:** no rule that a booking ends after it starts, nothing preventing a barber being double-booked, no check that the chosen service belongs to the booked shop, and feedback rating isn't bounded to 1–5.

## Field → table → column mapping (delivered as a document in the repo)

| Screen / form           | Field                                            | Table             | Column                                                                         |
| ----------------------- | ------------------------------------------------ | ----------------- | ------------------------------------------------------------------------------ |
| Owner onboarding        | Shop name / URL / address / description          | shops             | name / slug / address / description                                            |
|                         | Starter service name, minutes, price             | services          | name, duration_minutes, price_cents                                            |
| Owner → Shop details    | Name, description, address, cover image          | shops             | name, description, address, cover_image_url                                    |
| Owner → Services        | Name, description, minutes, price, active        | services          | name, description, duration_minutes, price_cents, is_active                    |
| Owner → Hours           | Open, close, closed (per weekday)                | shop_hours        | open_time, close_time, is_closed, weekday                                      |
| Account → Profile       | Full name, phone, avatar URL                     | profiles          | full_name, phone, avatar_url                                                   |
| Feedback page           | Status action                                    | customer_feedback | status                                                                         |
| **Booking page (new)**  | Barber, service, date + time, name, phone, notes | bookings          | barber_id, service_id, starts_at/ends_at, customer_name, customer_phone, notes |
| **Feedback form (new)** | Name, email, rating, message                     | customer_feedback | customer_name, customer_email, rating, message                                 |

Fields with **no database column** today: everything on the booking page (whole flow unmapped), the barber page's static appointments, and the home-page search box (intentionally client-only — it filters already-loaded shops and should not be stored).

## Plan

1. **Database migration**
   - Trigger-based rule: a booking's end must be after its start, and the chosen service/barber must belong to the booked shop.
   - Prevent a barber being booked into an overlapping active slot.
   - Bound feedback rating to 1–5 and constrain status/sentiment/urgency values.
   - Allow customers to submit feedback for a shop (own rows only) and allow barbers to read their own bookings for the calendar.
   - Confirm timestamps + update triggers and all foreign keys are present (already true today).

2. **Booking flow becomes real**
   - New server functions: load a shop's barbers/services/hours, compute open slots for a date, and create a booking.
   - Creation validates required fields, recomputes price and end time server-side from the service (never trusting the browser), inserts with `.select()`, and returns the saved row.
   - `/shop` gets real state: pick barber → service → date → slot → confirm. Success and the confirmation card render from the returned row; signed-out visitors see a "Sign in to book" prompt.

3. **Barber calendar becomes real**
   - Load the signed-in barber's bookings for the selected day; confirm / complete / no-show through an awaited update that returns the saved row.

4. **Feedback submission**
   - Short feedback form on the shop page (rating, message, optional name/email) writing to `customer_feedback`, so the owner dashboard reflects real input.

5. **Harden existing writes**
   - Add `.select()` to every insert/update/upsert and return the saved row; UI success states use that row.
   - Tighten validation: required service name, positive duration, non-negative price, phone/URL format, close time after open time, submit disabled until valid.

6. **Types & docs**
   - Regenerate the Supabase TypeScript types after the migration and use them for the new booking/feedback payloads.
   - Commit the expanded field → table → column mapping as `docs/data-mapping.md`.

## Technical notes

- All writes stay in `createServerFn` handlers with `requireSupabaseAuth`, so row-level security applies as the signed-in user; no direct table writes from components and no `localStorage` persistence of submitted data.
- Time-dependent rules use validation triggers rather than CHECK constraints, per Postgres requirements.
- Slot availability is computed server-side from shop hours, service duration and existing bookings.
