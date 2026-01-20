const Razorpay = require('razorpay');
const crypto = require('crypto');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Create Payment Order
exports.createPaymentOrder = async (req, res) => {
    try {
        const { amount, currency = 'INR' } = req.body;
        const userId = req.user.id;

        if (!amount || amount < 10) {
            return res.status(400).json({
                success: false,
                message: 'Minimum amount is ₹10'
            });
        }

        // Create Razorpay order
        const options = {
            amount: amount * 100, // Razorpay expects amount in paise
            currency,
            receipt: `receipt_${Date.now()}`,
            notes: {
                userId: userId.toString()
            }
        };

        const razorpayOrder = await razorpay.orders.create(options);

        // Create transaction record
        const transaction = await Transaction.create({
            user: userId,
            amount,
            type: 'deposit',
            status: 'pending',
            paymentMethod: 'razorpay',
            gatewayOrderId: razorpayOrder.id,
            description: `Deposit of ₹${amount}`
        });

        res.json({
            success: true,
            orderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            key: process.env.RAZORPAY_KEY_ID,
            transactionId: transaction._id
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Verify Payment
exports.verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            transactionId
        } = req.body;

        // Verify signature
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: 'Invalid payment signature'
            });
        }

        // Get transaction
        const transaction = await Transaction.findById(transactionId);
        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        // Update transaction
        transaction.status = 'completed';
        transaction.gatewayPaymentId = razorpay_payment_id;
        transaction.razorpaySignature = razorpay_signature;
        transaction.metadata = {
            verifiedAt: new Date()
        };
        await transaction.save();

        // Update user balance
        const user = await User.findById(transaction.user);
        user.balance += transaction.amount;
        await user.save();

        // Get updated user data
        const updatedUser = await User.findById(transaction.user)
            .select('-password -verificationToken -resetPasswordToken -resetPasswordExpires');

        res.json({
            success: true,
            message: 'Payment verified successfully',
            transaction: {
                id: transaction._id,
                amount: transaction.amount,
                status: transaction.status
            },
            user: updatedUser
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Manual UPI Payment
exports.createUpiPayment = async (req, res) => {
    try {
        const { amount, upiId } = req.body;
        const userId = req.user.id;

        if (!amount || amount < 10) {
            return res.status(400).json({
                success: false,
                message: 'Minimum amount is ₹10'
            });
        }

        // Generate UPI payment details
        const upiTransactionId = `UPI${Date.now()}${Math.random().toString(36).substr(2, 9)}`.toUpperCase();
        
        // Create transaction
        const transaction = await Transaction.create({
            user: userId,
            amount,
            type: 'deposit',
            status: 'pending',
            paymentMethod: 'upi',
            upiId,
            upiTransactionId,
            description: `UPI deposit of ₹${amount}`
        });

        // Generate UPI payment URL
        const upiPaymentUrl = `upi://pay?pa=ytsubboost@upi&pn=YTSubBoost&am=${amount}&cu=INR&tn=Deposit for YTSubBoost`;

        res.json({
            success: true,
            message: 'UPI payment initiated',
            transactionId: transaction._id,
            upiPaymentUrl,
            upiDetails: {
                upiId: 'ytsubboost@upi',
                amount,
                transactionId: upiTransactionId,
                notes: 'Deposit for YTSubBoost'
            },
            qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiPaymentUrl)}`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Manual Payment Confirmation (Admin/Manual)
exports.confirmManualPayment = async (req, res) => {
    try {
        const { transactionId, paymentMethod, notes } = req.body;

        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only admins can confirm manual payments'
            });
        }

        const transaction = await Transaction.findById(transactionId);
        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        if (transaction.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Transaction already processed'
            });
        }

        // Update transaction
        transaction.status = 'completed';
        transaction.paymentMethod = paymentMethod;
        transaction.description = notes || transaction.description;
        transaction.metadata = {
            confirmedBy: req.user.id,
            confirmedAt: new Date()
        };
        await transaction.save();

        // Update user balance
        const user = await User.findById(transaction.user);
        user.balance += transaction.amount;
        await user.save();

        res.json({
            success: true,
            message: 'Payment confirmed successfully',
            transaction
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get Payment History
exports.getPaymentHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const { type, status, limit = 10, page = 1 } = req.query;

        const query = { user: userId };
        if (type) query.type = type;
        if (status) query.status = status;

        const transactions = await Transaction.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Transaction.countDocuments(query);
        const totalDeposits = await Transaction.aggregate([
            { $match: { user: userId, type: 'deposit', status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        const totalSpent = await Transaction.aggregate([
            { $match: { user: userId, type: 'order_payment', status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        res.json({
            success: true,
            transactions,
            summary: {
                totalDeposits: totalDeposits[0]?.total || 0,
                totalSpent: totalSpent[0]?.total || 0
            },
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

// Get Payment Methods
exports.getPaymentMethods = async (req, res) => {
    try {
        const methods = [
            {
                id: 'upi',
                name: 'UPI',
                description: 'Pay using any UPI app',
                minAmount: 10,
                maxAmount: 100000,
                fees: 0,
                processingTime: 'Instant',
                icon: 'fa-mobile-alt'
            },
            {
                id: 'card',
                name: 'Credit/Debit Card',
                description: 'Visa, Mastercard, RuPay',
                minAmount: 10,
                maxAmount: 100000,
                fees: '2%',
                processingTime: 'Instant',
                icon: 'fa-credit-card'
            },
            {
                id: 'netbanking',
                name: 'Net Banking',
                description: 'All major Indian banks',
                minAmount: 10,
                maxAmount: 100000,
                fees: '₹5 + GST',
                processingTime: 'Instant',
                icon: 'fa-university'
            },
            {
                id: 'paytm',
                name: 'Paytm Wallet',
                description: 'Pay using Paytm wallet',
                minAmount: 10,
                maxAmount: 20000,
                fees: 0,
                processingTime: 'Instant',
                icon: 'fa-wallet'
            },
            {
                id: 'google_pay',
                name: 'Google Pay',
                description: 'Pay using Google Pay',
                minAmount: 10,
                maxAmount: 100000,
                fees: 0,
                processingTime: 'Instant',
                icon: 'fa-google'
            },
            {
                id: 'phonepe',
                name: 'PhonePe',
                description: 'Pay using PhonePe',
                minAmount: 10,
                maxAmount: 100000,
                fees: 0,
                processingTime: 'Instant',
                icon: 'fa-mobile'
            }
        ];

        res.json({
            success: true,
            methods
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Withdraw Funds
exports.withdrawFunds = async (req, res) => {
    try {
        const { amount, upiId } = req.body;
        const userId = req.user.id;

        if (!amount || amount < 100) {
            return res.status(400).json({
                success: false,
                message: 'Minimum withdrawal amount is ₹100'
            });
        }

        if (!upiId) {
            return res.status(400).json({
                success: false,
                message: 'UPI ID is required for withdrawal'
            });
        }

        // Check user balance
        const user = await User.findById(userId);
        if (user.balance < amount) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient balance'
            });
        }

        // Check withdrawal limit
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todaysWithdrawals = await Transaction.aggregate([
            {
                $match: {
                    user: userId,
                    type: 'withdrawal',
                    status: 'completed',
                    createdAt: { $gte: today }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);

        const dailyLimit = 50000;
        const todaysTotal = todaysWithdrawals[0]?.total || 0;
        
        if (todaysTotal + amount > dailyLimit) {
            return res.status(400).json({
                success: false,
                message: `Daily withdrawal limit of ₹${dailyLimit} exceeded`
            });
        }

        // Deduct balance
        user.balance -= amount;
        await user.save();

        // Create withdrawal transaction
        const transaction = await Transaction.create({
            user: userId,
            amount,
            type: 'withdrawal',
            status: 'pending',
            paymentMethod: 'upi',
            upiId,
            description: `Withdrawal to UPI: ${upiId}`,
            metadata: {
                requestedAt: new Date(),
                processedBy: 'system'
            }
        });

        // Process withdrawal (in production, integrate with payment gateway)
        // For now, mark as completed after 1 minute
        setTimeout(async () => {
            transaction.status = 'completed';
            transaction.metadata.processedAt = new Date();
            await transaction.save();
        }, 60000);

        res.json({
            success: true,
            message: 'Withdrawal request submitted',
            transactionId: transaction._id,
            estimatedTime: '1-2 business days',
            newBalance: user.balance
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};