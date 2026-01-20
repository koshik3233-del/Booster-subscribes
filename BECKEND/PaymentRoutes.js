const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const paymentController = require('../controllers/paymentController');
const { auth, adminAuth } = require('../middleware/auth');
const validate = require('../middleware/validation');

// Protected routes
router.use(auth);

// Create Razorpay order
router.post('/create-order', [
    body('amount').isInt({ min: 10 }).withMessage('Minimum amount is ₹10'),
    body('currency').optional().isIn(['INR']).withMessage('Only INR currency supported')
], validate, paymentController.createPaymentOrder);

// Verify payment
router.post('/verify', [
    body('razorpay_order_id').notEmpty().withMessage('Order ID is required'),
    body('razorpay_payment_id').notEmpty().withMessage('Payment ID is required'),
    body('razorpay_signature').notEmpty().withMessage('Signature is required'),
    body('transactionId').notEmpty().withMessage('Transaction ID is required')
], validate, paymentController.verifyPayment);

// Create UPI payment
router.post('/upi', [
    body('amount').isInt({ min: 10 }).withMessage('Minimum amount is ₹10'),
    body('upiId').optional().isString()
], validate, paymentController.createUpiPayment);

// Get payment methods
router.get('/methods', paymentController.getPaymentMethods);

// Get payment history
router.get('/history', paymentController.getPaymentHistory);

// Withdraw funds
router.post('/withdraw', [
    body('amount').isInt({ min: 100 }).withMessage('Minimum withdrawal amount is ₹100'),
    body('upiId').notEmpty().withMessage('UPI ID is required')
], validate, paymentController.withdrawFunds);

// Admin routes
router.post('/confirm-payment', adminAuth, [
    body('transactionId').notEmpty().withMessage('Transaction ID is required'),
    body('paymentMethod').notEmpty().withMessage('Payment method is required')
], validate, paymentController.confirmManualPayment);

module.exports = router;