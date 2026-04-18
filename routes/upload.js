const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const database = require('../database');

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/vcard' || file.originalname.endsWith('.vcf')) {
            cb(null, true);
        } else {
            cb(new Error('Only VCF files are allowed'), false);
        }
    }
});

function generateRandomId(length = 6) {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let id = '';
    const bytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
        id += chars[bytes[i] % chars.length];
    }
    return id;
}

function parseVCF(vcfContent) {
    const contact = { name: 'Unknown' };
    const lines = vcfContent.split('\n');
    for (const line of lines) {
        if (line.startsWith('FN:')) {
            contact.name = line.substring(3).trim();
            break;
        }
    }
    return contact;
}

router.post('/', upload.single('vcf'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No VCF file provided' });
        }
        
        const vcfContent = req.file.buffer.toString('utf-8');
        const parsed = parseVCF(vcfContent);
        
        let shortId;
        let existing;
        do {
            shortId = generateRandomId(6);
            existing = await database.getShortUrl(shortId);
        } while (existing);
        
        const filename = `${shortId}.vcf`;
        const filepath = path.join(__dirname, '../uploads', filename);
        fs.writeFileSync(filepath, vcfContent);
        
        const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
        const originalUrl = `${baseUrl}/uploads/${filename}`;
        
        await database.createShortUrl(shortId, originalUrl, filename, parsed.name);
        
        const shortUrl = `${baseUrl}/r/${shortId}`;
        
        res.json({
            success: true,
            shortUrl: shortUrl,
            id: shortId,
            contactName: parsed.name
        });
        
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to create short URL' });
    }
});

module.exports = router;