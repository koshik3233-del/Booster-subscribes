// YouTube Subscriber Booster - Frontend JavaScript
// Backend URL: booster-subscribes.vercel.app

const API_BASE_URL = 'https://booster-subscribes.vercel.app/api';
const SOCKET_URL = 'https://booster-subscribes.vercel.app';
let socket = null;
let currentUser = null;

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    initializeApplication();
    setupCommonEventListeners();
});

// Check authentication status
function checkAuth() {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    const currentPage = window.location.pathname;
    
    if (token && userData) {
        currentUser = JSON.parse(userData);
        
        // Redirect if on login page
        if (currentPage.includes('login.html') || currentPage.includes('index.html')) {
            window.location.href = 'dashboard.html';
        }
        
        // Connect WebSocket
        connectWebSocket(currentUser.id);
    } else {
        // Not logged in - redirect to login if on protected pages
        if (currentPage.includes('dashboard.html') || currentPage.includes('deposit.html')) {
            window.location.href = 'login.html';
        }
    }
}

// Initialize application based on page
function initializeApplication() {
    // Page-specific initializations
    const path = window.location.pathname;
    
    if (path.includes('login.html') || path.includes('index.html')) {
        initializeAuthPages();
    }
    
    if (path.includes('dashboard.html')) {
        initializeDashboard();
    }
    
    if (path.includes('deposit.html')) {
        initializeDepositPage();
    }
}

// Setup common event listeners
function setupCommonEventListeners() {
    // Logout button
    const logoutBtns = document.querySelectorAll('.logout-btn, [href="index.html"]');
    logoutBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            if (this.getAttribute('href') === 'index.html') {
                e.preventDefault();
                logout();
            }
        });
    });
    
    // Show/hide password
    document.querySelectorAll('.show-password').forEach(btn => {
        btn.addEventListener('click', function() {
            const input = this.closest('.input-group').querySelector('input');
            const icon = this.querySelector('i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });
    
    // Copy buttons
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const text = this.getAttribute('data-text');
            navigator.clipboard.writeText(text).then(() => {
                showNotification('Copied to clipboard!');
            });
        });
    });
}

// Initialize authentication pages
function initializeAuthPages() {
    // Login/Signup toggle
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const loginLink = document.getElementById('loginLink');
    const signupLink = document.getElementById('signupLink');
    
    if (loginLink && signupLink) {
        loginLink.addEventListener('click', (e) => {
            e.preventDefault();
            signupForm.style.display = 'none';
            loginForm.style.display = 'block';
        });
        
        signupLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.style.display = 'none';
            signupForm.style.display = 'block';
        });
    }
    
    // Login form submission
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            try {
                const response = await apiRequest('/auth/login', 'POST', { email, password });
                
                // Store token and user data
                localStorage.setItem('token', response.token);
                localStorage.setItem('user', JSON.stringify(response.user));
                
                // Connect WebSocket
                connectWebSocket(response.user.id);
                
                // Redirect to dashboard
                window.location.href = 'dashboard.html';
            } catch (error) {
                showNotification(error.message || 'Login failed');
            }
        });
    }
    
    // Signup form submission
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('name').value;
            const email = document.getElementById('signupEmail').value;
            const password = document.getElementById('signupPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            if (password !== confirmPassword) {
                showNotification('Passwords do not match!');
                return;
            }
            
            try {
                const response = await apiRequest('/auth/register', 'POST', { 
                    name, 
                    email, 
                    password 
                });
                
                showNotification('Registration successful! Please login.');
                
                // Switch to login form
                signupForm.style.display = 'none';
                if (loginForm) loginForm.style.display = 'block';
            } catch (error) {
                showNotification(error.message || 'Registration failed');
            }
        });
    }
}

// Initialize dashboard
async function initializeDashboard() {
    if (!currentUser) return;
    
    try {
        // Load dashboard data
        await loadDashboardData();
        
        // Setup event listeners
        setupDashboardListeners();
        
        // Load packages
        await loadPackages();
        
        // Load orders
        await loadRecentOrders();
        
        // Start real-time updates
        startRealTimeUpdates();
        
    } catch (error) {
        console.error('Dashboard initialization error:', error);
    }
}

// Load dashboard data
async function loadDashboardData() {
    try {
        const response = await apiRequest('/dashboard/stats');
        
        if (response.success) {
            // Update user info
            const userInfo = document.querySelector('.user-info span');
            if (userInfo) {
                userInfo.textContent = `Welcome, ${response.user.name}`;
            }
            
            // Update balance
            const balanceElements = document.querySelectorAll('#userBalance');
            balanceElements.forEach(el => {
                el.textContent = response.user.balance || 0;
            });
            
            // Update stats
            if (response.stats) {
                document.getElementById('totalSubs').textContent = 
                    response.stats.totalSubscribers?.toLocaleString() || '0';
                document.getElementById('totalSpent').textContent = 
                    `₹${response.stats.totalSpent?.toLocaleString() || '0'}`;
                document.getElementById('activeOrders').textContent = 
                    response.stats.activeOrders || '0';
                document.getElementById('completedOrders').textContent = 
                    response.stats.completedOrders || '0';
            }
        }
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
    }
}

// Setup dashboard event listeners
function setupDashboardListeners() {
    // Verify channel button
    const verifyBtn = document.getElementById('verifyChannel');
    if (verifyBtn) {
        verifyBtn.addEventListener('click', verifyYouTubeChannel);
    }
    
    // Channel input enter key
    const channelInput = document.getElementById('youtubeLink');
    if (channelInput) {
        channelInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                verifyYouTubeChannel();
            }
        });
    }
    
    // Confirm order button
    const confirmOrderBtn = document.getElementById('confirmOrder');
    if (confirmOrderBtn) {
        confirmOrderBtn.addEventListener('click', createOrder);
    }
}

// Load packages
async function loadPackages() {
    const packageGrid = document.getElementById('packageGrid');
    if (!packageGrid) return;
    
    const packages = [
        { subscribers: 50, price: 1, label: 'Starter', desc: 'Instant Delivery' },
        { subscribers: 250, price: 5, label: 'Basic', desc: 'Quick Boost' },
        { subscribers: 500, price: 10, label: 'Popular', desc: 'Best Value' },
        { subscribers: 1000, price: 20, label: 'Pro', desc: 'Fast Growth' },
        { subscribers: 2500, price: 50, label: 'Premium', desc: 'Massive Boost' },
        { subscribers: 5000, price: 100, label: 'Ultimate', desc: 'Maximum Growth' }
    ];
    
    packageGrid.innerHTML = packages.map(pkg => `
        <div class="package-card" data-subs="${pkg.subscribers}" data-price="${pkg.price}">
            <h4>${pkg.subscribers.toLocaleString()} Subscribers</h4>
            <div class="price">₹${pkg.price}</div>
            <p>${pkg.desc}</p>
            <p class="rate">₹1 = 50 subscribers</p>
            <button class="select-btn">Select</button>
        </div>
    `).join('');
    
    // Add event listeners to package cards
    document.querySelectorAll('.package-card').forEach(card => {
        card.addEventListener('click', function() {
            document.querySelectorAll('.package-card').forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            
            const subs = this.dataset.subs;
            const price = this.dataset.price;
            updateOrderSummary(subs, price);
        });
    });
}

// Verify YouTube channel
async function verifyYouTubeChannel() {
    const channelInput = document.getElementById('youtubeLink');
    const channelUrl = channelInput.value.trim();
    
    if (!channelUrl) {
        showNotification('Please enter a YouTube channel URL');
        return;
    }
    
    try {
        const response = await apiRequest('/orders/verify-channel', 'POST', { channelUrl });
        
        if (response.success) {
            const channelInfo = document.getElementById('channelInfo');
            channelInfo.style.display = 'flex';
            
            // Update channel info
            document.getElementById('channelName').textContent = response.channel.title;
            document.getElementById('channelSubs').textContent = 
                `Subscribers: ${response.channel.subscriberCount?.toLocaleString() || '0'}`;
            
            // Update order summary
            document.getElementById('summaryChannel').textContent = channelUrl;
            
            // Enable order button if package selected
            checkOrderButton();
            
            showNotification('Channel verified successfully!');
        }
    } catch (error) {
        showNotification(error.message || 'Failed to verify channel');
    }
}

// Update order summary
function updateOrderSummary(subs, price) {
    document.getElementById('summarySubs').textContent = subs;
    document.getElementById('summaryPrice').textContent = `₹${price}`;
    document.getElementById('summaryTotal').textContent = `₹${price}`;
    
    checkOrderButton();
}

// Check if order button should be enabled
function checkOrderButton() {
    const confirmBtn = document.getElementById('confirmOrder');
    const channel = document.getElementById('summaryChannel').textContent;
    const subs = document.getElementById('summarySubs').textContent;
    
    if (confirmBtn && channel !== 'Not Selected' && subs !== '0') {
        confirmBtn.disabled = false;
    }
}

// Create order
async function createOrder() {
    const channelUrl = document.getElementById('youtubeLink').value;
    const selectedPackage = document.querySelector('.package-card.selected');
    
    if (!channelUrl || !selectedPackage) {
        showNotification('Please select a channel and package');
        return;
    }
    
    const subscribers = selectedPackage.dataset.subs;
    const price = selectedPackage.dataset.price;
    
    try {
        const response = await apiRequest('/orders/create', 'POST', {
            channelUrl,
            subscribers: parseInt(subscribers)
        });
        
        if (response.success) {
            showNotification('Order created successfully!');
            
            // Update balance
            const balanceElements = document.querySelectorAll('#userBalance');
            balanceElements.forEach(el => {
                el.textContent = response.user.balance;
            });
            
            // Reset form
            document.getElementById('youtubeLink').value = '';
            document.getElementById('channelInfo').style.display = 'none';
            document.querySelectorAll('.package-card').forEach(c => c.classList.remove('selected'));
            document.getElementById('summaryChannel').textContent = 'Not Selected';
            document.getElementById('summarySubs').textContent = '0';
            document.getElementById('summaryTotal').textContent = '₹0';
            document.getElementById('confirmOrder').disabled = true;
            
            // Start order progress
            startOrderProgress(response.order.id, subscribers);
            
            // Reload orders
            await loadRecentOrders();
        }
    } catch (error) {
        showNotification(error.message || 'Failed to create order');
    }
}

// Start order progress simulation
function startOrderProgress(orderId, targetSubs) {
    const progressFill = document.querySelector('.progress-fill');
    const currentSubs = document.getElementById('currentSubs');
    const targetSubsElement = document.getElementById('targetSubs');
    const estimatedTime = document.getElementById('estimatedTime');
    
    if (!progressFill) return;
    
    targetSubsElement.textContent = targetSubs;
    
    let current = 0;
    const totalTime = 30000; // 30 seconds for simulation
    const interval = 100;
    const increment = (targetSubs / (totalTime / interval));
    
    progressFill.style.width = '0%';
    
    const timer = setInterval(() => {
        current += increment;
        
        if (current >= targetSubs) {
            current = targetSubs;
            clearInterval(timer);
            showNotification(`Order ${orderId} completed! ${targetSubs} subscribers added.`);
        }
        
        const percentage = (current / targetSubs) * 100;
        progressFill.style.width = `${percentage}%`;
        currentSubs.textContent = Math.round(current);
        
        const remainingTime = Math.round((targetSubs - current) * 100 / 1000);
        estimatedTime.textContent = remainingTime > 0 ? remainingTime : 0;
    }, interval);
}

// Load recent orders
async function loadRecentOrders() {
    try {
        const response = await apiRequest('/orders?limit=5');
        
        if (response.success && response.orders.length > 0) {
            // You can create a orders list section in your dashboard
            // and populate it with response.orders
        }
    } catch (error) {
        console.error('Failed to load orders:', error);
    }
}

// Initialize deposit page
async function initializeDepositPage() {
    if (!currentUser) return;
    
    // Update balance
    const balanceElement = document.getElementById('depositBalance');
    if (balanceElement && currentUser.balance) {
        balanceElement.textContent = currentUser.balance;
    }
    
    // Setup deposit listeners
    setupDepositListeners();
    
    // Load payment methods
    await loadPaymentMethods();
}

// Setup deposit event listeners
function setupDepositListeners() {
    // Payment method selection
    document.querySelectorAll('.method-card').forEach(card => {
        card.addEventListener('click', function() {
            document.querySelectorAll('.method-card').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            
            const method = this.dataset.method;
            updatePaymentMethod(method);
        });
    });
    
    // Amount selection
    document.querySelectorAll('.amount-option').forEach(option => {
        option.addEventListener('click', function() {
            document.querySelectorAll('.amount-option').forEach(o => o.classList.remove('active'));
            this.classList.add('active');
            
            const amount = this.dataset.amount;
            updateDepositAmount(amount);
        });
    });
    
    // Custom amount input
    const customAmount = document.getElementById('customAmount');
    if (customAmount) {
        customAmount.addEventListener('input', function() {
            document.querySelectorAll('.amount-option').forEach(o => o.classList.remove('active'));
            updateDepositAmount(this.value || '100');
        });
    }
    
    // Proceed to payment
    const proceedBtn = document.getElementById('proceedPayment');
    if (proceedBtn) {
        proceedBtn.addEventListener('click', processPayment);
    }
}

// Load payment methods
async function loadPaymentMethods() {
    try {
        const response = await apiRequest('/payments/methods');
        
        if (response.success) {
            const methodGrid = document.getElementById('paymentMethods');
            if (methodGrid) {
                methodGrid.innerHTML = response.methods.map(method => `
                    <div class="method-card" data-method="${method.id}">
                        <i class="fas ${method.icon}"></i>
                        <span>${method.name}</span>
                    </div>
                `).join('');
                
                // Reattach event listeners
                document.querySelectorAll('.method-card').forEach(card => {
                    card.addEventListener('click', function() {
                        document.querySelectorAll('.method-card').forEach(c => c.classList.remove('active'));
                        this.classList.add('active');
                        updatePaymentMethod(this.dataset.method);
                    });
                });
            }
        }
    } catch (error) {
        console.error('Failed to load payment methods:', error);
    }
}

// Update payment method
function updatePaymentMethod(method) {
    document.getElementById('selectedMethod').textContent = method.toUpperCase();
    
    // Show/hide payment details
    const allMethods = document.querySelectorAll('.method-details');
    allMethods.forEach(m => m.style.display = 'none');
    
    if (method === 'upi') {
        const upiDetails = document.getElementById('upiDetails');
        if (upiDetails) upiDetails.style.display = 'block';
    } else if (method === 'card') {
        const cardDetails = document.getElementById('cardDetails');
        if (cardDetails) cardDetails.style.display = 'block';
    }
}

// Update deposit amount
function updateDepositAmount(amount) {
    const amountNum = parseInt(amount) || 100;
    const subscribers = amountNum * 50;
    
    document.getElementById('selectedAmount').textContent = `₹${amountNum}`;
    document.getElementById('totalAmount').textContent = `₹${amountNum}`;
    document.getElementById('payAmount').textContent = amountNum;
    document.getElementById('subscribersCount').textContent = subscribers.toLocaleString();
}

// Process payment
async function processPayment() {
    const selectedMethod = document.querySelector('.method-card.active');
    const selectedAmount = document.querySelector('.amount-option.active') || 
                          document.getElementById('customAmount');
    
    if (!selectedMethod || !selectedAmount) {
        showNotification('Please select payment method and amount');
        return;
    }
    
    const method = selectedMethod.dataset.method;
    const amount = selectedAmount.value || selectedAmount.dataset.amount;
    
    try {
        if (method === 'upi') {
            // Create UPI payment
            const response = await apiRequest('/payments/upi', 'POST', {
                amount: parseInt(amount),
                upiId: document.getElementById('upiId')?.value || 'customer@upi'
            });
            
            if (response.success) {
                showPaymentStatus('UPI payment initiated. Please complete the payment.');
                
                // Show UPI details
                const upiDetails = document.getElementById('upiDetails');
                if (upiDetails) {
                    upiDetails.innerHTML = `
                        <h4>Pay via UPI</h4>
                        <div class="upi-qr">
                            <img src="${response.qrCodeUrl}" alt="UPI QR Code">
                        </div>
                        <div class="upi-id">
                            <strong>UPI ID:</strong> ${response.upiDetails.upiId}
                            <button class="copy-btn" data-text="${response.upiDetails.upiId}">
                                <i class="fas fa-copy"></i> Copy
                            </button>
                        </div>
                        <p>Amount: ₹${response.upiDetails.amount}</p>
                        <p>Transaction ID: ${response.upiDetails.transactionId}</p>
                    `;
                }
                
                // Start payment status polling
                pollPaymentStatus(response.transactionId);
            }
        } else {
            // Create Razorpay payment for other methods
            const response = await apiRequest('/payments/create-order', 'POST', {
                amount: parseInt(amount),
                currency: 'INR'
            });
            
            if (response.success) {
                // Initialize Razorpay
                const options = {
                    key: response.key,
                    amount: response.amount,
                    currency: response.currency,
                    name: 'YTSubBoost',
                    description: 'Deposit for YouTube Subscribers',
                    order_id: response.orderId,
                    handler: async function(paymentResponse) {
                        try {
                            const verifyResponse = await apiRequest('/payments/verify', 'POST', {
                                razorpay_order_id: paymentResponse.razorpay_order_id,
                                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                                razorpay_signature: paymentResponse.razorpay_signature,
                                transactionId: response.transactionId
                            });
                            
                            if (verifyResponse.success) {
                                showPaymentStatus('Payment successful!');
                                
                                // Update balance
                                if (verifyResponse.user) {
                                    localStorage.setItem('user', JSON.stringify(verifyResponse.user));
                                    document.getElementById('depositBalance').textContent = 
                                        verifyResponse.user.balance;
                                }
                                
                                // Reload page after 3 seconds
                                setTimeout(() => {
                                    window.location.reload();
                                }, 3000);
                            }
                        } catch (error) {
                            showPaymentStatus('Payment verification failed');
                        }
                    },
                    prefill: {
                        name: currentUser?.name || '',
                        email: currentUser?.email || '',
                        contact: ''
                    },
                    theme: {
                        color: '#667eea'
                    }
                };
                
                const rzp = new Razorpay(options);
                rzp.open();
            }
        }
    } catch (error) {
        showNotification(error.message || 'Payment failed');
    }
}

// Poll payment status
function pollPaymentStatus(transactionId) {
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes
    
    const poll = setInterval(async () => {
        try {
            const response = await apiRequest(`/payments/status/${transactionId}`);
            
            if (response.success) {
                if (response.transaction.status === 'completed') {
                    clearInterval(poll);
                    showPaymentStatus('Payment successful!');
                    
                    // Update balance
                    if (response.user) {
                        localStorage.setItem('user', JSON.stringify(response.user));
                        document.getElementById('depositBalance').textContent = 
                            response.user.balance;
                    }
                    
                    // Redirect to dashboard after 3 seconds
                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 3000);
                } else if (response.transaction.status === 'failed') {
                    clearInterval(poll);
                    showPaymentStatus('Payment failed');
                }
            }
            
            attempts++;
            if (attempts >= maxAttempts) {
                clearInterval(poll);
                showPaymentStatus('Payment timeout');
            }
        } catch (error) {
            console.error('Payment polling error:', error);
        }
    }, 10000); // Poll every 10 seconds
}

// Show payment status
function showPaymentStatus(message) {
    const statusMessage = document.getElementById('statusMessage');
    if (statusMessage) {
        statusMessage.textContent = message;
    }
}

// Start real-time updates
function startRealTimeUpdates() {
    // This would be connected via WebSocket
    // For now, simulate updates
    setInterval(() => {
        if (Math.random() > 0.7) { // 30% chance of update
            const totalSubs = document.getElementById('totalSubs');
            if (totalSubs) {
                const current = parseInt(totalSubs.textContent.replace(/,/g, '')) || 0;
                const increment = Math.floor(Math.random() * 10);
                totalSubs.textContent = (current + increment).toLocaleString();
            }
        }
    }, 10000); // Every 10 seconds
}

// Connect WebSocket
function connectWebSocket(userId) {
    if (socket) {
        socket.disconnect();
    }
    
    socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling']
    });
    
    socket.on('connect', () => {
        console.log('WebSocket connected');
        socket.emit('join-user', userId);
    });
    
    socket.on('order-progress', (data) => {
        console.log('Order progress:', data);
        // Update progress bar if this order is active
    });
    
    socket.on('order-completed', (data) => {
        console.log('Order completed:', data);
        showNotification(`Order ${data.orderId} completed! ${data.subscribers} subscribers added.`);
    });
    
    socket.on('payment-update', (data) => {
        console.log('Payment update:', data);
        // Update payment status
    });
    
    socket.on('balance-update', (data) => {
        console.log('Balance update:', data);
        // Update balance display
        const balanceElements = document.querySelectorAll('#userBalance, #depositBalance');
        balanceElements.forEach(el => {
            el.textContent = data.balance;
        });
    });
    
    socket.on('disconnect', () => {
        console.log('WebSocket disconnected');
    });
}

// API request helper
async function apiRequest(endpoint, method = 'GET', data = null) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const options = {
        method,
        headers,
    };
    
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(data);
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        const result = await response.json();
        
        if (!response.ok) {
            // Handle specific error cases
            if (response.status === 401) {
                // Token expired or invalid
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
            }
            throw new Error(result.message || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        return result;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 
                       type === 'error' ? 'fa-exclamation-circle' : 
                       'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Style notification
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#4CAF50' : 
                    type === 'error' ? '#f44336' : 
                    '#2196F3'};
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    // Add animation style if not exists
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    
    window.location.href = 'index.html';
}

// Export for debugging
window.ytSubBoost = {
    apiRequest,
    showNotification,
    logout,
    getCurrentUser: () => currentUser
};
