const express = require('express');
const path = require('path');
const fs = require('fs');
const database = require('../database');

const router = express.Router();

router.get('/:id', async (req, res) => {
    const shortId = req.params.id;
    
    try {
        const urlInfo = await database.getShortUrl(shortId);
        
        if (!urlInfo) {
            return res.status(404).send('Link not found');
        }
        
        if (urlInfo.expires_at && urlInfo.expires_at < Date.now()) {
            return res.status(410).send('Link expired');
        }
        
        if (urlInfo.click_limit && urlInfo.click_count >= urlInfo.click_limit) {
            return res.status(410).send('Link limit reached');
        }
        
        const userAgent = req.headers['user-agent'] || 'Unknown';
        const ipAddress = req.ip || req.connection.remoteAddress;
        
        await database.incrementClickCount(shortId, userAgent, ipAddress, null);
        
        const vcfPath = path.join(__dirname, '../uploads', urlInfo.vcf_filename);
        
        if (!fs.existsSync(vcfPath)) {
            return res.status(404).send('Contact file not found');
        }
        
        res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
        res.setHeader('Content-Disposition', `inline; filename="contact_${shortId}.vcf"`);
        
        const vcfContent = fs.readFileSync(vcfPath, 'utf-8');
        res.send(vcfContent);
        
    } catch (error) {
        console.error('Redirect error:', error);
        res.status(500).send('Internal server error');
    }
});

module.exports = router;