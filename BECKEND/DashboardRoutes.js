const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { auth } = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// Get dashboard stats
router.get('/stats', dashboardController.getDashboardStats);

// Get user channels
router.get('/channels', dashboardController.getUserChannels);

// Get analytics
router.get('/analytics', dashboardController.getAnalytics);

// Get referral stats
router.get('/referrals', dashboardController.getReferralStats);

// Get notifications
router.get('/notifications', dashboardController.getNotifications);

module.exports = router;