const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const orderController = require('../controllers/orderController');
const { auth } = require('../middleware/auth');
const validate = require('../middleware/validation');

// All routes require authentication
router.use(auth);

// Verify YouTube channel
router.post('/verify-channel', [
    body('channelUrl').notEmpty().withMessage('Channel URL is required')
], validate, orderController.verifyChannel);

// Calculate price
router.post('/calculate-price', [
    body('subscribers').isInt({ min: 50 }).withMessage('Minimum 50 subscribers required')
], validate, orderController.calculatePrice);

// Create order
router.post('/create', [
    body('channelUrl').notEmpty().withMessage('Channel URL is required'),
    body('subscribers').isInt({ min: 50 }).withMessage('Minimum 50 subscribers required')
], validate, orderController.createOrder);

// Get all orders
router.get('/', orderController.getOrders);

// Get single order
router.get('/:id', orderController.getOrderById);

// Cancel order
router.post('/:id/cancel', orderController.cancelOrder);

module.exports = router;