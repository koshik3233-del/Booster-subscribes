const mongoose = require('mongoose');

const channelSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    channelId: {
        type: String,
        required: true,
        unique: true
    },
    channelUrl: {
        type: String,
        required: true
    },
    title: String,
    description: String,
    thumbnail: String,
    subscriberCount: Number,
    videoCount: Number,
    viewCount: Number,
    isVerified: {
        type: Boolean,
        default: false
    },
    lastChecked: Date,
    totalOrders: {
        type: Number,
        default: 0
    },
    totalSubscribersAdded: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Channel', channelSchema);