/**
 * Pharmacy Management System - Backend Server
 * 
 * Features:
 * - JWT Authentication with bcrypt password hashing
 * - Google OAuth integration
 * - User profile management with avatar upload
 * - Medicine inventory with quantity tracking
 * - OCR prescription scanning with fuzzy matching
 * - RAG-powered AI chatbot
 * - Admin dashboard endpoints
 * 
 * @version 2.0.0
 */

// Load environment variables first
require('dotenv').config();

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Tesseract = require('tesseract.js');
const stringSimilarity = require('string-similarity');
const { GoogleGenAI } = require("@google/genai");

// Import auth middleware
const { verifyToken, requireRole, optionalAuth } = require('./middleware/auth');

// ============================================
// Configuration
// ============================================

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'demo_jwt_secret_change_in_production_12345';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Initialize Gemini AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Middleware
app.use(cors({
    origin: FRONTEND_URL,
    credentials: true
}));
app.use(bodyParser.json());
app.use(express.static('uploads'));

// Database Connection
const dbPath = path.join(__dirname, 'pharmacy.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error opening database:", err.message);
    } else {
        console.log("Connected to the SQLite database.");
    }
});

// ============================================
// Ensure upload directories exist
// ============================================
const uploadDirs = ['uploads', 'uploads/avatars', 'uploads/prescriptions'];
uploadDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Multer Setup for Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

// Avatar storage
const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/avatars/');
    },
    filename: (req, file, cb) => {
        const userId = req.user ? req.user.id : 'unknown';
        cb(null, `${userId}_avatar${path.extname(file.originalname)}`);
    }
});

// Prescription storage
const prescriptionStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/prescriptions/');
    },
    filename: (req, file, cb) => {
        cb(null, `rx_${Date.now()}${path.extname(file.originalname)}`);
    }
});

// File filter for images only
const imageFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed (JPEG, PNG, GIF)'), false);
    }
};

const upload = multer({ storage: storage, fileFilter: imageFilter, limits: { fileSize: 20 * 1024 * 1024 } });
const avatarUpload = multer({ storage: avatarStorage, fileFilter: imageFilter, limits: { fileSize: 5 * 1024 * 1024 } });
const prescriptionUpload = multer({ storage: prescriptionStorage, fileFilter: imageFilter, limits: { fileSize: 20 * 1024 * 1024 } });

// ============================================
// Helper Functions
// ============================================

/**
 * Generate JWT token for user
 */
function generateToken(user) {
    return jwt.sign(
        { userId: user.user_id, role: user.role || 'user', email: user.email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

/**
 * Search medicines in DB by keyword
 */
function searchMedicinesInDB(keyword) {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT medicine_id, name, composition, uses, side_effects, manufacturer, quantity,
                   CASE WHEN quantity > 0 THEN 1 ELSE 0 END as available
            FROM medicines 
            WHERE uses LIKE ? OR name LIKE ? OR composition LIKE ?
            LIMIT 10
        `;
        const term = `%${keyword}%`;
        db.all(sql, [term, term, term], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// Robust generation function with fallback
async function generateCheck(prompt) {
    try {
        // Try Gemini 2.5 Flash first
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        return response.text;
    } catch (err_25) {
        console.warn("Gemini 2.5 failed, trying 1.5...", err_25.message || err_25);
        try {
            // Fallback to Gemini 1.5 Flash
            const response = await ai.models.generateContent({
                model: "gemini-1.5-flash",
                contents: prompt,
            });
            return response.text;
        } catch (err_15) {
            console.error("Gemini 1.5 also failed.");
            throw err_15;
        }
    }
}

/**
 * Get all medicines for fuzzy matching
 */
function getAllMedicines() {
    return new Promise((resolve, reject) => {
        db.all("SELECT medicine_id, name, composition, uses, quantity FROM medicines", (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

/**
 * Fuzzy match OCR tokens to medicines
 */
async function fuzzyMatchMedicines(tokens, medicines) {
    const matches = [];
    const seen = new Set();

    for (const token of tokens) {
        if (token.length < 3 || seen.has(token)) continue;
        seen.add(token);

        let bestMatch = { score: 0, medicine: null };

        for (const med of medicines) {
            const nameScore = stringSimilarity.compareTwoStrings(token.toLowerCase(), med.name.toLowerCase());
            const compScore = med.composition ? 
                stringSimilarity.compareTwoStrings(token.toLowerCase(), med.composition.toLowerCase()) : 0;
            const maxScore = Math.max(nameScore, compScore);

            if (maxScore > bestMatch.score) {
                bestMatch = { score: maxScore, medicine: med };
            }
        }

        if (bestMatch.score >= 0.6 && bestMatch.medicine) {
            let confidence = 'low';
            if (bestMatch.score >= 0.8) confidence = 'high';
            else if (bestMatch.score >= 0.6) confidence = 'medium';

            matches.push({
                token,
                matched_medicine_id: bestMatch.medicine.medicine_id,
                matched_name: bestMatch.medicine.name,
                similarity: Math.round(bestMatch.score * 100) / 100,
                confidence_label: confidence,
                available: bestMatch.medicine.quantity > 0,
                quantity: bestMatch.medicine.quantity
            });
        }
    }
    return matches;
}

// ============================================
// AUTH ROUTES
// ============================================

/**
 * POST /api/auth/register
 * Register a new user with email/password (bcrypt hashed)
 */
app.post('/api/auth/register', async (req, res) => {
    const { email, password, name, username } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 10);
        const sql = `INSERT INTO users (email, username, password_hash, name, role) VALUES (?, ?, ?, ?, 'user')`;
        
        db.run(sql, [email, username || email.split('@')[0], passwordHash, name || ''], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint')) {
                    return res.status(400).json({ error: "Email or username already exists" });
                }
                return res.status(500).json({ error: "Registration failed" });
            }

            db.get("SELECT * FROM users WHERE user_id = ?", [this.lastID], (err, user) => {
                if (err || !user) {
                    return res.status(500).json({ error: "Failed to retrieve user" });
                }
                const token = generateToken(user);
                res.status(201).json({
                    message: "User registered successfully",
                    token,
                    user: {
                        id: user.user_id,
                        email: user.email,
                        username: user.username,
                        name: user.name,
                        role: user.role,
                        avatar_url: user.avatar_url
                    }
                });
            });
        });
    } catch (err) {
        console.error("Registration error:", err);
        res.status(500).json({ error: "Server error during registration" });
    }
});

/**
 * POST /api/auth/login
 * Login with email/password (bcrypt verified)
 */
app.post('/api/auth/login', async (req, res) => {
    const { email, username, password } = req.body;
    const identifier = email || username;

    if (!identifier || !password) {
        return res.status(400).json({ error: "Email/username and password required" });
    }

    const sql = `SELECT * FROM users WHERE email = ? OR username = ?`;
    db.get(sql, [identifier, identifier], async (err, user) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!user) return res.status(401).json({ error: "Invalid credentials" });

        if (!user.password_hash) {
            return res.status(400).json({ error: "This account uses Google Sign-In. Please login with Google." });
        }

        try {
            const isValid = await bcrypt.compare(password, user.password_hash);
            if (!isValid) return res.status(401).json({ error: "Invalid credentials" });

            const token = generateToken(user);
            res.json({
                message: "Login successful",
                token,
                user: {
                    id: user.user_id,
                    email: user.email,
                    username: user.username,
                    name: user.name,
                    role: user.role,
                    avatar_url: user.avatar_url,
                    age: user.age,
                    health_problems: user.health_problems,
                    google_id: user.google_id ? true : false
                }
            });
        } catch (err) {
            console.error("Login error:", err);
            res.status(500).json({ error: "Server error during login" });
        }
    });
});

// ============================================
// USER PROFILE ROUTES
// ============================================

/**
 * GET /api/users/me - Get current user's profile
 */
app.get('/api/users/me', verifyToken, (req, res) => {
    db.get(
        `SELECT user_id, email, username, name, age, health_problems, avatar_url, role, google_id, created_at FROM users WHERE user_id = ?`,
        [req.user.id],
        (err, user) => {
            if (err) return res.status(500).json({ error: "Database error" });
            if (!user) return res.status(404).json({ error: "User not found" });
            res.json({
                id: user.user_id, email: user.email, username: user.username, name: user.name,
                age: user.age, health_problems: user.health_problems, avatar_url: user.avatar_url,
                role: user.role, has_google: !!user.google_id, created_at: user.created_at
            });
        }
    );
});

/**
 * PUT /api/users/me - Update current user's profile
 */
app.put('/api/users/me', verifyToken, (req, res) => {
    const { name, age, health_problems } = req.body;
    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push("name = ?"); params.push(name); }
    if (age !== undefined) { updates.push("age = ?"); params.push(parseInt(age) || null); }
    if (health_problems !== undefined) { updates.push("health_problems = ?"); params.push(health_problems); }

    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });

    params.push(req.user.id);
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`;

    db.run(sql, params, function(err) {
        if (err) return res.status(500).json({ error: "Failed to update profile" });

        db.get(`SELECT user_id, email, username, name, age, health_problems, avatar_url, role FROM users WHERE user_id = ?`, [req.user.id], (err, user) => {
            if (err || !user) return res.status(500).json({ error: "Failed to retrieve updated profile" });
            res.json({
                message: "Profile updated successfully",
                user: { id: user.user_id, email: user.email, username: user.username, name: user.name, age: user.age, health_problems: user.health_problems, avatar_url: user.avatar_url, role: user.role }
            });
        });
    });
});

/**
 * POST /api/users/me/avatar - Upload user avatar
 */
app.post('/api/users/me/avatar', verifyToken, avatarUpload.single('avatar'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const avatarUrl = `/avatars/${req.file.filename}`;
    db.run("UPDATE users SET avatar_url = ? WHERE user_id = ?", [avatarUrl, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: "Failed to update avatar" });
        res.json({ message: "Avatar uploaded successfully", avatar_url: avatarUrl });
    });
});

// ============================================
// MEDICINE ROUTES
// ============================================

/**
 * GET /api/medicines - Get medicines list (protected)
 */
app.get('/api/medicines', verifyToken, (req, res) => {
    const search = req.query.search;
    let sql = `SELECT medicine_id, name, composition, uses, side_effects, image_url, manufacturer, 
               quantity, price, excellent_review_pct, average_review_pct, poor_review_pct,
               CASE WHEN quantity > 0 THEN 1 ELSE 0 END as available FROM medicines`;
    let params = [];

    if (search) {
        sql += ` WHERE name LIKE ? OR composition LIKE ? OR uses LIKE ?`;
        params = [`%${search}%`, `%${search}%`, `%${search}%`];
    }
    sql += ` ORDER BY name LIMIT 100`;

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ 
            medicines: rows.map(med => ({
                ...med, 
                price: med.price || 420,
                available: med.quantity > 0, 
                stock_status: med.quantity > 0 ? 'in_stock' : 'out_of_stock'
            }))
        });
    });
});

/**
 * GET /api/medicines/search - Public search endpoint
 */
app.get('/api/medicines/search', optionalAuth, (req, res) => {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: "Search query required" });

    const sql = `SELECT medicine_id, name, composition, uses, quantity, price, CASE WHEN quantity > 0 THEN 1 ELSE 0 END as available FROM medicines WHERE name LIKE ? OR composition LIKE ? OR uses LIKE ? LIMIT 20`;
    const term = `%${q}%`;

    db.all(sql, [term, term, term], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ results: rows });
    });
});

// ============================================
// OCR ROUTES
// ============================================

/**
 * POST /api/ocr/scan - Enhanced OCR with fuzzy matching
 */
app.post('/api/ocr/scan', optionalAuth, prescriptionUpload.single('rx_image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No prescription image uploaded" });

    const imagePath = req.file.path;

    try {
        console.log(`Processing OCR for ${imagePath}...`);
        const { data: { text } } = await Tesseract.recognize(imagePath, 'eng');
        const rawText = text;
        const lines = text.split('\n').filter(line => line.trim());

        const normalized = rawText.toLowerCase().replace(/[^\w\s]/g, ' ');
        const words = normalized.split(/\s+/).filter(w => w.length >= 3);
        
        const tokens = new Set(words);
        for (let i = 0; i < words.length - 1; i++) tokens.add(`${words[i]} ${words[i+1]}`);
        for (let i = 0; i < words.length - 2; i++) tokens.add(`${words[i]} ${words[i+1]} ${words[i+2]}`);

        const medicines = await getAllMedicines();
        const mappedMatches = await fuzzyMatchMedicines(Array.from(tokens), medicines);

        const matchedMedicineIds = mappedMatches.map(m => m.matched_medicine_id);
        const uniqueIds = [...new Set(matchedMedicineIds)];

        let byMedicineName = [];
        if (uniqueIds.length > 0) {
            const placeholders = uniqueIds.map(() => '?').join(',');
            byMedicineName = await new Promise((resolve, reject) => {
                db.all(`SELECT medicine_id, name, composition, uses, quantity, CASE WHEN quantity > 0 THEN 1 ELSE 0 END as available FROM medicines WHERE medicine_id IN (${placeholders})`, uniqueIds, (err, rows) => {
                    if (err) reject(err); else resolve(rows);
                });
            });
        }

        const symptomKeywords = words.filter(w => ['pain', 'fever', 'cough', 'cold', 'headache', 'allergy', 'infection', 'inflammation', 'diabetes', 'pressure', 'acid', 'stomach'].includes(w));
        
        let bySymptoms = [];
        for (const symptom of symptomKeywords) {
            const results = await searchMedicinesInDB(symptom);
            bySymptoms.push(...results);
        }
        bySymptoms = bySymptoms.filter((med, idx, arr) => arr.findIndex(m => m.medicine_id === med.medicine_id) === idx).slice(0, 10);

        res.json({
            message: "Prescription processed successfully",
            raw_text: rawText,
            lines,
            mapped_matches: mappedMatches,
            automatic_inventory_search: { by_medicine_name: byMedicineName, by_symptoms: bySymptoms },
            file_path: `/prescriptions/${req.file.filename}`
        });

    } catch (error) {
        console.error("OCR Error:", error);
        res.status(500).json({ error: "Failed to process prescription image" });
    }
});

// Legacy OCR endpoint (backward compatibility)
app.post('/api/upload-prescription', upload.single('prescription'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    try {
        console.log(`Processing OCR for ${req.file.path}...`);
        const { data: { text } } = await Tesseract.recognize(req.file.path, 'eng');
        res.json({ message: "File processed", extractedText: text, filePath: `/uploads/${req.file.filename}` });
    } catch (error) {
        console.error("OCR Error:", error);
        res.status(500).json({ error: "Failed to process image" });
    }
});

// ============================================
// CART ROUTES
// ============================================

/**
 * GET /api/cart - Get user's cart items
 */
app.get('/api/cart', verifyToken, (req, res) => {
    const userId = req.user.id;
    
    db.all(`
        SELECT ci.cart_item_id, ci.quantity as cart_quantity, 
               m.medicine_id, m.name, m.composition, m.price, m.quantity as stock_quantity, m.image_url
        FROM cart_items ci
        JOIN medicines m ON ci.medicine_id = m.medicine_id
        WHERE ci.user_id = ?
        ORDER BY ci.created_at DESC
    `, [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const total = rows.reduce((sum, item) => sum + (item.price * item.cart_quantity), 0);
        res.json({ cart_items: rows, total, item_count: rows.length });
    });
});

/**
 * POST /api/cart - Add item to cart
 */
app.post('/api/cart', verifyToken, (req, res) => {
    const userId = req.user.id;
    const { medicine_id, quantity = 1 } = req.body;
    
    if (!medicine_id) return res.status(400).json({ error: 'Medicine ID is required' });
    
    // Check if medicine exists and has stock
    db.get("SELECT * FROM medicines WHERE medicine_id = ?", [medicine_id], (err, medicine) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!medicine) return res.status(404).json({ error: 'Medicine not found' });
        if (medicine.quantity < quantity) return res.status(400).json({ error: 'Insufficient stock' });
        
        // Check if already in cart - update quantity
        db.get("SELECT * FROM cart_items WHERE user_id = ? AND medicine_id = ?", [userId, medicine_id], (err, existing) => {
            if (err) return res.status(500).json({ error: err.message });
            
            if (existing) {
                const newQty = existing.quantity + quantity;
                if (newQty > medicine.quantity) {
                    return res.status(400).json({ error: 'Cannot add more than available stock' });
                }
                db.run("UPDATE cart_items SET quantity = ? WHERE cart_item_id = ?", [newQty, existing.cart_item_id], function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ message: 'Cart updated', cart_item_id: existing.cart_item_id, quantity: newQty });
                });
            } else {
                db.run("INSERT INTO cart_items (user_id, medicine_id, quantity) VALUES (?, ?, ?)", [userId, medicine_id, quantity], function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.status(201).json({ message: 'Added to cart', cart_item_id: this.lastID });
                });
            }
        });
    });
});

/**
 * PUT /api/cart/:id - Update cart item quantity
 */
app.put('/api/cart/:id', verifyToken, (req, res) => {
    const userId = req.user.id;
    const cartItemId = req.params.id;
    const { quantity } = req.body;
    
    if (!quantity || quantity < 1) return res.status(400).json({ error: 'Valid quantity is required' });
    
    db.get(`
        SELECT ci.*, m.quantity as stock_quantity 
        FROM cart_items ci 
        JOIN medicines m ON ci.medicine_id = m.medicine_id 
        WHERE ci.cart_item_id = ? AND ci.user_id = ?
    `, [cartItemId, userId], (err, item) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!item) return res.status(404).json({ error: 'Cart item not found' });
        if (quantity > item.stock_quantity) return res.status(400).json({ error: 'Exceeds available stock' });
        
        db.run("UPDATE cart_items SET quantity = ? WHERE cart_item_id = ?", [quantity, cartItemId], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Cart updated', quantity });
        });
    });
});

/**
 * DELETE /api/cart/:id - Remove item from cart
 */
app.delete('/api/cart/:id', verifyToken, (req, res) => {
    const userId = req.user.id;
    const cartItemId = req.params.id;
    
    db.run("DELETE FROM cart_items WHERE cart_item_id = ? AND user_id = ?", [cartItemId, userId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Cart item not found' });
        res.json({ message: 'Item removed from cart' });
    });
});

/**
 * DELETE /api/cart - Clear entire cart
 */
app.delete('/api/cart', verifyToken, (req, res) => {
    const userId = req.user.id;
    
    db.run("DELETE FROM cart_items WHERE user_id = ?", [userId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Cart cleared', items_removed: this.changes });
    });
});

// ============================================
// CHECKOUT & ORDERS ROUTES
// ============================================

/**
 * POST /api/checkout - Process checkout, create order, decrease stock
 */
app.post('/api/checkout', verifyToken, (req, res) => {
    const userId = req.user.id;
    
    // Get cart items
    db.all(`
        SELECT ci.cart_item_id, ci.quantity as cart_quantity, 
               m.medicine_id, m.name, m.price, m.quantity as stock_quantity
        FROM cart_items ci
        JOIN medicines m ON ci.medicine_id = m.medicine_id
        WHERE ci.user_id = ?
    `, [userId], (err, cartItems) => {
        if (err) return res.status(500).json({ error: err.message });
        if (cartItems.length === 0) return res.status(400).json({ error: 'Cart is empty' });
        
        // Validate stock for all items
        for (const item of cartItems) {
            if (item.cart_quantity > item.stock_quantity) {
                return res.status(400).json({ 
                    error: `Insufficient stock for ${item.name}. Available: ${item.stock_quantity}` 
                });
            }
        }
        
        // Calculate total
        const total = cartItems.reduce((sum, item) => sum + (item.price * item.cart_quantity), 0);
        
        // Create order
        db.run("INSERT INTO orders (user_id, total_amount) VALUES (?, ?)", [userId, total], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            
            const orderId = this.lastID;
            
            // Insert order items and update stock
            const insertStmt = db.prepare("INSERT INTO order_items (order_id, medicine_id, medicine_name, quantity, price_at_purchase) VALUES (?, ?, ?, ?, ?)");
            const updateStmt = db.prepare("UPDATE medicines SET quantity = quantity - ? WHERE medicine_id = ?");
            
            db.serialize(() => {
                db.run("BEGIN TRANSACTION");
                
                cartItems.forEach(item => {
                    insertStmt.run(orderId, item.medicine_id, item.name, item.cart_quantity, item.price);
                    updateStmt.run(item.cart_quantity, item.medicine_id);
                });
                
                // Clear cart
                db.run("DELETE FROM cart_items WHERE user_id = ?", [userId]);
                
                db.run("COMMIT", (err) => {
                    if (err) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ error: 'Checkout failed' });
                    }
                    
                    insertStmt.finalize();
                    updateStmt.finalize();
                    
                    // Get user details for bill
                    db.get("SELECT user_id, email, name, avatar_url FROM users WHERE user_id = ?", [userId], (err, user) => {
                        res.status(201).json({
                            message: 'Order placed successfully',
                            order: {
                                order_id: orderId,
                                total_amount: total,
                                items: cartItems.map(item => ({
                                    medicine_id: item.medicine_id,
                                    name: item.name,
                                    quantity: item.cart_quantity,
                                    price: item.price,
                                    subtotal: item.price * item.cart_quantity
                                })),
                                user: user,
                                created_at: new Date().toISOString()
                            }
                        });
                    });
                });
            });
        });
    });
});

/**
 * GET /api/orders - Get user's order history
 */
app.get('/api/orders', verifyToken, (req, res) => {
    const userId = req.user.id;
    
    db.all("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC", [userId], (err, orders) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (orders.length === 0) return res.json({ orders: [] });
        
        // Get items for each order
        const orderIds = orders.map(o => o.order_id);
        const placeholders = orderIds.map(() => '?').join(',');
        
        db.all(`SELECT * FROM order_items WHERE order_id IN (${placeholders})`, orderIds, (err, items) => {
            if (err) return res.status(500).json({ error: err.message });
            
            const ordersWithItems = orders.map(order => ({
                ...order,
                items: items.filter(item => item.order_id === order.order_id)
            }));
            
            res.json({ orders: ordersWithItems });
        });
    });
});

/**
 * GET /api/orders/:id - Get specific order with bill details
 */
app.get('/api/orders/:id', verifyToken, (req, res) => {
    const userId = req.user.id;
    const orderId = req.params.id;
    
    db.get("SELECT * FROM orders WHERE order_id = ? AND user_id = ?", [orderId, userId], (err, order) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        
        db.all("SELECT * FROM order_items WHERE order_id = ?", [orderId], (err, items) => {
            if (err) return res.status(500).json({ error: err.message });
            
            db.get("SELECT user_id, email, name, age, health_problems, avatar_url FROM users WHERE user_id = ?", [userId], (err, user) => {
                if (err) return res.status(500).json({ error: err.message });
                
                res.json({
                    order: {
                        ...order,
                        items,
                        user
                    }
                });
            });
        });
    });
});

// ============================================
// ADMIN ROUTES
// ============================================

/**
 * GET /api/admin/medicines - Get all medicines for admin
 */
app.get('/api/admin/medicines', verifyToken, requireRole('admin'), (req, res) => {
    db.all(`SELECT * FROM medicines ORDER BY name`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ medicines: rows.map(med => ({ ...med, stock_status: med.quantity > 0 ? 'in_stock' : 'out_of_stock' })) });
    });
});

/**
 * POST /api/admin/medicines - Create a new medicine
 */
app.post('/api/admin/medicines', verifyToken, requireRole('admin'), (req, res) => {
    const { name, composition, uses, side_effects, manufacturer, quantity, price, image_url } = req.body;
    if (!name) return res.status(400).json({ error: "Medicine name is required" });

    const sql = `INSERT INTO medicines (name, composition, uses, side_effects, manufacturer, quantity, price, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [name, composition || '', uses || '', side_effects || '', manufacturer || '', quantity !== undefined ? parseInt(quantity) : 67, price !== undefined ? parseFloat(price) : 420, image_url || ''];

    db.run(sql, params, function(err) {
        if (err) return res.status(500).json({ error: "Failed to create medicine" });
        db.get("SELECT * FROM medicines WHERE medicine_id = ?", [this.lastID], (err, medicine) => {
            res.status(201).json({ message: "Medicine created successfully", medicine: { ...medicine, stock_status: medicine.quantity > 0 ? 'in_stock' : 'out_of_stock' } });
        });
    });
});

/**
 * PUT /api/admin/medicines/:id - Update a medicine
 */
app.put('/api/admin/medicines/:id', verifyToken, requireRole('admin'), (req, res) => {
    const { id } = req.params;
    const { name, composition, uses, side_effects, manufacturer, quantity, price, image_url } = req.body;

    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push("name = ?"); params.push(name); }
    if (composition !== undefined) { updates.push("composition = ?"); params.push(composition); }
    if (uses !== undefined) { updates.push("uses = ?"); params.push(uses); }
    if (side_effects !== undefined) { updates.push("side_effects = ?"); params.push(side_effects); }
    if (manufacturer !== undefined) { updates.push("manufacturer = ?"); params.push(manufacturer); }
    if (quantity !== undefined) { updates.push("quantity = ?"); params.push(parseInt(quantity)); }
    if (price !== undefined) { updates.push("price = ?"); params.push(parseFloat(price)); }
    if (image_url !== undefined) { updates.push("image_url = ?"); params.push(image_url); }

    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });

    params.push(id);
    db.run(`UPDATE medicines SET ${updates.join(', ')} WHERE medicine_id = ?`, params, function(err) {
        if (err) return res.status(500).json({ error: "Failed to update medicine" });
        if (this.changes === 0) return res.status(404).json({ error: "Medicine not found" });
        db.get("SELECT * FROM medicines WHERE medicine_id = ?", [id], (err, medicine) => {
            res.json({ message: "Medicine updated successfully", medicine: { ...medicine, stock_status: medicine.quantity > 0 ? 'in_stock' : 'out_of_stock' } });
        });
    });
});

/**
 * PATCH /api/admin/medicines/:id/adjust-quantity - Adjust quantity by delta
 */
app.patch('/api/admin/medicines/:id/adjust-quantity', verifyToken, requireRole('admin'), (req, res) => {
    const { id } = req.params;
    const { delta } = req.body;

    if (delta === undefined || typeof delta !== 'number') return res.status(400).json({ error: "Delta must be a number" });

    db.run(`UPDATE medicines SET quantity = MAX(0, quantity + ?) WHERE medicine_id = ?`, [delta, id], function(err) {
        if (err) return res.status(500).json({ error: "Failed to adjust quantity" });
        if (this.changes === 0) return res.status(404).json({ error: "Medicine not found" });
        db.get("SELECT * FROM medicines WHERE medicine_id = ?", [id], (err, medicine) => {
            res.json({ message: `Quantity adjusted by ${delta}`, medicine: { ...medicine, stock_status: medicine.quantity > 0 ? 'in_stock' : 'out_of_stock' } });
        });
    });
});

/**
 * PATCH /api/admin/medicines/:id/adjust-price - Adjust price by delta
 */
app.patch('/api/admin/medicines/:id/adjust-price', verifyToken, requireRole('admin'), (req, res) => {
    const { id } = req.params;
    const { delta } = req.body;

    if (delta === undefined || typeof delta !== 'number') return res.status(400).json({ error: "Delta must be a number" });

    db.run(`UPDATE medicines SET price = MAX(0, price + ?) WHERE medicine_id = ?`, [delta, id], function(err) {
        if (err) return res.status(500).json({ error: "Failed to adjust price" });
        if (this.changes === 0) return res.status(404).json({ error: "Medicine not found" });
        db.get("SELECT * FROM medicines WHERE medicine_id = ?", [id], (err, medicine) => {
            res.json({ message: `Price adjusted by ${delta}`, medicine: { ...medicine, stock_status: medicine.quantity > 0 ? 'in_stock' : 'out_of_stock' } });
        });
    });
});

/**
 * DELETE /api/admin/medicines/:id - Delete a medicine
 */
app.delete('/api/admin/medicines/:id', verifyToken, requireRole('admin'), (req, res) => {
    db.run("DELETE FROM medicines WHERE medicine_id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: "Failed to delete medicine" });
        if (this.changes === 0) return res.status(404).json({ error: "Medicine not found" });
        res.json({ message: "Medicine deleted successfully" });
    });
});

// 4. Chatbot (RAG Implemented with Fallback)
app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ reply: "Say something!" });

    try {
        console.log("Chat request received:", message);

        // Step 1: Extract Keyword
        const extractionPrompt = `
            Extract the single most important medical symptom or medicine name from this user query for a database search.
            User Query: "${message}"
            Output ONLY the keyword (e.g., "fever", "paracetamol", "headache"). If none, output "general".
        `;

        let extractedText = "general";
        try {
            extractedText = await generateCheck(extractionPrompt);
        } catch (e) {
            console.error("Extraction failed, using general.");
        }

        let keyword = (extractedText || "general").trim().replace(/['"]/g, '');
        console.log(`RAG Keyword extracted: ${keyword}`);

        let contextMedicines = [];
        if (keyword.toLowerCase() !== 'general') {
            // Step 2: Retrieve relevant documents (medicines) from SQLite
            contextMedicines = await searchMedicinesInDB(keyword);
        }

        // Prepare context string
        let contextText = "";
        if (contextMedicines.length > 0) {
            contextText = "Here are some medicines available in our inventory:\n" +
                contextMedicines.map(m => `- ${m.name} (Comp: ${m.composition}): Uses: ${m.uses}. Side Effects: ${m.side_effects}`).join("\n");
        } else {
            contextText = "No specific medicines found in inventory matching the symptoms.";
        }

        // Step 3: Generate Final Response with Context
        const finalPrompt = `
            You are a helpful pharmacy assistant. 
            User Query: "${message}"
            
            Inventory Context:
            ${contextText}

            Instructions:
            1. Suggest medicines ONLY from the Inventory Context if they match the symptoms.
            2. If the context has relevant medicines, mention their names and composition.
            3. If no relevant medicines are in the context, give general advice but state we might not have stock.
            4. Keep it concise (max 3-4 sentences).
            5. Always start with a disclaimer to consult a doctor.
        `;

        const replyText = await generateCheck(finalPrompt);

        // Robust check
        const safeReply = replyText ? replyText : "I couldn't generate a response. Please try again.";
        res.json({ reply: safeReply });

    } catch (error) {
        console.error("Gemini RAG API Error:", JSON.stringify(error, null, 2));
        if (error.response) {
            console.error("Error Response Body:", JSON.stringify(error.response, null, 2));
        }
        res.status(500).json({ reply: "Sorry, I'm having trouble connecting to the AI right now. Check server logs." });
    }
});

// ============================================
// Global Error Handler (for Multer and other errors)
// ============================================
app.use((err, req, res, next) => {
    console.error('Server Error:', err.message);
    
    // Handle Multer errors
    if (err.name === 'MulterError') {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 20MB.' });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    
    // Handle other errors
    res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Gemini RAG integration initialized (With 1.5 Flash Fallback)`);
});
