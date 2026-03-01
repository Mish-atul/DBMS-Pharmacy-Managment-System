# Pharmacy Management System - Project Context

## 1. Project Overview
This is a full-stack web application for pharmacy management. It features:
- **User Authentication**: JWT-based auth with secure password hashing.
- **Medicine Inventory**: Large database of medicines with search and filtering.
- **Shopping Cart & Checkout**: Users can add medicines to a cart and place orders.
- **OCR Prescription Scanning**: Users can upload prescription images; the system extracts text (Tesseract.js) and maps it to inventory items using fuzzy matching.
- **AI Chatbot**: A "Dr. Bot" powered by Google Gemini (with fallback) to answer health questions.
- **Admin Dashboard**: For managing inventory (CRUD operations, stock adjustment).

## 2. Tech Stack

### Frontend
- **Framework**: React 19 (Vite)
- **Routing**: React Router DOM v7
- **Styling**: Vanilla CSS (App.css, index.css, page-specific CSS)
- **3D Graphics**: @splinetool/react-spline (for Chatbot UI)
- **Motion**: Framer Motion

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: SQLite3 (`pharmacy.db`)
- **ORM/Driver**: `sqlite3` driver (raw SQL queries)
- **Authentication**: `jsonwebtoken` (JWT), `bcrypt`
- **OCR**: `tesseract.js`
- **AI**: `@google/genai` (Gemini 2.5/1.5 Flash)
- **String Matching**: `string-similarity`

## 3. Database Schema
The database is SQLite (`server/pharmacy.db`).

### Tables

**1. users**
```sql
CREATE TABLE users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    username TEXT UNIQUE,
    password_hash TEXT,
    google_id TEXT UNIQUE,
    name TEXT,
    age INTEGER,
    health_problems TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user', -- 'user' or 'admin'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**2. medicines**
```sql
CREATE TABLE medicines (
    medicine_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    composition TEXT,
    uses TEXT,
    side_effects TEXT,
    image_url TEXT,
    manufacturer TEXT,
    quantity INTEGER DEFAULT 67,
    price REAL DEFAULT 420,
    excellent_review_pct REAL,
    average_review_pct REAL,
    poor_review_pct REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**3. cart_items**
```sql
CREATE TABLE cart_items (
    cart_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    medicine_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id),
    UNIQUE(user_id, medicine_id) -- Prevent duplicate rows for same item
);
```

**4. orders**
```sql
CREATE TABLE orders (
    order_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    total_amount REAL NOT NULL,
    status TEXT DEFAULT 'completed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);
```

**5. order_items**
```sql
CREATE TABLE order_items (
    order_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    medicine_id INTEGER NOT NULL,
    medicine_name TEXT,
    quantity INTEGER NOT NULL,
    price_at_purchase REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id)
);
```

## 4. Backend Architecture (`server/`)

### Configuration (`server/server.js`)
- **Port**: 3000 (default)
- **Static Files**: Serves `uploads/` directory.
- **Middleware**: CORS (allows frontend origin), BodyParser (JSON).

### Middleware (`server/middleware/auth.js`)
- `verifyToken`: Checks `Authorization: Bearer <token>`. Decodes JWT, attaches user to `req.user`.
- `requireRole(role)`: Ensures `req.user.role` matches (e.g., 'admin').
- `optionalAuth`: Checks token if present, but doesn't block request if missing (used for public search/OCR).

### API Routes

#### Authentication
- `POST /api/auth/register`: Creates user, returns JWT. Uses bcrypt for password hashing.
- `POST /api/auth/login`: Verifies credentials, returns JWT.

#### User Profile
- `GET /api/users/me`: Get current user details.
- `PUT /api/users/me`: Update name, age, health problems.
- `POST /api/users/me/avatar`: Upload avatar image (Multer storage).

#### Medicines
- `GET /api/medicines`: List medicines (limit 100), supports `?search=term`.
- `GET /api/medicines/search`: Public search endpoint.
- **Admin**:
    - `GET /api/admin/medicines`: Full list.
    - `POST /api/admin/medicines`: Create new.
    - `PUT /api/admin/medicines/:id`: Update details.
    - `DELETE /api/admin/medicines/:id`: Soft or hard delete (implementation dependent).
    - `PATCH /api/admin/medicines/:id/adjust-quantity`: Increment/decrement stock.
    - `PATCH /api/admin/medicines/:id/adjust-price`: Adjust price.

#### Cart & Checkout
- `GET /api/cart`: List cart items with total.
- `POST /api/cart`: Add item (validates stock).
- `PUT /api/cart/:id`: Update quantity.
- `DELETE /api/cart/:id`: Remove item.
- `DELETE /api/cart`: Clear cart.
- `POST /api/checkout`:
    1. Validates stock for all items.
    2. Creates `orders` record.
    3. Creates `order_items` records.
    4. **Decrements stock** in `medicines` table (Transaction).
    5. Clears cart.

#### OCR & AI
- `POST /api/ocr/scan`:
    1. Uploads image (`multer`).
    2. Runs `Tesseract.recognize` to get text.
    3. Normalizes text and tokenizes (words, bi-grams, tri-grams).
    4. **Fuzzy Match**: Compares tokens against *all* medicine names/compositions using `string-similarity`. Matches > 0.6 score are returned.
    5. Returns: Raw text, mapped matches (with confidence levels), and inventory status.
- `POST /api/chat`:
    - Uses Google Gemini API.
    - **Logic**: Tries Gemini 2.5 Flash -> Fallback to Gemini 1.5 Flash.

## 5. Frontend Architecture (`client/src/`)

### Structure
- `main.jsx`: Wraps App in `BrowserRouter` and `AuthProvider`.
- `App.jsx`: Defines routes.
    - Public: `/`, `/login`, `/signup`
    - Protected: `/dashboard`, `/cart`, `/account`, `/admin`, etc.
    - **Dashboard Component**: Handling inline views for 'medicines', 'upload' (OCR), 'chat'.

### State Management (`AuthContext.jsx`)
- Manages `user` object and `token`.
- Persists token in `localStorage`.
- Provides `login`, `logout`, `register`, `authFetch` helpers.

### Key Features Implementation
1.  **Medicine Browser**:
    - Fetches from `/api/medicines`.
    - Cards display image, price, stock status.
    - "Add to Cart" button calls API and updates local cart count.
2.  **OCR Scanner** (in `App.jsx`):
    - File input -> `handleOcrUpload`.
    - Displays raw text + matched medicines.
    - "Matches" show confidence badge and "In/Out of Stock" status.
3.  **Chatbot** (in `App.jsx`):
    - Spline 3D scene integration.
    - Simple chat interface sending messages to `/api/chat`.
4.  **Admin Dashboard** (`orders/AdminDashboard.jsx`):
    - Table view of inventory.
    - Edit mode for inline updates.
    - Quantity +/- controls.

## 6. Environment Variables (`server/.env`)
```
JWT_SECRET=your_secret_key
GEMINI_API_KEY=your_google_ai_key
PORT=3000
FRONTEND_URL=http://localhost:5173
```

## 7. How to Run
1.  **Server**:
    ```bash
    cd server
    npm install
    node setup_db.js # (First time only)
    node server.js
    ```
2.  **Client**:
    ```bash
    cd client
    npm install
    npm run dev
    ```
