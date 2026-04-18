const express = require('express');
const database = require('../database');

const router = express.Router();

router.get('/:id', async (req, res) => {
    const shortId = req.params.id;
    
    try {
        const stats = await database.getStats(shortId);
        
        if (!stats) {
            return res.status(404).json({ error: 'URL not found' });
        }
        
        res.json({
            id: stats.id,
            contactName: stats.contact_name,
            createdAt: new Date(stats.created_at).toISOString(),
            totalClicks: stats.click_count || 0
        });
        
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Failed to get statistics' });
    }
});

router.delete('/:id', async (req, res) => {
    res.status(403).json({ error: 'Delete not available' });
});

module.exports = router;