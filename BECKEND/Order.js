const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    channelUrl: {
        type: String,
        required: true
    },
    channelId: {
        type: String,
        required: true
    },
    channelName: String,
    currentSubscribers: Number,
    targetSubscribers: {
        type: Number,
        required: true,
        min: 50
    },
    price: {
        type: Number,
        required: true,
        min: 1
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
        default: 'pending'
    },
    progress: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    subscribersDelivered: {
        type: Number,
        default: 0
    },
    startedAt: Date,
    completedAt: Date,
    estimatedCompletion: Date,
    notes: String,
    payment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction'
    }
}, {
    timestamps: true
});

// Calculate price based on subscribers
orderSchema.statics.calculatePrice = function(subscribers) {
    const ratePerSubscriber = 1 / 50; // ₹1 for 50 subscribers
    return Math.max(1, Math.ceil(subscribers * ratePerSubscriber));
};

module.exports = mongoose.model('Order', orderSchema);