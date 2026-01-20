const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    },
    amount: {
        type: Number,
        required: true,
        min: 1
    },
    type: {
        type: String,
        enum: ['deposit', 'withdrawal', 'order_payment', 'refund', 'referral_bonus'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        enum: ['upi', 'card', 'netbanking', 'paytm', 'google_pay', 'phonepe'],
        required: true
    },
    paymentGateway: {
        type: String,
        enum: ['razorpay', 'paytm', 'stripe', 'manual']
    },
    gatewayTransactionId: String,
    gatewayOrderId: String,
    gatewayPaymentId: String,
    razorpaySignature: String,
    upiId: String,
    upiTransactionId: String,
    bankDetails: {
        accountNumber: String,
        ifscCode: String,
        accountHolder: String
    },
    cardDetails: {
        last4: String,
        cardType: String
    },
    description: String,
    metadata: mongoose.Schema.Types.Mixed
}, {
    timestamps: true
});

// Index for faster queries
transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ gatewayTransactionId: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);