const User = require('../models/User');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const Channel = require('../models/Channel');

// Get Dashboard Stats
exports.getDashboardStats = async (req, res) => {
    try {
        const userId = req.user.id;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Get user info
        const user = await User.findById(userId)
            .select('name email balance totalSpent totalSubscribers referralCode createdAt');

        // Get order statistics
        const ordersStats = await Order.aggregate([
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
                    }
                }
            }
        ]);

        // Get recent orders
        const recentOrders = await Order.find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(5)
            .select('channelUrl targetSubscribers price status progress createdAt');

        // Get recent transactions
        const recentTransactions = await Transaction.find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(5)
            .select('amount type status paymentMethod description createdAt');

        // Get channel statistics
        const channelStats = await Channel.aggregate([
            { $match: { user: userId } },
            {
                $group: {
                    _id: null,
                    totalChannels: { $sum: 1 },
                    totalOrders: { $sum: '$totalOrders' },
                    totalSubscribersAdded: { $sum: '$totalSubscribersAdded' }
                }
            }
        ]);

        // Get daily order chart data
        const dailyOrders = await Order.aggregate([
            {
                $match: {
                    user: userId,
                    createdAt: { $gte: thirtyDaysAgo }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                    },
                    count: { $sum: 1 },
                    subscribers: { $sum: '$targetSubscribers' },
                    revenue: { $sum: '$price' }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.json({
            success: true,
            user,
            stats: {
                totalOrders: ordersStats[0]?.totalOrders || 0,
                totalSubscribers: ordersStats[0]?.totalSubscribers || 0,
                totalSpent: ordersStats[0]?.totalSpent || 0,
                activeOrders: ordersStats[0]?.activeOrders || 0,
                completedOrders: ordersStats[0]?.completedOrders || 0,
                totalChannels: channelStats[0]?.totalChannels || 0
            },
            recentOrders,
            recentTransactions,
            chartData: {
                dailyOrders
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get User Channels
exports.getUserChannels = async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 10, page = 1 } = req.query;

        const channels = await Channel.find({ user: userId })
            .sort({ updatedAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Channel.countDocuments({ user: userId });

        res.json({
            success: true,
            channels,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get Analytics
exports.getAnalytics = async (req, res) => {
    try {
        const userId = req.user.id;
        const { period = '30d' } = req.query;

        let startDate = new Date();
        switch (period) {
            case '7d':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(startDate.getDate() - 30);
                break;
            case '90d':
                startDate.setDate(startDate.getDate() - 90);
                break;
            case '1y':
                startDate.setFullYear(startDate.getFullYear() - 1);
                break;
            default:
                startDate.setDate(startDate.getDate() - 30);
        }

        // Get order analytics
        const orderAnalytics = await Order.aggregate([
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
                    avgOrderValue: { $avg: '$price' }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Get channel performance
        const channelPerformance = await Channel.aggregate([
            { $match: { user: userId } },
            {
                $lookup: {
                    from: 'orders',
                    localField: 'channelId',
                    foreignField: 'channelId',
                    as: 'orders'
                }
            },
            {
                $project: {
                    channelId: 1,
                    title: 1,
                    thumbnail: 1,
                    totalOrders: 1,
                    totalSubscribersAdded: 1,
                    orderCount: { $size: '$orders' },
                    totalRevenue: {
                        $sum: '$orders.price'
                    },
                    lastOrderDate: { $max: '$orders.createdAt' }
                }
            },
            { $sort: { totalSubscribersAdded: -1 } },
            { $limit: 10 }
        ]);

        // Get payment method distribution
        const paymentDistribution = await Transaction.aggregate([
            {
                $match: {
                    user: userId,
                    type: 'deposit',
                    status: 'completed',
                    createdAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: '$paymentMethod',
                    count: { $sum: 1 },
                    amount: { $sum: '$amount' }
                }
            }
        ]);

        res.json({
            success: true,
            analytics: {
                period,
                startDate,
                orderAnalytics,
                channelPerformance,
                paymentDistribution
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get Referral Stats
exports.getReferralStats = async (req, res) => {
    try {
        const userId = req.user.id;

        // Get referral count and earnings
        const referralStats = await User.aggregate([
            { $match: { referredBy: userId } },
            {
                $group: {
                    _id: null,
                    totalReferrals: { $sum: 1 },
                    activeReferrals: {
                        $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
                    },
                    totalEarnings: { $sum: 50 } // ₹50 per referral
                }
            }
        ]);

        // Get recent referrals
        const recentReferrals = await User.find({ referredBy: userId })
            .sort({ createdAt: -1 })
            .limit(10)
            .select('name email createdAt totalSpent totalSubscribers');

        res.json({
            success: true,
            referralCode: req.user.referralCode,
            stats: {
                totalReferrals: referralStats[0]?.totalReferrals || 0,
                activeReferrals: referralStats[0]?.activeReferrals || 0,
                totalEarnings: referralStats[0]?.totalEarnings || 0
            },
            recentReferrals,
            referralLink: `${process.env.FRONTEND_URL}/signup?ref=${req.user.referralCode}`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get Notifications
exports.getNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Simulated notifications (in production, use Notification model)
        const notifications = [
            {
                id: 1,
                type: 'order_completed',
                title: 'Order Completed',
                message: 'Your order for 1000 subscribers has been completed successfully.',
                read: false,
                createdAt: new Date(Date.now() - 3600000)
            },
            {
                id: 2,
                type: 'payment_received',
                title: 'Payment Received',
                message: '₹500 has been added to your wallet.',
                read: true,
                createdAt: new Date(Date.now() - 86400000)
            },
            {
                id: 3,
                type: 'referral_bonus',
                title: 'Referral Bonus',
                message: 'You earned ₹50 from a new referral.',
                read: false,
                createdAt: new Date(Date.now() - 172800000)
            }
        ];

        res.json({
            success: true,
            notifications,
            unreadCount: notifications.filter(n => !n.read).length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};