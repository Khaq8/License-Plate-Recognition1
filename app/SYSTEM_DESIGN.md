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
9. [Redis Architecture](#9-redis-architecture)
10. [Reliability Queue System](#10-reliability-queue-system)
11. [Business Rules](#11-business-rules)
12. [Deployment & Infrastructure](#12-deployment--infrastructure)

---

## 1. System Overview

The License Plate Recognition (LPR) Parking System is a full-stack application that automates parking lot management using computer vision for license plate detection. The system handles vehicle entry/exit tracking, automated billing, multi-owner payment prioritization, and real-time occupancy monitoring.

### Key Features
- Automatic license plate recognition (ALPR) via camera integration
- Real-time parking lot occupancy tracking
- Multi-owner vehicle support with priority-based billing
- Credit balance management with transaction history
- Admin dashboard for lot management and manual interventions
- Mobile app for users to monitor parking sessions and activity history
- **Redis-based reliability queue** for failed detection recovery
- **Background worker** for automatic retry of failed API calls

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌──────────────────────┐              ┌──────────────────────┐                │
│   │   React Native App   │              │    ALPR Camera       │                │
│   │   (Expo + TypeScript)│              │    (webcam_alpr.py)  │                │
│   │                      │              │                      │                │
│   │  • AuthContext       │              │  • OpenCV            │                │
│   │  • LotContext        │              │  • fast-alpr         │                │
│   │  • Navigation        │              │  • ONNX Runtime      │                │
│   │  • Activity Screen   │              │  • Redis Queue       │                │
│   └──────────┬───────────┘              └──────────┬───────────┘                │
│              │                                     │                             │
└──────────────┼─────────────────────────────────────┼─────────────────────────────┘
               │ HTTPS (JWT Auth)                    │ HTTP + Redis
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
│   │   │ auth.py     │  │ parking.py  │  │parking_lot.py│ │  admin.py   │    │   │
│   │   │             │  │             │  │             │  │             │    │   │
│   │   │ • signup    │  │ • entry     │  │ • CRUD lots │  │ • users     │    │   │
│   │   │ • login     │  │ • exit      │  │ • status    │  │ • queue     │    │   │
│   │   │ • refresh   │  │ • force-out │  │ • active    │  │   status    │    │   │
│   │   │ • logout    │  │ • sessions  │  │   vehicles  │  │ • billing   │    │   │
│   │   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │   │
│   │                                                                          │   │
│   │   ┌─────────────────────────────────────────────────────────────────┐   │   │
│   │   │                     Background Workers                          │   │   │
│   │   │  • retry_worker.py - Processes failed detections from Redis     │   │   │
│   │   │  • Runs as asyncio task within FastAPI lifespan                 │   │   │
│   │   └─────────────────────────────────────────────────────────────────┘   │   │
│   │                                                                          │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└──────────────────────────────┬──────────────────────────┬────────────────────────┘
                               │                          │
                               ▼                          ▼
┌──────────────────────────────────────────┐  ┌────────────────────────────────────┐
│           CACHE LAYER (Redis)            │  │         DATA LAYER                 │
├──────────────────────────────────────────┤  ├────────────────────────────────────┤
│                                          │  │                                    │
│   ┌──────────────────────────────────┐   │  │   ┌────────────────────────────┐   │
│   │         CACHING                  │   │  │   │     Supabase               │   │
│   │                                  │   │  │   │                            │   │
│   │  • lot:{id}:status       30s     │   │  │   │  ┌──────────────────────┐  │   │
│   │  • lot:{id}:active_sessions 60s  │   │  │   │  │   PostgreSQL DB      │  │   │
│   │  • plate:{plate}:last_seen  5s   │   │  │   │  │   (with RLS)         │  │   │
│   │  • user:{id}:active_session 4hr  │   │  │   │  └──────────────────────┘  │   │
│   │  • user:{id}:activity      5min  │   │  │   │                            │   │
│   └──────────────────────────────────┘   │  │   │  ┌──────────────────────┐  │   │
│                                          │  │   │  │   Supabase Auth      │  │   │
│   ┌──────────────────────────────────┐   │  │   │  │   (JWT Provider)     │  │   │
│   │         QUEUES                   │   │  │   │  └──────────────────────┘  │   │
│   │                                  │   │  │   │                            │   │
│   │  • queue:pending_entries         │   │  │   └────────────────────────────┘   │
│   │  • queue:pending_exits           │   │  │                                    │
│   │  • queue:failed_detections       │   │  │                                    │
│   │    (dead letter queue)           │   │  │                                    │
│   └──────────────────────────────────┘   │  │                                    │
│                                          │  │                                    │
└──────────────────────────────────────────┘  └────────────────────────────────────┘
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
| Caching | Redis (async) | Session caching, duplicate detection |
| Queuing | Redis Lists | Reliability queue for failed detections |
| Background Worker | asyncio Task | Retry failed API calls automatically |
| Computer Vision | OpenCV + fast-alpr + ONNX | License plate recognition |

### Frontend
| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | React Native (Expo) | Cross-platform mobile app |
| Language | TypeScript | Type-safe JavaScript |
| State Management | React Context API | AuthContext, LotContext |
| Styling | NativeWind (Tailwind) | Utility-first CSS |
| Secure Storage | expo-secure-store | JWT token storage |
| Navigation | React Navigation | Stack + Tab navigation |

### Infrastructure
| Component | Technology | Purpose |
|-----------|------------|---------|
| Containerization | Docker + Docker Compose | Consistent deployment |
| API Container | Python 3.12 + FastAPI | Backend service |
| Cache Container | Redis 7 Alpine | Caching and queuing |
| Database | Supabase (hosted) | Managed PostgreSQL |

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
│  USER MANAGEMENT                                                 │
│  • View all users with details                                   │
│  • Top up user credit balance                                    │
│  • Charge users manually                                         │
│  • Grant/revoke admin status                                     │
├─────────────────────────────────────────────────────────────────┤
│  QUEUE MONITORING                                                │
│  • View queue status (pending entries/exits)                     │
│  • View failed detections (dead letter queue)                    │
│  • Clear failed detections after review                          │
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
│  • View own parking session history (Activity tab)               │
│  • View current active parking session                           │
│  • Register vehicles to account                                  │
│  • Manage credit balance                                         │
│  • View transaction history                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Mobile App Navigation by Role

| Tab | Admin | User |
|-----|-------|------|
| Home (Dashboard) | Yes | Yes |
| Log (All Sessions) | Yes | No |
| Activity (My Sessions) | No | Yes |
| Users (Management) | Yes | No |
| Settings | Yes | Yes |

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
          │    │  • Scan license plate (camera)          │         │
          │    │  • Validate capacity                    │         │
          │    │  • Create parking session               │         │
          │    │  • Queue on failure (Redis)             │         │
          │    └─────────────────────────────────────────┘         │
          │                                                        │
          │    ┌─────────────────────────────────────────┐         │
          ├───►│         Process Vehicle Exit            │         │
          │    │  • Scan license plate (camera)          │         │
          │    │  • Calculate charges                    │         │
          │    │  • Process payment (priority billing)   │         │
          │    │  • Queue on failure (Redis)             │         │
          │    └─────────────────────────────────────────┘         │
          │                                                        │
          │    ┌─────────────────────────────────────────┐         │
          ├───►│         Monitor Queue Status            │         │
          │    │  • View pending entries/exits           │         │
          │    │  • View failed detections               │         │
          │    │  • Clear dead letter queue              │         │
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
               ┌─────────────────────────────────────────┐         │
               │         View Activity History           │◄────────┤
               │  • My parking sessions                  │         │
               │  • Entry/exit times                     │         │
               │  • Charges and duration                 │         │
               └─────────────────────────────────────────┘         │
                                                                   │
               ┌─────────────────────────────────────────┐         │
               │         Register Vehicle                │◄────────┤
               │  • Link plate to account                │         │
               │  • Set owner priority                   │         │
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

### 7.1 Vehicle Entry Flow (with Reliability Queue)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                   SEQUENCE DIAGRAM: VEHICLE ENTRY WITH QUEUE                     │
└─────────────────────────────────────────────────────────────────────────────────┘

┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐
│ Camera │    │  API   │    │ Redis  │    │Supabase│    │ Queue  │    │ Worker │
└───┬────┘    └───┬────┘    └───┬────┘    └───┬────┘    └───┬────┘    └───┬────┘
    │             │             │             │             │             │
    │ POST /parking/{lot}/entry │             │             │             │
    │ {plate: "ABC123"}         │             │             │             │
    │────────────────────────────►            │             │             │
    │             │             │             │             │             │
    │             │ ═══════════════════════════════════════════════════════
    │             │ ║               SUCCESS PATH                          ║
    │             │ ═══════════════════════════════════════════════════════
    │             │             │             │             │             │
    │             │ check_duplicate           │             │             │
    │             │────────────►│             │             │             │
    │             │◄────────────│ OK          │             │             │
    │             │             │             │             │             │
    │             │ INSERT parking_session    │             │             │
    │             │──────────────────────────►│             │             │
    │             │◄──────────────────────────│ session_id  │             │
    │             │             │             │             │             │
    │             │ set_user_active_session   │             │             │
    │             │────────────►│ (4hr TTL)   │             │             │
    │             │             │             │             │             │
    │◄────────────│ 201 Created │             │             │             │
    │             │             │             │             │             │
    │             │ ═══════════════════════════════════════════════════════
    │             │ ║               FAILURE PATH                          ║
    │             │ ═══════════════════════════════════════════════════════
    │             │             │             │             │             │
    │ POST fails  │             │             │             │             │
    │ (timeout/auth/500)        │             │             │             │
    │─────────────X             │             │             │             │
    │             │             │             │             │             │
    │ Queue to Redis            │             │             │             │
    │────────────────────────────────────────────────────────►            │
    │             │             │             │ LPUSH       │             │
    │             │             │             │ pending_entries           │
    │◄────────────│             │             │             │ ✓ Queued    │
    │ "Queued"    │             │             │             │             │
    │             │             │             │             │             │
    │             │             │    (every 30 seconds)     │             │
    │             │             │             │             │◄────────────│
    │             │             │             │             │ RPOP        │
    │             │             │             │             │────────────►│
    │             │             │             │             │ detection   │
    │             │             │             │             │             │
    │             │             │             │◄────────────────────────────
    │             │             │             │ INSERT (retry)            │
    │             │             │             │────────────────────────────►
    │             │             │             │             │ Success!    │
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
| GET | `/parking/sessions` | Admin | List all sessions (with details) |
| GET | `/parking/my-sessions` | User | List own sessions (basic) |
| GET | `/parking/my-sessions-detailed` | User | List own sessions (with lot/car details) |
| GET | `/parking/my-active-session` | User | Get current active session |

### Admin (`/admin`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/admin/users` | Admin | List all users with details |
| GET | `/admin/users/{id}/sessions` | Admin | Get user's parking history |
| POST | `/admin/users/{id}/charge` | Admin | Manually charge user |
| POST | `/admin/users/{id}/top-up` | Admin | Add credit to user |
| PUT | `/admin/users/{id}/admin-status` | Admin | Grant/revoke admin |
| GET | `/admin/lots/{id}/active-users` | Admin | Users parked in lot |
| GET | `/admin/queue/status` | Admin | Get queue lengths + worker stats |
| GET | `/admin/queue/failed` | Admin | View failed detections |
| DELETE | `/admin/queue/failed` | Admin | Clear failed detections |

### Cars (`/cars`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/cars/` | User | Register new car |
| GET | `/cars/` | User | List own cars |
| GET | `/cars/{id}` | User | Get car details |
| PUT | `/cars/{id}` | User | Update car |
| DELETE | `/cars/{id}` | User | Delete car |
| POST | `/cars/{id}/primary` | User | Set as primary car |

---

## 9. Redis Architecture

### Cache Keys

| Key Pattern | TTL | Purpose | Invalidation Trigger |
|-------------|-----|---------|---------------------|
| `lot:{lot_id}:status` | 30s | Cached occupancy stats | Entry/exit/force-checkout |
| `lot:{lot_id}:active_sessions` | 60s | List of active sessions | Entry/exit/force-checkout |
| `plate:{plate}:last_seen:{lot_id}` | 5s | Duplicate entry prevention | Auto-expire |
| `user:{user_id}:active_session` | 4hr | User's current parking session | Exit/checkout |
| `user:{user_id}:activity` | 5min | User's session history (Activity tab) | Entry/exit |

### Queue Keys

| Key | Purpose | Processor |
|-----|---------|-----------|
| `queue:pending_entries` | Failed entry detections awaiting retry | retry_worker |
| `queue:pending_exits` | Failed exit detections awaiting retry | retry_worker |
| `queue:failed_detections` | Dead letter queue (exceeded max retries) | Manual review |

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
           │ lot:42:status │
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
   │ (~1ms)  │        │ (~50ms)     │
   └─────────┘        └──────┬──────┘
                             │
                             ▼
                      ┌─────────────┐
                      │ Store in    │
                      │ Redis       │
                      │ TTL = 30s   │
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
           │ • lot:{id}:status │
           │ • lot:{id}:active │
           │ • user:{id}:activity
           └───────────────────┘
```

---

## 10. Reliability Queue System

### Purpose

The reliability queue ensures no parking detections are lost due to:
- Network timeouts
- API server restarts
- Authentication token expiration
- Database connection issues

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        RELIABILITY QUEUE ARCHITECTURE                            │
└─────────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────────┐
    │                         CAMERA (webcam_alpr.py)                          │
    └─────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      │ Detect plate
                                      ▼
                              ┌───────────────┐
                              │ POST /entry   │
                              │ or /exit      │
                              └───────┬───────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │ Success                          │ Failure
                    ▼                                  ▼
            ┌───────────────┐                 ┌───────────────────┐
            │ Normal flow   │                 │ Queue to Redis    │
            │ (Supabase)    │                 │ (LPUSH)           │
            └───────────────┘                 └─────────┬─────────┘
                                                        │
                                                        ▼
                                              ┌───────────────────┐
                                              │ pending_entries   │
                                              │ pending_exits     │
                                              │ (Redis List)      │
                                              └─────────┬─────────┘
                                                        │
                                                        │ Every 30 seconds
                                                        ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                     RETRY WORKER (background task)                       │
    │                                                                          │
    │   1. RPOP from queue (FIFO)                                             │
    │   2. Attempt to process detection                                        │
    │   3. Success → Done                                                      │
    │   4. Failure → Increment retry_count                                     │
    │      - retry_count <= 5 → Re-queue (LPUSH)                              │
    │      - retry_count > 5  → Move to failed_detections (dead letter)       │
    │                                                                          │
    └─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Exceeded retries
                                      ▼
                              ┌───────────────────┐
                              │ failed_detections │
                              │ (Dead Letter)     │
                              └─────────┬─────────┘
                                        │
                                        │ Admin reviews via
                                        │ GET /admin/queue/failed
                                        ▼
                              ┌───────────────────┐
                              │ Manual action or  │
                              │ DELETE to clear   │
                              └───────────────────┘
```

### Queue Data Structure

```json
// Detection in queue
{
  "plate": "ABC123",
  "confidence": 0.95,
  "lot_id": 1,
  "timestamp": "2024-01-03T10:30:00Z",
  "error_reason": "timeout",
  "queued_at": "2024-01-03T10:30:01Z",
  "retry_count": 0
}
```

### Configuration

| Parameter | Value | Description |
|-----------|-------|-------------|
| Retry Interval | 30 seconds | How often worker checks queues |
| Max Retries | 5 | Attempts before dead letter |
| Batch Size | 10 | Items processed per cycle |

---

## 11. Business Rules

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

## 12. Deployment & Infrastructure

### Docker Compose Architecture

```yaml
services:
  api:
    build: .
    ports: ["8000:8000"]
    depends_on: [redis]
    environment:
      - SUPABASE_URL
      - SUPABASE_ANON_KEY
      - SUPABASE_SERVICE_ROLE_KEY
      - REDIS_URL=redis://redis:6379

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes:
      - redis_data:/data
```

### Container Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DOCKER DEPLOYMENT                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────────┐
    │                           Docker Network                                 │
    │                                                                          │
    │   ┌─────────────────────────┐        ┌─────────────────────────┐        │
    │   │      api (FastAPI)      │        │    redis (Redis 7)      │        │
    │   │                         │        │                         │        │
    │   │  • Port 8000            │◄──────►│  • Port 6379            │        │
    │   │  • Python 3.12          │        │  • Persistence enabled  │        │
    │   │  • Uvicorn              │        │  • Alpine image         │        │
    │   │  • Retry Worker         │        │                         │        │
    │   │                         │        │                         │        │
    │   └───────────┬─────────────┘        └─────────────────────────┘        │
    │               │                                                          │
    └───────────────┼──────────────────────────────────────────────────────────┘
                    │
                    │ Port 8000 exposed
                    ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                          HOST MACHINE                                    │
    │                                                                          │
    │   ┌─────────────────────────┐        ┌─────────────────────────┐        │
    │   │    Mobile App (Expo)    │        │    ALPR Camera          │        │
    │   │                         │        │    (webcam_alpr.py)     │        │
    │   │  • http://localhost:8000│        │  • Requires webcam      │        │
    │   │                         │        │  • Runs outside Docker  │        │
    │   └─────────────────────────┘        └─────────────────────────┘        │
    │                                                                          │
    └─────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────────┐
    │                        EXTERNAL SERVICES                                 │
    │                                                                          │
    │   ┌─────────────────────────────────────────────────────────────────┐   │
    │   │                    Supabase (Hosted)                             │   │
    │   │                                                                  │   │
    │   │  • PostgreSQL Database                                          │   │
    │   │  • Supabase Auth (JWT)                                          │   │
    │   │  • Row Level Security                                           │   │
    │   │                                                                  │   │
    │   └─────────────────────────────────────────────────────────────────┘   │
    │                                                                          │
    └─────────────────────────────────────────────────────────────────────────┘
```

### Running the System

```bash
# Start backend services
docker-compose up -d

# Start mobile app (development)
cd frontend && bun expo start

# Start ALPR camera (on host, outside Docker)
python3 -m app.webcam_alpr \
  --email admin@example.com \
  --password yourpassword \
  --lot-id 1 \
  --mode entry
```

### Camera CLI Options

| Flag | Description | Default |
|------|-------------|---------|
| `-e, --email` | Admin email | Required |
| `-p, --password` | Admin password | Required |
| `-l, --lot-id` | Parking lot ID | `1` |
| `-m, --mode` | `auto`, `entry`, or `exit` | `auto` |
| `-c, --camera` | Camera device index | `0` |
| `-u, --api-url` | API base URL | `http://127.0.0.1:8000` |
| `-C, --confidence` | Min detection confidence | `0.7` |

---

## Appendix: File Structure Reference

```
License-Plate-Recognition/
├── app/
│   ├── config.py              # Environment configuration
│   ├── security.py            # JWT verification, auth dependencies
│   ├── supabase_client.py     # Supabase client singleton
│   ├── cache.py               # Redis cache manager + queues
│   ├── webcam_alpr.py         # ALPR camera + FastAPI app entry
│   ├── routers/
│   │   ├── auth.py            # Authentication endpoints
│   │   ├── parking.py         # Parking session management
│   │   ├── parking_lot.py     # Lot CRUD operations
│   │   ├── car.py             # Vehicle registration
│   │   ├── admin.py           # Admin + queue monitoring
│   │   └── user.py            # User profile endpoints
│   └── workers/
│       ├── __init__.py
│       └── retry_worker.py    # Background retry worker
│
├── frontend/src/
│   ├── contexts/
│   │   ├── AuthContext.tsx    # Auth state management
│   │   └── LotContext.tsx     # Lot state management
│   ├── services/
│   │   └── api.ts             # API client with auth
│   ├── screens/
│   │   ├── DashboardScreen.tsx
│   │   ├── LogScreen.tsx      # Admin: all sessions
│   │   ├── MyActivityScreen.tsx # User: own sessions
│   │   ├── SettingsScreen.tsx
│   │   └── UserManagementScreen.tsx
│   ├── navigation/
│   │   └── AppNavigator.tsx   # Role-based navigation
│   ├── types/
│   │   └── index.ts           # TypeScript interfaces
│   └── constants/
│       └── index.ts           # API URL, storage keys
│
├── docker-compose.yml         # Container orchestration
├── Dockerfile                 # API container build
├── requirements.txt           # Python dependencies
├── camera_config.json         # Lot ID mappings for camera
└── alpr_sessions/             # Local backup files (gitignored)
```

---

*Document Version 2.0 - License Plate Recognition Parking System*
*Last Updated: January 2026*
