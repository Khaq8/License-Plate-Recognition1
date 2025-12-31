# License Plate Recognition Parking System - System Design Document

## Table of Contents
1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Technology Stack](#3-technology-stack)
4. [User Roles & Access Control](#4-user-roles--access-control)
5. [Database Schema (ERD)](#5-database-schema-erd)
6. [Core Use Cases](#6-core-use-cases)
7. [Sequence Diagrams](#7-sequence-diagrams)
8. [API Endpoints](#8-api-endpoints)
9. [Caching Strategy](#9-caching-strategy)
10. [Business Rules](#10-business-rules)

---

## 1. System Overview

The License Plate Recognition (LPR) Parking System is a full-stack application that automates parking lot management using computer vision for license plate detection. The system handles vehicle entry/exit tracking, automated billing, multi-owner payment prioritization, and real-time occupancy monitoring.

### Key Features
- Automatic license plate recognition (ALPR) via camera integration
- Real-time parking lot occupancy tracking
- Multi-owner vehicle support with priority-based billing
- Credit balance management with transaction history
- Admin dashboard for lot management and manual interventions
- Mobile app for users to monitor parking sessions

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌──────────────────────┐              ┌──────────────────────┐                │
│   │   React Native App   │              │    ALPR Camera       │                │
│   │   (Expo + TypeScript)│              │    Integration       │                │
│   │                      │              │                      │                │
│   │  • AuthContext       │              │  • OpenCV            │                │
│   │  • LotContext        │              │  • fast-alpr         │                │
│   │  • Navigation        │              │  • ONNX Runtime      │                │
│   └──────────┬───────────┘              └──────────┬───────────┘                │
│              │                                     │                             │
└──────────────┼─────────────────────────────────────┼─────────────────────────────┘
               │ HTTPS (JWT Auth)                    │ Internal
               ▼                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                         FastAPI Application                              │   │
│   │                         (Uvicorn ASGI Server)                            │   │
│   ├─────────────────────────────────────────────────────────────────────────┤   │
│   │                                                                          │   │
│   │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │   │
│   │   │ auth.py     │  │ parking.py  │  │parking_lot.py│ │  car.py     │    │   │
│   │   │             │  │             │  │             │  │             │    │   │
│   │   │ • signup    │  │ • entry     │  │ • CRUD lots │  │ • register  │    │   │
│   │   │ • login     │  │ • exit      │  │ • status    │  │ • list      │    │   │
│   │   │ • refresh   │  │ • force-out │  │ • active    │  │ • delete    │    │   │
│   │   │ • logout    │  │ • sessions  │  │   vehicles  │  │             │    │   │
│   │   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │   │
│   │                                                                          │   │
│   │   ┌─────────────────────────────────────────────────────────────────┐   │   │
│   │   │                     security.py                                  │   │   │
│   │   │  • JWT verification (python-jose)                                │   │   │
│   │   │  • get_current_user / get_current_admin dependencies             │   │   │
│   │   └─────────────────────────────────────────────────────────────────┘   │   │
│   │                                                                          │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└──────────────────────────────┬──────────────────────────┬────────────────────────┘
                               │                          │
                               ▼                          ▼
┌──────────────────────────────────────────┐  ┌────────────────────────────────────┐
│           CACHE LAYER                     │  │         DATA LAYER                 │
├──────────────────────────────────────────┤  ├────────────────────────────────────┤
│                                          │  │                                    │
│   ┌──────────────────────────────────┐   │  │   ┌────────────────────────────┐   │
│   │            Redis                 │   │  │   │     Supabase               │   │
│   │                                  │   │  │   │                            │   │
│   │  • lot_status:{lot_id}    5min   │   │  │   │  ┌──────────────────────┐  │   │
│   │  • active_sessions:{lot_id} 5min │   │  │   │  │   PostgreSQL DB      │  │   │
│   │  • plate_seen:{plate}:{lot} 5sec │   │  │   │  │   (with RLS)         │  │   │
│   │  • user_session:{user_id}  5min  │   │  │   │  └──────────────────────┘  │   │
│   │                                  │   │  │   │                            │   │
│   └──────────────────────────────────┘   │  │   │  ┌──────────────────────┐  │   │
│                                          │  │   │  │   Supabase Auth      │  │   │
└──────────────────────────────────────────┘  │   │  │   (JWT Provider)     │  │   │
                                              │   │  └──────────────────────┘  │   │
                                              │   │                            │   │
                                              │   └────────────────────────────┘   │
                                              │                                    │
                                              └────────────────────────────────────┘
```

---

## 3. Technology Stack

### Backend
| Component | Technology | Purpose |
|-----------|------------|---------|
| Web Framework | FastAPI | Async REST API with automatic OpenAPI docs |
| ASGI Server | Uvicorn | High-performance async server |
| Database | Supabase (PostgreSQL) | Relational data with Row-Level Security |
| Authentication | Supabase Auth + python-jose | JWT-based auth with HS256 signing |
| Caching | Redis | Session caching, duplicate detection |
| Computer Vision | OpenCV + fast-alpr + ONNX | License plate recognition |

### Frontend
| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | React Native (Expo) | Cross-platform mobile app |
| Language | TypeScript | Type-safe JavaScript |
| State Management | React Context API | AuthContext, LotContext |
| Secure Storage | expo-secure-store | JWT token storage |
| Local Storage | AsyncStorage | User preferences |
| Navigation | React Navigation | Stack + Tab navigation |

### Infrastructure
| Component | Technology | Purpose |
|-----------|------------|---------|
| Containerization | Docker | Consistent deployment |
| CI/CD | GitHub Actions | Automated testing and deployment |

---

## 4. User Roles & Access Control

### Role Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                        ADMIN ROLE                                │
│                    (is_admin = true)                             │
├─────────────────────────────────────────────────────────────────┤
│  PARKING LOT MANAGEMENT                                          │
│  • Create new parking lots                                       │
│  • Update lot details (capacity, rates, location)                │
│  • Deactivate lots (soft delete)                                 │
│  • View ALL lots (including inactive)                            │
├─────────────────────────────────────────────────────────────────┤
│  PARKING SESSION MANAGEMENT                                      │
│  • Record vehicle entry (camera trigger)                         │
│  • Record vehicle exit (camera trigger)                          │
│  • Force checkout (manual intervention)                          │
│  • View all sessions across all lots                             │
│  • View currently parked vehicles                                │
├─────────────────────────────────────────────────────────────────┤
│  INHERITS ALL USER PERMISSIONS                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ extends
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        USER ROLE                                 │
│                    (is_admin = false)                            │
├─────────────────────────────────────────────────────────────────┤
│  PARKING LOT ACCESS                                              │
│  • View active parking lots only                                 │
│  • View real-time lot occupancy/status                           │
├─────────────────────────────────────────────────────────────────┤
│  PERSONAL DATA ACCESS                                            │
│  • View own parking session history                              │
│  • View current active parking session                           │
│  • Register vehicles to account                                  │
│  • Manage credit balance                                         │
│  • View transaction history                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Access Control Matrix

| Resource | Endpoint | Admin | User | Anonymous |
|----------|----------|-------|------|-----------|
| Create lot | `POST /lots/` | Yes | No | No |
| Update lot | `PUT /lots/{id}` | Yes | No | No |
| Delete lot | `DELETE /lots/{id}` | Yes | No | No |
| List lots | `GET /lots/` | All | Active only | No |
| Lot status | `GET /lots/{id}/status` | Yes | Yes | No |
| Active vehicles | `GET /lots/{id}/active` | Yes | No | No |
| Record entry | `POST /parking/{lot}/entry` | Yes | No | No |
| Record exit | `POST /parking/{lot}/exit` | Yes | No | No |
| Force checkout | `POST /parking/sessions/{id}/force-checkout` | Yes | No | No |
| All sessions | `GET /parking/sessions` | Yes | No | No |
| My sessions | `GET /parking/my-sessions` | Yes | Yes | No |
| My active | `GET /parking/my-active-session` | Yes | Yes | No |

---

## 5. Database Schema (ERD)

### Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           ENTITY RELATIONSHIP DIAGRAM                            │
└─────────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────┐
    │     auth.users      │◄──────────────────────────────────────┐
    │   (Supabase Auth)   │                                       │
    ├─────────────────────┤                                       │
    │ PK  id (uuid)       │                                       │
    │     email           │                                       │
    │     encrypted_pass  │                                       │
    └──────────┬──────────┘                                       │
               │                                                  │
               │ 1:1                                              │
               ▼                                                  │
    ┌─────────────────────┐         ┌─────────────────────┐       │
    │      profiles       │         │        cars         │       │
    ├─────────────────────┤         ├─────────────────────┤       │
    │ PK  id (uuid)       │◄────────│ FK  user_id         │       │
    │     username        │    1:N  │ PK  id              │       │
    │     email           │         │     license_plate   │       │
    │     phone           │         │     brand           │       │
    │     first_name      │         │     model           │       │
    │     last_name       │         │     color           │       │
    │     is_admin        │         │     owner_priority  │       │
    │     credit_balance  │         │     is_primary      │       │
    │     created_at      │         │     created_at      │       │
    └──────────┬──────────┘         └──────────┬──────────┘       │
               │                               │                  │
               │                               │                  │
               │ 1:N                           │ 1:N (nullable)   │
               │                               │                  │
               │    ┌──────────────────────────┘                  │
               │    │                                             │
               ▼    ▼                                             │
    ┌─────────────────────┐         ┌─────────────────────┐       │
    │  parking_sessions   │         │    parking_lots     │       │
    ├─────────────────────┤         ├─────────────────────┤       │
    │ PK  id              │◄────────│ PK  id              │       │
    │ FK  lot_id          │────────►│     name            │       │
    │ FK  car_id (null)   │    N:1  │     address         │       │
    │ FK  user_id (null)  │         │     city            │       │
    │     plate           │         │     capacity        │       │
    │     entry_time      │         │     hourly_rate     │       │
    │     exit_time       │         │     is_active       │       │
    │     entry_confidence│         │     latitude        │       │
    │     exit_confidence │         │     longitude       │       │
    │     duration_minutes│         │     created_at      │       │
    │     amount_charged  │         └─────────────────────┘       │
    │     status          │                                       │
    │     is_force_checkout│                                      │
    │     created_at      │                                       │
    └──────────┬──────────┘                                       │
               │                                                  │
               │ 1:N                                              │
               ▼                                                  │
    ┌─────────────────────┐                                       │
    │    transactions     │                                       │
    ├─────────────────────┤                                       │
    │ PK  id              │                                       │
    │ FK  user_id         │───────────────────────────────────────┘
    │ FK  session_id      │
    │     type            │  (payment | top_up | refund | penalty)
    │     amount          │
    │     balance_after   │
    │     description     │
    │     created_at      │
    └─────────────────────┘
```

### Table Definitions

#### profiles
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, FK→auth.users | Links to Supabase Auth |
| username | text | UNIQUE, NOT NULL | Display name |
| email | text | UNIQUE | User email |
| phone | text | | Contact number |
| is_admin | boolean | DEFAULT false | Role flag |
| credit_balance | numeric | DEFAULT 0.00 | Wallet balance |
| first_name | text | | |
| last_name | text | | |
| created_at | timestamptz | DEFAULT now() | |

#### cars
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | integer | PK, SERIAL | |
| user_id | uuid | FK→profiles, NOT NULL | Owner |
| license_plate | text | NOT NULL | Plate number |
| brand | text | | Car brand |
| model | text | | Car model |
| color | text | | Car color |
| owner_priority | smallint | CHECK 1-3, DEFAULT 1 | Billing priority |
| is_primary | boolean | DEFAULT false | Primary vehicle flag |
| created_at | timestamptz | DEFAULT now() | |

#### parking_lots
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | integer | PK, SERIAL | |
| name | text | UNIQUE, NOT NULL | Lot name |
| address | text | | Street address |
| city | text | | City |
| capacity | integer | CHECK > 0, NOT NULL | Total spots |
| hourly_rate | numeric | CHECK >= 0, DEFAULT 1.00 | $/hour |
| is_active | boolean | DEFAULT true | Soft delete flag |
| latitude | numeric | | GPS lat |
| longitude | numeric | | GPS long |
| created_at | timestamptz | DEFAULT now() | |

#### parking_sessions
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | integer | PK, SERIAL | |
| lot_id | integer | FK→parking_lots, NOT NULL | |
| car_id | integer | FK→cars, NULLABLE | Matched car |
| plate | text | NOT NULL | Scanned plate |
| user_id | uuid | FK→profiles, NULLABLE | Charged user |
| entry_time | timestamptz | DEFAULT now() | |
| exit_time | timestamptz | NULLABLE | NULL = still parked |
| entry_confidence | real | | ALPR confidence |
| exit_confidence | real | | ALPR confidence |
| duration_minutes | integer | | Calculated on exit |
| amount_charged | numeric | | Final charge |
| status | text | CHECK (active, completed) | |
| is_force_checkout | boolean | DEFAULT false | Manual checkout flag |
| created_at | timestamptz | DEFAULT now() | |

#### transactions
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | integer | PK, SERIAL | |
| user_id | uuid | FK→profiles, NOT NULL | |
| session_id | integer | FK→parking_sessions | |
| type | text | CHECK (payment, top_up, refund, penalty) | |
| amount | numeric | NOT NULL | +/- value |
| balance_after | numeric | NOT NULL | Running balance |
| description | text | | Human-readable |
| created_at | timestamptz | DEFAULT now() | |

---

## 6. Core Use Cases

### Use Case Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              USE CASE DIAGRAM                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────────────────────┐
                    │         PARKING LOT SYSTEM              │
                    └─────────────────────────────────────────┘

     ┌─────────┐                                              ┌─────────┐
     │  ADMIN  │                                              │  USER   │
     └────┬────┘                                              └────┬────┘
          │                                                        │
          │    ┌─────────────────────────────────────────┐         │
          ├───►│         Manage Parking Lots             │         │
          │    │  • Create lot                           │         │
          │    │  • Update lot details                   │         │
          │    │  • Deactivate lot                       │         │
          │    └─────────────────────────────────────────┘         │
          │                                                        │
          │    ┌─────────────────────────────────────────┐         │
          ├───►│         Process Vehicle Entry           │         │
          │    │  • Scan license plate                   │         │
          │    │  • Validate capacity                    │         │
          │    │  • Create parking session               │         │
          │    └─────────────────────────────────────────┘         │
          │                                                        │
          │    ┌─────────────────────────────────────────┐         │
          ├───►│         Process Vehicle Exit            │         │
          │    │  • Scan license plate                   │         │
          │    │  • Calculate charges                    │         │
          │    │  • Process payment                      │         │
          │    └─────────────────────────────────────────┘         │
          │                                                        │
          │    ┌─────────────────────────────────────────┐         │
          ├───►│         Force Checkout                  │         │
          │    │  • Manual session closure               │         │
          │    │  • Override billing                     │         │
          │    └─────────────────────────────────────────┘         │
          │                                                        │
          │    ┌─────────────────────────────────────────┐         │
          ├───►│         View All Sessions               │◄────────┤ (own only)
          │    └─────────────────────────────────────────┘         │
          │                                                        │
          │    ┌─────────────────────────────────────────┐         │
          ├───►│         View Lot Status                 │◄────────┤
          │    │  • Real-time occupancy                  │         │
          │    │  • Available spots                      │         │
          │    └─────────────────────────────────────────┘         │
          │                                                        │
          │    ┌─────────────────────────────────────────┐         │
          └───►│         View Active Vehicles            │         │
               │  • Currently parked cars                │         │
               └─────────────────────────────────────────┘         │
                                                                   │
               ┌─────────────────────────────────────────┐         │
               │         Register Vehicle                │◄────────┤
               │  • Link plate to account                │         │
               │  • Set owner priority                   │         │
               └─────────────────────────────────────────┘         │
                                                                   │
               ┌─────────────────────────────────────────┐         │
               │         Manage Account                  │◄────────┤
               │  • View balance                         │         │
               │  • Top up credits                       │         │
               │  • View transaction history             │         │
               └─────────────────────────────────────────┘         │
                                                                   │
               ┌─────────────────────────────────────────┐         │
               │         Authentication                  │◄────────┘
               │  • Sign up                              │
               │  • Login                                │
               │  • Logout                               │
               └─────────────────────────────────────────┘
```

---

## 7. Sequence Diagrams

### 7.1 Vehicle Entry Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        SEQUENCE DIAGRAM: VEHICLE ENTRY                           │
└─────────────────────────────────────────────────────────────────────────────────┘

┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐
│ Camera │    │  API   │    │ Redis  │    │Supabase│    │profiles│    │sessions│
└───┬────┘    └───┬────┘    └───┬────┘    └───┬────┘    └───┬────┘    └───┬────┘
    │             │             │             │             │             │
    │ POST /parking/{lot}/entry │             │             │             │
    │ {plate: "ABC123"}         │             │             │             │
    │────────────────────────────►            │             │             │
    │             │             │             │             │             │
    │             │ check_duplicate_entry     │             │             │
    │             │ (plate, lot_id)           │             │             │
    │             │────────────►│             │             │             │
    │             │             │             │             │             │
    │             │◄────────────│             │             │             │
    │             │ false (not duplicate)     │             │             │
    │             │             │             │             │             │
    │             │ SELECT * FROM parking_sessions          │             │
    │             │ WHERE plate='ABC123' AND status='active'│             │
    │             │──────────────────────────►│             │             │
    │             │             │             │             │             │
    │             │◄──────────────────────────│             │             │
    │             │ [] (no active session)    │             │             │
    │             │             │             │             │             │
    │             │ SELECT capacity FROM parking_lots       │             │
    │             │──────────────────────────►│             │             │
    │             │             │             │             │             │
    │             │◄──────────────────────────│             │             │
    │             │ capacity: 100             │             │             │
    │             │             │             │             │             │
    │             │ COUNT(*) FROM parking_sessions WHERE active           │
    │             │──────────────────────────────────────────────────────►│
    │             │             │             │             │             │
    │             │◄──────────────────────────────────────────────────────│
    │             │ count: 45 (under capacity)│             │             │
    │             │             │             │             │             │
    │             │ SELECT * FROM cars WHERE license_plate='ABC123'       │
    │             │──────────────────────────►│             │             │
    │             │             │             │             │             │
    │             │◄──────────────────────────│             │             │
    │             │ {car_id: 5, user_id: 'uuid-123'}        │             │
    │             │             │             │             │             │
    │             │ INSERT INTO parking_sessions            │             │
    │             │ (lot_id, plate, car_id, user_id, status='active')     │
    │             │──────────────────────────────────────────────────────►│
    │             │             │             │             │             │
    │             │◄──────────────────────────────────────────────────────│
    │             │ session_id: 42            │             │             │
    │             │             │             │             │             │
    │             │ mark_plate_seen           │             │             │
    │             │ (plate, lot_id, TTL=5s)   │             │             │
    │             │────────────►│             │             │             │
    │             │             │             │             │             │
    │             │ invalidate_lot(lot_id)    │             │             │
    │             │────────────►│             │             │             │
    │             │             │             │             │             │
    │◄────────────│             │             │             │             │
    │ 201 Created │             │             │             │             │
    │ {session}   │             │             │             │             │
    │             │             │             │             │             │
```

### 7.2 Vehicle Exit Flow with Payment

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    SEQUENCE DIAGRAM: VEHICLE EXIT & PAYMENT                      │
└─────────────────────────────────────────────────────────────────────────────────┘

┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐
│ Camera │    │  API   │    │sessions│    │  cars  │    │profiles│    │ trans  │
└───┬────┘    └───┬────┘    └───┬────┘    └───┬────┘    └───┬────┘    └───┬────┘
    │             │             │             │             │             │
    │ POST /parking/{lot}/exit  │             │             │             │
    │ ?plate=ABC123             │             │             │             │
    │────────────────────────────►            │             │             │
    │             │             │             │             │             │
    │             │ SELECT * FROM parking_sessions          │             │
    │             │ WHERE plate='ABC123' AND status='active'│             │
    │             │────────────►│             │             │             │
    │             │             │             │             │             │
    │             │◄────────────│             │             │             │
    │             │ {id:42, entry_time: 10:00}│             │             │
    │             │             │             │             │             │
    │             │ Calculate charge:         │             │             │
    │             │ exit_time=12:15 - entry=10:00           │             │
    │             │ = 2.25 hrs → ceil() = 3 hrs             │             │
    │             │ amount = 3 × $2.00 = $6.00              │             │
    │             │             │             │             │             │
    │             │ UPDATE parking_sessions   │             │             │
    │             │ SET exit_time, amount=$6, status='completed'          │
    │             │────────────►│             │             │             │
    │             │             │             │             │             │
    │             │ ═══════════════════════════════════════════════════   │
    │             │ ║      CHARGE OWNERS BY PRIORITY        ║             │
    │             │ ═══════════════════════════════════════════════════   │
    │             │             │             │             │             │
    │             │ SELECT * FROM cars WHERE plate='ABC123' │             │
    │             │ ORDER BY owner_priority   │             │             │
    │             │──────────────────────────►│             │             │
    │             │             │             │             │             │
    │             │◄──────────────────────────│             │             │
    │             │ [{user_id: A, priority: 1},             │             │
    │             │  {user_id: B, priority: 2}]             │             │
    │             │             │             │             │             │
    │             │ SELECT credit_balance FROM profiles     │             │
    │             │ WHERE id = user_A         │             │             │
    │             │────────────────────────────────────────►│             │
    │             │             │             │             │             │
    │             │◄────────────────────────────────────────│             │
    │             │ balance: $2.00 (insufficient)           │             │
    │             │             │             │             │             │
    │             │ SELECT credit_balance FROM profiles     │             │
    │             │ WHERE id = user_B         │             │             │
    │             │────────────────────────────────────────►│             │
    │             │             │             │             │             │
    │             │◄────────────────────────────────────────│             │
    │             │ balance: $10.00 (sufficient!)           │             │
    │             │             │             │             │             │
    │             │ UPDATE profiles SET balance = $4.00     │             │
    │             │ WHERE id = user_B         │             │             │
    │             │────────────────────────────────────────►│             │
    │             │             │             │             │             │
    │             │ INSERT INTO transactions  │             │             │
    │             │ (user_B, session_42, -$6, 'payment')    │             │
    │             │────────────────────────────────────────────────────────►
    │             │             │             │             │             │
    │◄────────────│             │             │             │             │
    │ 200 OK      │             │             │             │             │
    │ {session}   │             │             │             │             │
```

### 7.3 Multi-Owner Payment Priority Algorithm

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    FLOWCHART: OWNER PRIORITY BILLING                             │
└─────────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │  Vehicle Exits  │
                              │  Amount = $X    │
                              └────────┬────────┘
                                       │
                                       ▼
                         ┌─────────────────────────┐
                         │ Get owners ordered by   │
                         │ priority (1 → 2 → 3)    │
                         └────────────┬────────────┘
                                      │
                                      ▼
                         ┌─────────────────────────┐
                         │   owners.length > 0?    │
                         └────────────┬────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │ NO              │                 │ YES
                    ▼                 │                 ▼
        ┌───────────────────┐        │     ┌───────────────────────┐
        │ No owner found    │        │     │ For each owner        │
        │ (unregistered car)│        │     │ in priority order     │
        │ → No charge       │        │     └───────────┬───────────┘
        └───────────────────┘        │                 │
                                     │                 ▼
                                     │     ┌───────────────────────┐
                                     │     │ owner.balance >= $X?  │
                                     │     └───────────┬───────────┘
                                     │                 │
                                     │    ┌────────────┼────────────┐
                                     │    │ YES        │            │ NO
                                     │    ▼            │            ▼
                                     │  ┌─────────────────┐   ┌─────────────┐
                                     │  │ Charge this     │   │ Try next    │
                                     │  │ owner           │   │ owner       │
                                     │  │                 │   │             │
                                     │  │ balance -= $X   │   └──────┬──────┘
                                     │  │ Create txn      │          │
                                     │  │ DONE ✓          │          │
                                     │  └─────────────────┘          │
                                     │                               │
                                     │                               ▼
                                     │                   ┌───────────────────────┐
                                     │                   │  More owners left?    │
                                     │                   └───────────┬───────────┘
                                     │                               │
                                     │              ┌────────────────┼────────────┐
                                     │              │ YES            │            │ NO
                                     │              │ (loop)         │            ▼
                                     │              │                │  ┌─────────────────────┐
                                     │              │                │  │ ALL owners have     │
                                     │              │                │  │ insufficient balance│
                                     │              │                │  │                     │
                                     │              │                │  │ Charge PRIMARY      │
                                     │              │                │  │ owner anyway        │
                                     │              │                │  │ (balance goes       │
                                     │              │                │  │  NEGATIVE)          │
                                     │              │                │  └─────────────────────┘
                                     │              │                │
                                     └──────────────┴────────────────┘
```

---

## 8. API Endpoints

### Authentication (`/auth`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/signup` | None | Register new user |
| POST | `/auth/login` | None | Get JWT tokens |
| POST | `/auth/refresh` | None | Refresh access token |
| POST | `/auth/logout` | User | Sign out |
| GET | `/auth/me` | User | Get current user profile |
| POST | `/auth/password/reset` | None | Request password reset |
| POST | `/auth/password/update` | User | Update password |

### Parking Lots (`/lots`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/lots/` | Admin | Create parking lot |
| GET | `/lots/` | User | List parking lots |
| GET | `/lots/{id}` | User | Get lot details |
| PUT | `/lots/{id}` | Admin | Update lot |
| DELETE | `/lots/{id}` | Admin | Deactivate lot |
| GET | `/lots/{id}/status` | User | Get occupancy status |
| GET | `/lots/{id}/active` | Admin | List parked vehicles |

### Parking Sessions (`/parking`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/parking/{lot_id}/entry` | Admin | Record vehicle entry |
| POST | `/parking/{lot_id}/exit` | Admin | Record vehicle exit |
| POST | `/parking/sessions/{id}/force-checkout` | Admin | Force close session |
| GET | `/parking/sessions` | Admin | List all sessions |
| GET | `/parking/my-sessions` | User | List own sessions |
| GET | `/parking/my-active-session` | User | Get current active session |

---

## 9. Caching Strategy

### Redis Cache Keys

| Key Pattern | TTL | Purpose | Invalidation Trigger |
|-------------|-----|---------|---------------------|
| `lot_status:{lot_id}` | 5 min | Cached occupancy stats | Entry/exit/force-checkout |
| `active_sessions:{lot_id}` | 5 min | List of active sessions | Entry/exit/force-checkout |
| `plate_seen:{plate}:{lot_id}` | 5 sec | Duplicate entry prevention | Auto-expire |
| `user_session:{user_id}` | 5 min | User's active session | Exit/checkout |

### Cache Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CACHING STRATEGY                                       │
└─────────────────────────────────────────────────────────────────────────────────┘

    Request: GET /lots/{id}/status
                    │
                    ▼
           ┌───────────────┐
           │ Check Redis   │
           │ lot_status:42 │
           └───────┬───────┘
                   │
        ┌──────────┴──────────┐
        │                     │
   CACHE HIT             CACHE MISS
        │                     │
        ▼                     ▼
   ┌─────────┐        ┌─────────────┐
   │ Return  │        │ Query       │
   │ cached  │        │ Supabase    │
   │ data    │        └──────┬──────┘
   └─────────┘               │
                             ▼
                      ┌─────────────┐
                      │ Store in    │
                      │ Redis       │
                      │ TTL = 5min  │
                      └──────┬──────┘
                             │
                             ▼
                      ┌─────────────┐
                      │ Return data │
                      └─────────────┘


    Event: Vehicle Entry/Exit
                    │
                    ▼
           ┌───────────────────┐
           │ invalidate_lot()  │
           │                   │
           │ DELETE:           │
           │ • lot_status:42   │
           │ • active_sessions │
           └───────────────────┘
```

---

## 10. Business Rules

### Billing Rules

| Rule | Implementation |
|------|----------------|
| Hourly billing | `ceil(duration_hours)` - Always rounded UP |
| Minimum charge | 1 hour minimum (even for 1 minute) |
| Multi-owner priority | Owners charged in priority order 1→2→3 |
| Insufficient funds | Primary owner charged anyway (negative balance) |
| Grace period | None (system is strict) |

### Operational Rules

| Rule | Implementation |
|------|----------------|
| Duplicate prevention | Same plate blocked for 5 seconds (Redis TTL) |
| Double parking | Cannot enter same lot twice without exiting |
| Capacity enforcement | Entry rejected if lot is full |
| Soft delete | Lots are deactivated, not deleted |
| Active lot deletion | Cannot deactivate lot with parked vehicles |

### Data Integrity Rules

| Rule | Enforcement |
|------|-------------|
| Unique lot names | Database UNIQUE constraint |
| Unique usernames | Database UNIQUE constraint |
| Valid capacity | Database CHECK (capacity > 0) |
| Valid hourly rate | Database CHECK (hourly_rate >= 0) |
| Valid session status | Database CHECK ('active', 'completed') |
| Valid transaction type | Database CHECK ('payment', 'top_up', 'refund', 'penalty') |
| Owner priority range | Database CHECK (1-3) |

---

## Appendix: File Structure Reference

```
app/
├── config.py              # Environment configuration
├── security.py            # JWT verification, auth dependencies
├── supabase_client.py     # Supabase client singleton
├── cache.py               # Redis cache manager
├── webcam_alpr.py         # ALPR camera integration
└── routers/
    ├── auth.py            # Authentication endpoints
    ├── parking.py         # Parking session management
    ├── parking_lot.py     # Lot CRUD operations
    ├── car.py             # Vehicle registration
    └── admin.py           # Admin operations

frontend/src/
├── contexts/
│   ├── AuthContext.tsx    # Auth state management
│   └── LotContext.tsx     # Lot state management
├── services/
│   └── api.ts             # API client with auth
├── screens/               # UI screens
├── navigation/            # React Navigation setup
├── types/                 # TypeScript interfaces
└── constants/             # App configuration
```

---

## Appendix B: Running the ALPR Camera

The camera script runs **outside Docker** on the host machine (requires webcam access).

### Installation (Host Machine)

```bash
# Install camera dependencies (OpenCV with GUI)
pip install -r requirements-camera.txt
```

### Running the Camera

```bash
# Basic usage with authentication
python -m app.webcam_alpr --email admin@example.com --password secret --lot-id 1

# Entry-only mode (camera at entrance)
python -m app.webcam_alpr -e admin@example.com -p secret -l 1 --mode entry

# Exit-only mode (camera at exit gate)
python -m app.webcam_alpr -e admin@example.com -p secret -l 1 --mode exit

# Auto mode (default) - detects entry/exit based on active sessions
python -m app.webcam_alpr -e admin@example.com -p secret -l 1 --mode auto
```

### Camera CLI Options

| Flag | Description | Default |
|------|-------------|---------|
| `-e, --email` | Admin email | `$ALPR_ADMIN_EMAIL` |
| `-p, --password` | Admin password | `$ALPR_ADMIN_PASSWORD` |
| `-l, --lot-id` | Parking lot ID | `1` |
| `-m, --mode` | `auto`, `entry`, or `exit` | `auto` |
| `-c, --camera` | Camera device index | `0` |
| `-u, --api-url` | API base URL | `http://127.0.0.1:8000` |
| `-C, --confidence` | Min detection confidence | `0.7` |

### Keyboard Controls

| Key | Action |
|-----|--------|
| `q` | Quit and end session |
| `s` | Take screenshot |

---

*Document generated for License Plate Recognition Parking System v1.0*
