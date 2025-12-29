# Pharmacy Management System 💊

A comprehensive full-stack web application for pharmacy management with modern features including JWT authentication, shopping cart with checkout, AI-powered health assistant with 3D avatar, prescription OCR with fuzzy matching, and an admin inventory dashboard.

---

## 🚀 Features

### 1. **JWT Authentication & User Profiles**
- **Secure Registration & Login**: Email/password authentication with bcrypt password hashing.
- **JWT Tokens**: Stateless authentication with 1-hour token expiry.
- **User Profiles**: View and edit name, age, health problems.
- **Avatar Upload**: Upload profile pictures with automatic storage.
- **Role-Based Access**: Admin and user roles with protected routes.

### 2. **Smart Inventory Management**
- **Database**: Powered by **SQLite** (`pharmacy.db`), pre-seeded with **11,000+ real medicine records**.
- **Stock Tracking**: Each medicine has quantity and price fields.
- **Search**: Fast filtering by medicine name, composition, or usage.
- **Medicine Cards**: Visual display with images, composition, uses, ratings, price, and stock status.

### 3. **Shopping Cart & Checkout System** 🛒
- **Add to Cart**: One-click add medicines to cart from the medicine catalog.
- **Cart Management**: Update quantities, remove items, view running totals.
- **Real-time Stock Validation**: Prevents adding more than available stock.
- **Checkout Process**: Complete order processing with stock deduction.
- **Bill Generation**: Professional invoice with customer details and avatar.
- **Print Bill**: Print-ready invoices for record keeping.
- **Order History**: View past orders with detailed breakdowns.

### 4. **AI Chatbot with RAG & 3D Avatar** 🤖
- **3D Interactive Avatar**: Powered by **Spline 3D** for an immersive experience.
- **Intelligent NLP**: Uses **Google Gemini 2.5 Flash** (with auto-fallback to **Gemini 1.5 Flash**).
- **Context-Aware Suggestions**: The bot extracts symptoms from your query, searches the local inventory database, and suggests *only* medicines that are actually in stock.
- **Two-Step RAG Pipeline**:
  1. **Keyword Extraction**: AI extracts medical symptoms/keywords from user queries.
  2. **Context Retrieval**: SQLite search fetches matching medicines from inventory.
  3. **Contextual Response**: AI generates responses based on available inventory.

### 5. **Prescription Digitization (OCR) with Fuzzy Matching** 📷
- Upload prescription images (PNG, JPG, JPEG) up to 20MB.
- Powered by **Tesseract.js** with English language support.
- **Fuzzy Matching**: Uses `string-similarity` to match handwritten/unclear medicine names.
- **Confidence Levels**: High (≥80%), Medium (≥60%), Low (<60%) match indicators.
- **Automatic Inventory Search**: Finds matching medicines and checks availability.

### 6. **Admin Dashboard** ⚙️
- **Inventory Overview**: View all medicines with stock and price status.
- **Price Controls**: Quick +/- buttons to adjust prices (₹10 increments).
- **Quantity Controls**: Quick +/- buttons to adjust stock levels.
- **CRUD Operations**: Add, edit, and delete medicines.
- **Search & Filter**: Find medicines quickly in the admin view.
- **Role Protection**: Only accessible to admin users.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Vite 7, React Router 7, Spline 3D, CSS3 (Custom Properties) |
| **Backend** | Node.js, Express 5 |
| **Database** | SQLite3 |
| **Authentication** | JWT (jsonwebtoken), bcrypt |
| **AI/ML** | Google Gemini API (`@google/genai`), Tesseract.js 6, string-similarity |
| **3D Graphics** | @splinetool/react-spline |
| **File Upload** | Multer 2 |
| **Dev Tools** | ESLint, Vite HMR |

---

## 📂 Project Structure

```
pharmacy-management/
├── package.json                # Root package.json
├── README.md                   # This file
│
├── client/                     # React Frontend (Vite)
│   ├── package.json
│   ├── vite.config.js          # Vite configuration
│   ├── eslint.config.js        # ESLint rules
│   ├── index.html              # HTML entry point
│   ├── public/                 # Static assets
│   └── src/
│       ├── main.jsx            # React entry point with Router
│       ├── App.jsx             # Main app with routes & dashboard
│       ├── App.css             # Application styles
│       ├── index.css           # Global styles
│       ├── context/
│       │   └── AuthContext.jsx # JWT auth state management
│       ├── components/
│       │   └── ProtectedRoute.jsx # Route guard component
│       ├── pages/
│       │   ├── Login.jsx       # Login page
│       │   ├── Signup.jsx      # Registration page
│       │   ├── Account.jsx     # User profile page
│       │   ├── Cart.jsx        # Shopping cart & checkout
│       │   ├── OcrPage.jsx     # Enhanced OCR scanner
│       │   ├── AdminDashboard.jsx # Admin inventory management
│       │   └── *.css           # Page-specific styles
│       └── assets/             # Images, icons, etc.
│
└── server/                     # Node.js Backend
    ├── package.json
    ├── .env.example            # Environment variables template
    ├── server.js               # Express API server
    ├── setup_db.js             # Database initialization
    ├── middleware/
    │   └── auth.js             # JWT verification middleware
    ├── Medicine_Details.csv    # Source dataset (11K+ medicines)
    ├── eng.traineddata         # Tesseract language data
    ├── pharmacy.db             # SQLite database (generated)
    └── uploads/                # Uploaded images (rx, avatars)
```

---

## 🔌 API Endpoints

### Authentication
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/auth/register` | Register new user | No |
| `POST` | `/api/auth/login` | Login (email/username + password) | No |

### User Profile
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/users/me` | Get current user profile | JWT |
| `PUT` | `/api/users/me` | Update profile | JWT |
| `POST` | `/api/users/me/avatar` | Upload profile picture | JWT |

### Medicines
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/medicines` | Get all medicines (limit 100) | JWT |
| `GET` | `/api/medicines?search=<term>` | Search medicines | JWT |

### Shopping Cart
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/cart` | Get user's cart | JWT |
| `POST` | `/api/cart` | Add item to cart | JWT |
| `PUT` | `/api/cart/:id` | Update cart item quantity | JWT |
| `DELETE` | `/api/cart/:id` | Remove item from cart | JWT |
| `DELETE` | `/api/cart` | Clear entire cart | JWT |

### Checkout & Orders
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/checkout` | Process checkout, create order | JWT |
| `GET` | `/api/orders` | Get user's order history | JWT |
| `GET` | `/api/orders/:id` | Get order details with bill | JWT |

### OCR & Prescription Scanning
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/ocr/scan` | Upload prescription, OCR + fuzzy match | Optional |

### AI Chatbot
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/chat` | Send message to AI chatbot (RAG) | No |

### Admin (Role: admin)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/admin/medicines` | Get all medicines | Admin |
| `POST` | `/api/admin/medicines` | Add new medicine | Admin |
| `PUT` | `/api/admin/medicines/:id` | Update medicine | Admin |
| `DELETE` | `/api/admin/medicines/:id` | Delete medicine | Admin |
| `PATCH` | `/api/admin/medicines/:id/adjust-quantity` | Adjust stock (+/-) | Admin |
| `PATCH` | `/api/admin/medicines/:id/adjust-price` | Adjust price (+/-) | Admin |

---

## ⚡ Installation & Setup

### Prerequisites
- **Node.js** v18 or higher
- **Google Gemini API Key** (get it from [Google AI Studio](https://makersuite.google.com/app/apikey))

### 1. Clone the Repository
```bash
git clone https://github.com/Mish-atul/DBMS-pharmacy-management-.git
cd "DBMS-pharmacy-management-"
```

### 2. Install Dependencies

**Server:**
```bash
cd server
npm install
```

**Client:**
```bash
cd client
npm install
```

### 3. Environment Configuration

Create a `.env` file in the `server/` directory:
```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Google Gemini API
GEMINI_API_KEY=your-gemini-api-key-here
```

### 4. Database Setup (Required for First Run)
```bash
cd server
node setup_db.js
```

This script will:
1. ✅ Create `pharmacy.db` SQLite database
2. ✅ Create all tables (users, medicines, cart_items, orders, order_items)
3. ✅ Import **11,000+ medicine records** from CSV
4. ✅ Set default price (₹420) and quantity (67) for all medicines
5. ✅ Seed admin user: `admin` / `admin123`

### 5. Start the Servers

**Backend (Terminal 1):**
```bash
cd server
node server.js
```
Server runs on: `http://localhost:3000`

**Frontend (Terminal 2):**
```bash
cd client
npm run dev
```
Client runs on: `http://localhost:5173`

---

## 👤 Default Credentials

| Role | Username/Email | Password |
|------|---------------|----------|
| Admin | `admin` | `admin123` |
| Admin | `admin@pharmacy.demo` | `admin123` |

---

## 🎯 Usage Guide

### For Users:
1. **Register/Login**: Create an account or login
2. **Browse Medicines**: Search and view available medicines
3. **Add to Cart**: Click "Add to Cart" on any medicine
4. **Upload Prescription**: Use OCR to scan prescriptions
5. **AI Assistant**: Chat with Dr. Bot for health advice
6. **Checkout**: Complete your purchase and print the bill

### For Admins:
1. **Login as Admin**: Use admin credentials
2. **Access Dashboard**: Click "Admin" in the navbar
3. **Manage Inventory**: Add, edit, delete medicines
4. **Adjust Prices**: Use +/- buttons to change prices
5. **Adjust Stock**: Use +/- buttons to manage quantities

---

## 🔒 Security Features

- **Password Hashing**: bcrypt with 10 salt rounds
- **JWT Authentication**: Secure stateless tokens
- **Role-Based Access Control**: Admin-only routes
- **Input Validation**: Server-side validation
- **SQL Injection Prevention**: Parameterized queries

---

## 📝 License

This project is for educational purposes as part of DBMS Lab coursework.

---

## 👨‍💻 Author

**Mish-atul** - [GitHub](https://github.com/Mish-atul)

---

## 🙏 Acknowledgments

- Google Gemini API for AI capabilities
- Tesseract.js for OCR processing
- Spline for 3D graphics
- React & Vite for the frontend framework
