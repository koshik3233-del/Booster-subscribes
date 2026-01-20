const Order = require('../models/Order');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Channel = require('../models/Channel');
const crypto = require('crypto');
const axios = require('axios');

// Extract YouTube Channel ID from URL
const extractChannelId = (url) => {
    try {
        const urlObj = new URL(url);
        const path = urlObj.pathname;
        
        // Different patterns for YouTube URLs
        if (path.includes('/channel/')) {
            return path.split('/channel/')[1].split('/')[0];
        } else if (path.includes('/c/')) {
            return path.split('/c/')[1].split('/')[0];
        } else if (path.includes('/user/')) {
            return path.split('/user/')[1].split('/')[0];
        } else if (path.includes('/@')) {
            return path.split('/@')[1].split('/')[0];
        } else if (urlObj.hostname.includes('youtu.be')) {
            // Handle youtu.be shortened URLs
            const videoId = path.substring(1);
            // Would need YouTube API to get channel ID from video ID
            return null;
        }
        return null;
    } catch (error) {
        // If URL parsing fails, try regex
        const patterns = [
            /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
            /youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
            /youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
            /youtube\.com\/@([a-zA-Z0-9_-]+)/
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    }
};

// Verify YouTube Channel (Simulated - In production use YouTube API)
exports.verifyChannel = async (req, res) => {
    try {
        const { channelUrl } = req.body;
        const userId = req.user.id;

        if (!channelUrl) {
            return res.status(400).json({
                success: false,
                message: 'Channel URL is required'
            });
        }

        // Extract channel ID
        const channelId = extractChannelId(channelUrl);
        if (!channelId) {
            return res.status(400).json({
                success: false,
                message: 'Invalid YouTube channel URL. Please use a valid channel URL.'
            });
        }

        // Check if channel already exists for user
        let channel = await Channel.findOne({ user: userId, channelId });

        // Simulate channel info (In production, use YouTube Data API)
        const channelInfo = {
            id: channelId,
            title: `YouTube Channel - ${channelId.substring(0, 8)}...`,
            thumbnail: `https://ui-avatars.com/api/?name=YouTube&background=ff0000&color=fff&size=150`,
            subscriberCount: Math.floor(Math.random() * 10000) + 100,
            videoCount: Math.floor(Math.random() * 100) + 10,
            viewCount: Math.floor(Math.random() * 1000000) + 10000,
            isVerified: Math.random() > 0.7 // 30% chance of being verified
        };

        if (!channel) {
            // Create new channel entry
            channel = await Channel.create({
                user: userId,
                channelId,
                channelUrl,
                title: channelInfo.title,
                thumbnail: channelInfo.thumbnail,
                subscriberCount: channelInfo.subscriberCount,
                videoCount: channelInfo.videoCount,
                viewCount: channelInfo.viewCount,
                isVerified: channelInfo.isVerified,
                lastChecked: new Date()
            });
        } else {
            // Update existing channel info
            channel.title = channelInfo.title;
            channel.thumbnail = channelInfo.thumbnail;
            channel.subscriberCount = channelInfo.subscriberCount;
            channel.videoCount = channelInfo.videoCount;
            channel.viewCount = channelInfo.viewCount;
            channel.isVerified = channelInfo.isVerified;
            channel.lastChecked = new Date();
            await channel.save();
        }

        res.json({
            success: true,
            channel: channelInfo,
            message: 'Channel verified successfully'
        });
    } catch (error) {
        console.error('Channel verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Error verifying channel. Please try again.'
        });
    }
};

// Calculate Order Price
exports.calculatePrice = async (req, res) => {
    try {
        const { subscribers } = req.body;

        if (!subscribers || subscribers < 50) {
            return res.status(400).json({
                success: false,
                message: 'Minimum 50 subscribers required'
            });
        }

        if (subscribers > 100000) {
            return res.status(400).json({
                success: false,
                message: 'Maximum 100,000 subscribers per order'
            });
        }

        const price = Math.ceil(subscribers / 50); // ₹1 for 50 subscribers
        
        // Apply bulk discounts
        let discount = 0;
        if (subscribers >= 5000) discount = 10;
        if (subscribers >= 10000) discount = 15;
        if (subscribers >= 50000) discount = 20;
        
        const discountedPrice = price - (price * discount / 100);
        const finalPrice = Math.max(1, Math.ceil(discountedPrice));

        res.json({
            success: true,
            calculation: {
                subscribers,
                basePrice: price,
                discountPercentage: discount,
                discountAmount: price - finalPrice,
                finalPrice,
                rate: '₹1 for 50 subscribers',
                bulkDiscount: discount > 0 ? `${discount}% off for bulk order` : null
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Create Order
exports.createOrder = async (req, res) => {
    try {
        const { channelUrl, subscribers, notes } = req.body;
        const userId = req.user.id;

        // Validate inputs
        if (!channelUrl || !subscribers) {
            return res.status(400).json({
                success: false,
                message: 'Channel URL and subscribers count are required'
            });
        }

        if (subscribers < 50) {
            return res.status(400).json({
                success: false,
                message: 'Minimum 50 subscribers required'
            });
        }

        if (subscribers > 100000) {
            return res.status(400).json({
                success: false,
                message: 'Maximum 100,000 subscribers per order'
            });
        }

        // Calculate price
        const basePrice = Math.ceil(subscribers / 50);
        let discount = 0;
        if (subscribers >= 5000) discount = 10;
        if (subscribers >= 10000) discount = 15;
        if (subscribers >= 50000) discount = 20;
        
        const price = Math.max(1, Math.ceil(basePrice - (basePrice * discount / 100)));

        // Check user balance
        const user = await User.findById(userId);
        if (user.balance < price) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient balance. Please deposit funds.',
                requiredAmount: price,
                currentBalance: user.balance,
                shortBy: price - user.balance
            });
        }

        // Extract channel ID
        const channelId = extractChannelId(channelUrl);
        if (!channelId) {
            return res.status(400).json({
                success: false,
                message: 'Invalid YouTube channel URL'
            });
        }

        // Check if channel exists for user
        let channel = await Channel.findOne({ user: userId, channelId });
        if (!channel) {
            // Channel not verified yet
            return res.status(400).json({
                success: false,
                message: 'Please verify your channel first'
            });
        }

        // Deduct balance
        user.balance -= price;
        user.totalSpent += price;
        await user.save();

        // Create transaction record
        const transaction = await Transaction.create({
            user: userId,
            amount: price,
            type: 'order_payment',
            status: 'completed',
            paymentMethod: 'wallet',
            description: `Payment for ${subscribers} YouTube subscribers`,
            metadata: {
                channelUrl,
                subscribers,
                originalPrice: basePrice,
                discountApplied: discount
            }
        });

        // Create order
        const order = await Order.create({
            user: userId,
            channelUrl,
            channelId,
            channelName: channel.title,
            currentSubscribers: channel.subscriberCount,
            targetSubscribers: subscribers,
            price,
            status: 'processing',
            progress: 0,
            subscribersDelivered: 0,
            startedAt: new Date(),
            estimatedCompletion: new Date(Date.now() + (subscribers * 100)), // 100ms per subscriber
            notes,
            payment: transaction._id
        });

        // Update channel stats
        channel.totalOrders += 1;
        channel.totalSubscribersAdded += subscribers;
        channel.lastChecked = new Date();
        await channel.save();

        // Start order processing
        startOrderProcessing(order._id, subscribers, userId);

        // Get socket.io instance for real-time updates
        const io = req.app.get('socketio');
        if (io) {
            io.to(`user-${userId}`).emit('order-created', {
                orderId: order._id,
                subscribers,
                price,
                estimatedCompletion: order.estimatedCompletion
            });
        }

        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            order: {
                id: order._id,
                channelUrl: order.channelUrl,
                channelName: order.channelName,
                targetSubscribers: order.targetSubscribers,
                price: order.price,
                status: order.status,
                progress: order.progress,
                startedAt: order.startedAt,
                estimatedCompletion: order.estimatedCompletion,
                notes: order.notes
            },
            user: {
                balance: user.balance,
                totalSpent: user.totalSpent
            }
        });
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating order. Please try again.'
        });
    }
};

// Get User Orders
exports.getOrders = async (req, res) => {
    try {
        const userId = req.user.id;
        const { 
            status, 
            limit = 20, 
            page = 1,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Build query
        const query = { user: userId };
        if (status && status !== 'all') {
            query.status = status;
        }

        // Build sort
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Execute query
        const orders = await Order.find(query)
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .populate('payment', 'amount status createdAt')
            .lean();

        // Format dates for frontend
        orders.forEach(order => {
            order.createdAt = new Date(order.createdAt).toISOString();
            order.updatedAt = new Date(order.updatedAt).toISOString();
            if (order.startedAt) order.startedAt = new Date(order.startedAt).toISOString();
            if (order.completedAt) order.completedAt = new Date(order.completedAt).toISOString();
            if (order.estimatedCompletion) order.estimatedCompletion = new Date(order.estimatedCompletion).toISOString();
        });

        const total = await Order.countDocuments(query);

        // Calculate statistics
        const stats = await Order.aggregate([
            { $match: { user: userId } },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalSubscribers: { $sum: '$targetSubscribers' },
                    totalSpent: { $sum: '$price' },
                    activeOrders: {
                        $sum: { $cond: [{ $in: ['$status', ['pending', 'processing']] }, 1, 0] }
                    },
                    completedOrders: {
                        $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                    },
                    failedOrders: {
                        $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
                    }
                }
            }
        ]);

        res.json({
            success: true,
            orders,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                limit: parseInt(limit)
            },
            stats: stats[0] || {
                totalOrders: 0,
                totalSubscribers: 0,
                totalSpent: 0,
                activeOrders: 0,
                completedOrders: 0,
                failedOrders: 0
            }
        });
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching orders'
        });
    }
};

// Get Order by ID
exports.getOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const order = await Order.findOne({ _id: id, user: userId })
            .populate('payment', 'amount status paymentMethod createdAt gatewayTransactionId')
            .lean();

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Format dates
        order.createdAt = new Date(order.createdAt).toISOString();
        order.updatedAt = new Date(order.updatedAt).toISOString();
        if (order.startedAt) order.startedAt = new Date(order.startedAt).toISOString();
        if (order.completedAt) order.completedAt = new Date(order.completedAt).toISOString();
        if (order.estimatedCompletion) order.estimatedCompletion = new Date(order.estimatedCompletion).toISOString();

        // Calculate estimated time remaining
        let timeRemaining = 'Completed';
        if (order.status === 'processing') {
            const now = new Date();
            const completionTime = new Date(order.estimatedCompletion);
            if (completionTime > now) {
                const diffMs = completionTime - now;
                const diffMins = Math.floor(diffMs / 60000);
                const diffSecs = Math.floor((diffMs % 60000) / 1000);
                timeRemaining = `${diffMins}m ${diffSecs}s`;
            }
        }

        res.json({
            success: true,
            order: {
                ...order,
                timeRemaining
            }
        });
    } catch (error) {
        console.error('Get order by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching order details'
        });
    }
};

// Cancel Order
exports.cancelOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const order = await Order.findOne({ _id: id, user: userId });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Check if order can be cancelled
        if (!['pending', 'processing'].includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot cancel order with status: ${order.status}`
            });
        }

        // Refund logic based on progress
        let refundAmount = 0;
        let message = 'Order cancelled successfully';

        if (order.status === 'pending') {
            // Full refund for pending orders
            refundAmount = order.price;
            message += ' with full refund';
        } else if (order.status === 'processing' && order.progress < 50) {
            // Partial refund for orders less than 50% complete
            refundAmount = Math.floor(order.price * (100 - order.progress) / 100);
            message += ` with ${100 - order.progress}% refund`;
        } else {
            // No refund for orders more than 50% complete
            message += '. No refund available as order was more than 50% complete';
        }

        // Process refund if applicable
        if (refundAmount > 0) {
            const user = await User.findById(userId);
            user.balance += refundAmount;
            await user.save();

            // Update transaction status
            await Transaction.findByIdAndUpdate(order.payment, {
                status: 'refunded',
                metadata: {
                    refundAmount,
                    refundReason: 'order_cancellation',
                    cancelledAt: new Date()
                }
            });

            // Create refund transaction
            await Transaction.create({
                user: userId,
                amount: refundAmount,
                type: 'refund',
                status: 'completed',
                paymentMethod: 'wallet',
                description: `Refund for cancelled order #${order._id}`,
                metadata: {
                    originalOrder: order._id,
                    originalAmount: order.price,
                    refundPercentage: Math.floor((refundAmount / order.price) * 100)
                }
            });
        }

        // Update order status
        order.status = 'cancelled';
        order.progress = 0;
        order.completedAt = new Date();
        order.notes = order.notes ? `${order.notes}\nCancelled by user on ${new Date().toISOString()}` : 
                                   `Cancelled by user on ${new Date().toISOString()}`;
        await order.save();

        // Notify via socket
        const io = req.app.get('socketio');
        if (io) {
            io.to(`user-${userId}`).emit('order-cancelled', {
                orderId: order._id,
                refundAmount,
                status: order.status
            });
        }

        res.json({
            success: true,
            message,
            order: {
                id: order._id,
                status: order.status,
                refundAmount,
                newBalance: refundAmount > 0 ? (await User.findById(userId)).balance : undefined
            }
        });
    } catch (error) {
        console.error('Cancel order error:', error);
        res.status(500).json({
            success: false,
            message: 'Error cancelling order'
        });
    }
};

// Retry Failed Order
exports.retryOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const order = await Order.findOne({ _id: id, user: userId, status: 'failed' });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Failed order not found'
            });
        }

        // Check user balance
        const user = await User.findById(userId);
        if (user.balance < order.price) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient balance to retry order'
            });
        }

        // Deduct balance
        user.balance -= order.price;
        await user.save();

        // Create new transaction
        const transaction = await Transaction.create({
            user: userId,
            amount: order.price,
            type: 'order_payment',
            status: 'completed',
            paymentMethod: 'wallet',
            description: `Retry payment for failed order #${order._id}`,
            metadata: {
                retryOf: order._id,
                originalDate: order.createdAt
            }
        });

        // Create new order based on failed order
        const newOrder = await Order.create({
            user: userId,
            channelUrl: order.channelUrl,
            channelId: order.channelId,
            channelName: order.channelName,
            currentSubscribers: order.currentSubscribers,
            targetSubscribers: order.targetSubscribers,
            price: order.price,
            status: 'processing',
            progress: 0,
            subscribersDelivered: 0,
            startedAt: new Date(),
            estimatedCompletion: new Date(Date.now() + (order.targetSubscribers * 100)),
            notes: `Retry of failed order #${order._id}`,
            payment: transaction._id
        });

        // Start processing
        startOrderProcessing(newOrder._id, order.targetSubscribers, userId);

        res.json({
            success: true,
            message: 'Order retry initiated successfully',
            order: newOrder,
            newBalance: user.balance
        });
    } catch (error) {
        console.error('Retry order error:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrying order'
        });
    }
};

// Get Active Orders Count
exports.getActiveOrdersCount = async (req, res) => {
    try {
        const userId = req.user.id;

        const count = await Order.countDocuments({
            user: userId,
            status: { $in: ['pending', 'processing'] }
        });

        res.json({
            success: true,
            count
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get Order Statistics
exports.getOrderStatistics = async (req, res) => {
    try {
        const userId = req.user.id;
        const { period = 'month' } = req.query; // day, week, month, year

        let startDate = new Date();
        switch (period) {
            case 'day':
                startDate.setDate(startDate.getDate() - 1);
                break;
            case 'week':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case 'month':
                startDate.setMonth(startDate.getMonth() - 1);
                break;
            case 'year':
                startDate.setFullYear(startDate.getFullYear() - 1);
                break;
        }

        const stats = await Order.aggregate([
            {
                $match: {
                    user: userId,
                    createdAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                    },
                    orders: { $sum: 1 },
                    subscribers: { $sum: '$targetSubscribers' },
                    revenue: { $sum: '$price' },
                    averageOrderValue: { $avg: '$price' }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Calculate summary
        const summary = await Order.aggregate([
            {
                $match: {
                    user: userId,
                    createdAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalSubscribers: { $sum: '$targetSubscribers' },
                    totalRevenue: { $sum: '$price' },
                    avgOrderValue: { $avg: '$price' }
                }
            }
        ]);

        res.json({
            success: true,
            period,
            startDate,
            dailyStats: stats,
            summary: summary[0] || {
                totalOrders: 0,
                totalSubscribers: 0,
                totalRevenue: 0,
                avgOrderValue: 0
            }
        });
    } catch (error) {
        console.error('Order statistics error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching order statistics'
        });
    }
};

// Bulk Order Creation
exports.createBulkOrder = async (req, res) => {
    try {
        const { orders } = req.body; // Array of { channelUrl, subscribers }
        const userId = req.user.id;

        if (!Array.isArray(orders) || orders.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Orders array is required'
            });
        }

        if (orders.length > 10) {
            return res.status(400).json({
                success: false,
                message: 'Maximum 10 orders per bulk request'
            });
        }

        // Validate all orders
        for (const order of orders) {
            if (!order.channelUrl || !order.subscribers) {
                return res.status(400).json({
                    success: false,
                    message: 'Each order must have channelUrl and subscribers'
                });
            }
            if (order.subscribers < 50) {
                return res.status(400).json({
                    success: false,
                    message: 'Minimum 50 subscribers per order'
                });
            }
        }

        // Calculate total price
        let totalPrice = 0;
        const orderCalculations = orders.map(order => {
            const price = Math.ceil(order.subscribers / 50);
            totalPrice += price;
            return { ...order, price };
        });

        // Check user balance
        const user = await User.findById(userId);
        if (user.balance < totalPrice) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient balance for bulk order',
                requiredAmount: totalPrice,
                currentBalance: user.balance
            });
        }

        // Process each order
        const createdOrders = [];
        for (const orderData of orderCalculations) {
            const channelId = extractChannelId(orderData.channelUrl);
            if (!channelId) continue;

            // Check if channel exists
            let channel = await Channel.findOne({ user: userId, channelId });
            if (!channel) {
                // Skip unverified channels in bulk order
                continue;
            }

            // Create order
            const order = await Order.create({
                user: userId,
                channelUrl: orderData.channelUrl,
                channelId,
                channelName: channel.title,
                targetSubscribers: orderData.subscribers,
                price: orderData.price,
                status: 'processing',
                progress: 0,
                startedAt: new Date(),
                estimatedCompletion: new Date(Date.now() + (orderData.subscribers * 100))
            });

            createdOrders.push(order);
            
            // Start processing
            startOrderProcessing(order._id, orderData.subscribers, userId);
        }

        // Deduct total balance
        user.balance -= totalPrice;
        user.totalSpent += totalPrice;
        await user.save();

        // Create bulk transaction
        const transaction = await Transaction.create({
            user: userId,
            amount: totalPrice,
            type: 'order_payment',
            status: 'completed',
            paymentMethod: 'wallet',
            description: `Bulk payment for ${createdOrders.length} orders`,
            metadata: {
                orderCount: createdOrders.length,
                orderIds: createdOrders.map(o => o._id)
            }
        });

        // Update orders with transaction reference
        await Order.updateMany(
            { _id: { $in: createdOrders.map(o => o._id) } },
            { $set: { payment: transaction._id } }
        );

        res.status(201).json({
            success: true,
            message: `Bulk order created with ${createdOrders.length} orders`,
            orders: createdOrders,
            totalPrice,
            newBalance: user.balance
        });
    } catch (error) {
        console.error('Bulk order error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating bulk order'
        });
    }
};

// Helper function to start order processing
const startOrderProcessing = async (orderId, targetSubscribers, userId) => {
    const io = require('../server').io;
    
    try {
        let progress = 0;
        const interval = setInterval(async () => {
            try {
                progress += Math.random() * 5; // Random progress increment
                
                if (progress >= 100) {
                    progress = 100;
                    clearInterval(interval);
                    
                    // Complete order
                    const order = await Order.findByIdAndUpdate(orderId, {
                        status: 'completed',
                        progress: 100,
                        subscribersDelivered: targetSubscribers,
                        completedAt: new Date()
                    }, { new: true });

                    if (!order) return;

                    // Update user stats
                    await User.findByIdAndUpdate(userId, {
                        $inc: { totalSubscribers: targetSubscribers }
                    });

                    // Update channel stats
                    await Channel.findOneAndUpdate(
                        { user: userId, channelId: order.channelId },
                        { $inc: { totalSubscribersAdded: targetSubscribers } }
                    );

                    // Send completion notification
                    if (io) {
                        io.to(`user-${userId}`).emit('order-completed', {
                            orderId,
                            subscribers: targetSubscribers,
                            order: order.toObject()
                        });
                    }

                    // Send email notification (optional)
                    // await sendOrderCompletionEmail(userId, orderId);
                } else {
                    // Update progress
                    const order = await Order.findByIdAndUpdate(orderId, {
                        progress: Math.min(progress, 100),
                        subscribersDelivered: Math.floor((targetSubscribers * Math.min(progress, 100)) / 100)
                    }, { new: true });

                    if (!order) {
                        clearInterval(interval);
                        return;
                    }

                    // Send progress update
                    if (io) {
                        io.to(`user-${userId}`).emit('order-progress', {
                            orderId,
                            progress: Math.min(progress, 100),
                            subscribersDelivered: order.subscribersDelivered,
                            estimatedTimeRemaining: calculateTimeRemaining(progress, order.startedAt, order.estimatedCompletion)
                        });
                    }
                }
            } catch (error) {
                console.error('Order processing interval error:', error);
                clearInterval(interval);
                
                // Mark order as failed
                await Order.findByIdAndUpdate(orderId, {
                    status: 'failed',
                    notes: `Processing failed: ${error.message}`
                });
            }
        }, 1000); // Update every second

        // Store interval reference for potential cleanup
        const intervals = global.orderIntervals || {};
        intervals[orderId] = interval;
        global.orderIntervals = intervals;

        // Auto-cleanup after 24 hours
        setTimeout(() => {
            if (intervals[orderId]) {
                clearInterval(intervals[orderId]);
                delete intervals[orderId];
            }
        }, 24 * 60 * 60 * 1000);

    } catch (error) {
        console.error('Order processing error:', error);
        
        // Mark order as failed
        await Order.findByIdAndUpdate(orderId, {
            status: 'failed',
            notes: `Processing error: ${error.message}`
        });
    }
};

// Helper function to calculate time remaining
const calculateTimeRemaining = (progress, startedAt, estimatedCompletion) => {
    if (progress >= 100) return 'Completed';
    
    const now = new Date();
    const elapsed = now - new Date(startedAt);
    const totalEstimated = new Date(estimatedCompletion) - new Date(startedAt);
    
    if (progress > 0) {
        const estimatedTotalTime = elapsed / (progress / 100);
        const remainingTime = estimatedTotalTime - elapsed;
        
        const minutes = Math.floor(remainingTime / 60000);
        const seconds = Math.floor((remainingTime % 60000) / 1000);
        
        return `${minutes}m ${seconds}s`;
    }
    
    return 'Calculating...';
};

// Export helper function for testing
exports._testHelpers = {
    extractChannelId,
    calculateTimeRemaining
};