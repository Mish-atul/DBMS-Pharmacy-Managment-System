const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const bcrypt = require('bcrypt');

const DATA_DIR = process.env.NODE_ENV === 'production' ? '/var/data' : __dirname;
if (process.env.NODE_ENV === 'production' && !fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const dbPath = path.join(DATA_DIR, 'pharmacy.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log("Connected to SQLite database.");

    // Create Users Table (updated schema with auth fields)
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE,
            username TEXT UNIQUE,
            password_hash TEXT,
            google_id TEXT UNIQUE,
            name TEXT,
            age INTEGER,
            health_problems TEXT,
            avatar_url TEXT,
            role TEXT DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create Medicines Table (with quantity and price fields)
    db.run(`
        CREATE TABLE IF NOT EXISTS medicines (
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
        )
    `, (err) => {
        if (err) {
            console.error("Error creating medicines table:", err);
            return;
        }
        
        // Create Cart Table
        db.run(`
            CREATE TABLE IF NOT EXISTS cart_items (
                cart_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                medicine_id INTEGER NOT NULL,
                quantity INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id),
                FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id),
                UNIQUE(user_id, medicine_id)
            )
        `);

        // Create Orders Table
        db.run(`
            CREATE TABLE IF NOT EXISTS orders (
                order_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                total_amount REAL NOT NULL,
                status TEXT DEFAULT 'completed',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            )
        `);

        // Create Order Items Table
        db.run(`
            CREATE TABLE IF NOT EXISTS order_items (
                order_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                medicine_id INTEGER NOT NULL,
                medicine_name TEXT,
                quantity INTEGER NOT NULL,
                price_at_purchase REAL NOT NULL,
                FOREIGN KEY (order_id) REFERENCES orders(order_id),
                FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id)
            )
        `);

        console.log("Tables created.");
        runMigrations();
    });
});

// Run migrations for existing databases
function runMigrations() {
    console.log("Running migrations...");
    
    // Migration: Add new columns to users table if they don't exist
    const userMigrations = [
        "ALTER TABLE users ADD COLUMN email TEXT UNIQUE",
        "ALTER TABLE users ADD COLUMN password_hash TEXT",
        "ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE",
        "ALTER TABLE users ADD COLUMN name TEXT",
        "ALTER TABLE users ADD COLUMN age INTEGER",
        "ALTER TABLE users ADD COLUMN health_problems TEXT",
        "ALTER TABLE users ADD COLUMN avatar_url TEXT",
        "ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'",
        "ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"
    ];

    // Migration: Add quantity and price columns to medicines table
    const medicineMigrations = [
        "ALTER TABLE medicines ADD COLUMN quantity INTEGER DEFAULT 67",
        "ALTER TABLE medicines ADD COLUMN price REAL DEFAULT 420",
        "ALTER TABLE medicines ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"
    ];

    // Run user migrations (ignore errors for already existing columns)
    userMigrations.forEach(sql => {
        db.run(sql, (err) => {
            if (err && !err.message.includes('duplicate column')) {
                // Column already exists, ignore
            }
        });
    });

    // Run medicine migrations
    medicineMigrations.forEach(sql => {
        db.run(sql, (err) => {
            if (err && !err.message.includes('duplicate column')) {
                // Column already exists, ignore
            }
        });
    });

    // Update existing medicines with default quantity and price if null
    db.run("UPDATE medicines SET quantity = 67 WHERE quantity IS NULL", (err) => {
        if (!err) {
            console.log("Updated existing medicines with default quantity.");
        }
    });
    
    db.run("UPDATE medicines SET price = 420 WHERE price IS NULL", (err) => {
        if (!err) {
            console.log("Updated existing medicines with default price.");
        }
    });

    // Migrate old password column to password_hash
    db.run("UPDATE users SET password_hash = password WHERE password_hash IS NULL AND password IS NOT NULL", (err) => {
        if (!err) {
            console.log("Migrated old passwords to password_hash column.");
        }
    });

    console.log("Migrations completed.");
    seedAdminUser();
}

// Create default admin user
async function seedAdminUser() {
    const adminEmail = 'admin@pharmacy.demo';
    const adminUsername = 'admin';
    const adminPassword = 'admin123';
    
    db.get("SELECT * FROM users WHERE email = ? OR username = ?", [adminEmail, adminUsername], (err, row) => {
        if (!row) {
            bcrypt.hash(adminPassword, 10, (err, hash) => {
                if (err) {
                    console.error("Error hashing admin password:", err);
                    checkAndSeed();
                    return;
                }
                db.run(
                    `INSERT INTO users (email, username, password_hash, name, role) VALUES (?, ?, ?, ?, ?)`,
                    [adminEmail, adminUsername, hash, 'Admin User', 'admin'],
                    function(err) {
                        if (err) {
                            console.error("Error creating admin user:", err);
                        } else {
                            console.log("Default admin user created: admin / admin123 (or admin@pharmacy.demo / admin123)");
                        }
                        checkAndSeed();
                    }
                );
            });
        } else {
            console.log("Admin user already exists.");
            checkAndSeed();
        }
    });
}

function checkAndSeed() {
    db.get("SELECT COUNT(*) as count FROM medicines", (err, row) => {
        if (err) {
            console.error(err);
            return;
        }
        if (row.count > 0) {
            console.log("Medicines table already has data. Skipping seed.");
            db.close();
        } else {
            console.log("Seeding medicines from CSV...");
            seedMedicines();
        }
    });
}

function seedMedicines() {
    const results = [];
    const csvPath = path.join(__dirname, 'Medicine_Details.csv');

    if (!fs.existsSync(csvPath)) {
        console.error("CSV file not found at:", csvPath);
        db.close();
        return;
    }

    fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (data) => {
            // CSV fields: Medicine Name, Composition, Uses, Side_effects, Image URL, Manufacturer, Excellent Review %, Average Review %, Poor Review %
            // Adding default quantity of 67 and price of 420 for all medicines
            results.push([
                data['Medicine Name'],
                data['Composition'],
                data['Uses'],
                data['Side_effects'],
                data['Image URL'],
                data['Manufacturer'],
                67,  // Default quantity
                420, // Default price
                parseFloat(data['Excellent Review %']) || 0,
                parseFloat(data['Average Review %']) || 0,
                parseFloat(data['Poor Review %']) || 0
            ]);
        })
        .on('end', () => {
            const stmt = db.prepare(`INSERT INTO medicines (name, composition, uses, side_effects, image_url, manufacturer, quantity, price, excellent_review_pct, average_review_pct, poor_review_pct) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

            db.serialize(() => {
                db.run("BEGIN TRANSACTION");
                results.forEach(row => {
                    stmt.run(row);
                });
                db.run("COMMIT", () => {
                    console.log(`Seeding completed. Inserted ${results.length} rows with default quantity 67 and price 420.`);
                    stmt.finalize();
                    db.close();
                });
            });
        });
}
