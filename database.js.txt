const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'nfc_shortener.db');

class Database {
    constructor() {
        this.db = null;
    }

    initialize() {
        const dbExists = fs.existsSync(DB_PATH);
        this.db = new sqlite3.Database(DB_PATH);
        
        if (!dbExists) {
            this.createTables();
        }
        this.db.run('PRAGMA foreign_keys = ON');
    }

    createTables() {
        console.log('Creating database tables...');
        
        this.db.run(`
            CREATE TABLE IF NOT EXISTS short_urls (
                id TEXT PRIMARY KEY,
                original_url TEXT NOT NULL,
                vcf_filename TEXT NOT NULL,
                contact_name TEXT,
                created_at INTEGER NOT NULL,
                expires_at INTEGER,
                password_hash TEXT,
                click_limit INTEGER,
                click_count INTEGER DEFAULT 0
            )
        `);

        this.db.run(`
            CREATE TABLE IF NOT EXISTS analytics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                short_id TEXT NOT NULL,
                accessed_at INTEGER NOT NULL,
                user_agent TEXT,
                ip_address TEXT,
                referer TEXT,
                FOREIGN KEY (short_id) REFERENCES short_urls(id) ON DELETE CASCADE
            )
        `);
        
        console.log('Database tables created');
    }

    createShortUrl(id, originalUrl, vcfFilename, contactName, options = {}) {
        return new Promise((resolve, reject) => {
            const now = Date.now();
            const expiresAt = options.expiresIn ? now + (options.expiresIn * 1000) : null;
            const clickLimit = options.clickLimit || null;
            
            const stmt = this.db.prepare(`
                INSERT INTO short_urls 
                (id, original_url, vcf_filename, contact_name, created_at, expires_at, click_limit, click_count)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            stmt.run(id, originalUrl, vcfFilename, contactName, now, expiresAt, clickLimit, 0, function(err) {
                if (err) reject(err);
                else resolve({ id, created: true });
            });
            stmt.finalize();
        });
    }

    getShortUrl(id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM short_urls WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    incrementClickCount(id, userAgent, ipAddress, referer) {
        return new Promise((resolve, reject) => {
            this.db.run('BEGIN TRANSACTION');
            
            this.db.run('UPDATE short_urls SET click_count = click_count + 1 WHERE id = ?', [id], (err) => {
                if (err) { this.db.run('ROLLBACK'); reject(err); return; }
                
                this.db.run(
                    `INSERT INTO analytics (short_id, accessed_at, user_agent, ip_address, referer)
                     VALUES (?, ?, ?, ?, ?)`,
                    [id, Date.now(), userAgent, ipAddress, referer],
                    (err) => {
                        if (err) { this.db.run('ROLLBACK'); reject(err); return; }
                        this.db.run('COMMIT', (err) => { if (err) reject(err); else resolve(true); });
                    }
                );
            });
        });
    }

    getStats(id) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT u.*, COUNT(a.id) as total_clicks 
                 FROM short_urls u
                 LEFT JOIN analytics a ON u.id = a.short_id
                 WHERE u.id = ?
                 GROUP BY u.id`,
                [id],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }
}

module.exports = new Database();