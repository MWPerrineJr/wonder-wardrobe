# Form → database mapping

Every field below is written to Lovable Cloud with an awaited insert/update,
the returned error checked, the saved row requested with `.select()`, and success
shown only after the database confirms the write.

## Onboarding — `/onboarding/owner` (`createOwnerShop`)
| Field | Table.column |
| --- | --- |
| Shop name | shops.name |
| Shop URL | shops.slug (unique) |
| Address | shops.address |
| Description | shops.description |
| Starter service name / min / price | services.name / duration_minutes / price_cents (+ services.shop_id) |
| — | user_roles.role = 'owner' for the signed-in user |

## Owner dashboard — `/owner`
| Field | Table.column |
| --- | --- |
| Shop details: name, description, address, cover image | shops.name / description / address / cover_image_url (`updateShop`) |
| Service name, description, duration, price, active | services.* (`createService`, `updateService`, `deleteService`) |
| Weekly hours: open, close, closed | shop_hours.open_time / close_time / is_closed, unique per (shop_id, weekday) (`upsertShopHours`) |

## Feedback Intelligence — `/owner/feedback`
| Field | Table.column |
| --- | --- |
| Status action buttons | customer_feedback.status (`updateFeedbackStatus`) |
| Filters (source/sentiment/urgency/status) | read-only query filters |

## Customer account — `/account`
| Field | Table.column |
| --- | --- |
| Full name | profiles.full_name |
| Phone | profiles.phone |
| Avatar URL | profiles.avatar_url |
| Service history | bookings joined to shops / services / barbers (read-only) |

## Booking — `/shop?slug=…` (`createBooking`)
| Field | Table.column |
| --- | --- |
| Barber choice | bookings.barber_id (nullable = no preference) |
| Service choice | bookings.service_id |
| Date + slot | bookings.starts_at (ends_at derived from services.duration_minutes) |
| Full name | bookings.customer_name |
| Phone number | bookings.customer_phone |
| Notes | bookings.notes |
| — | bookings.customer_id = auth.uid(), bookings.shop_id, bookings.price_cents (copied server-side from services.price_cents), bookings.status = 'pending' |

## Shop feedback form — `/shop?slug=…` (`submitFeedback`)
| Field | Table.column |
| --- | --- |
| Rating 1–5 | customer_feedback.rating (check constraint 1–5) |
| Message | customer_feedback.message |
| Name | customer_feedback.customer_name |
| Email | customer_feedback.customer_email (falls back to the auth email) |
| — | customer_feedback.customer_id = auth.uid(), source = 'web', status = 'new' |

## Fields with no database column
- Marketplace search box and location box on `/` — transient UI filters, intentionally not persisted.
- Feedback dashboard filter selects — query parameters only.
- The AI enrichment columns on `customer_feedback` (`sentiment_label`, `sentiment_score`,
  `emotion`, `urgency`, `summary`, `explanation`, `key_phrases`, `recommended_response`)
  have no form field; they are populated by analysis, not customer input.

## Integrity, timestamps and access rules
- Foreign keys: bookings → shops / services / barbers / auth.users; services, shop_hours,
  barbers, customer_feedback → shops; profiles, user_roles → auth.users.
- `created_at` / `updated_at` on every table, with `update_updated_at_column()` triggers.
- `validate_booking()` trigger: end must be after start, service and barber must belong to the
  booked shop, and overlapping pending/confirmed bookings for the same barber are rejected.
- Check constraints on `customer_feedback` for rating range and allowed status/sentiment/urgency.
- RLS: customers read/write only their own bookings, profile and feedback; barbers read and
  update bookings assigned to them; owners manage their own shops, services, hours and feedback.
