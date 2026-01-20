// Main JavaScript File

document.addEventListener('DOMContentLoaded', function() {
    initializeApplication();
});

function initializeApplication() {
    // Login/Signup Toggle
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
    
    // Show/Hide Password
    const showPasswordBtns = document.querySelectorAll('.show-password');
    showPasswordBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const passwordInput = this.parentElement.querySelector('input');
            const icon = this.querySelector('i');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });
    
    // Login Form Submission
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            // Simulate login
            if (email && password) {
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('userEmail', email);
                window.location.href = 'dashboard.html';
            } else {
                alert('Please fill in all fields');
            }
        });
    }
    
    // Signup Form Submission
    if (signupForm) {
        signupForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const name = document.getElementById('name').value;
            const email = document.getElementById('signupEmail').value;
            const password = document.getElementById('signupPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            if (password !== confirmPassword) {
                alert('Passwords do not match!');
                return;
            }
            
            // Simulate signup
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userEmail', email);
            localStorage.setItem('userName', name);
            window.location.href = 'dashboard.html';
        });
    }
    
    // YouTube Channel Verification
    const verifyChannelBtn = document.getElementById('verifyChannel');
    if (verifyChannelBtn) {
        verifyChannelBtn.addEventListener('click', verifyYouTubeChannel);
    }
    
    // Package Selection
    const packageCards = document.querySelectorAll('.package-card');
    packageCards.forEach(card => {
        card.addEventListener('click', function() {
            packageCards.forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            
            const subs = this.dataset.subs;
            const price = this.dataset.price;
            
            updateOrderSummary(subs, price);
        });
    });
    
    // Confirm Order Button
    const confirmOrderBtn = document.getElementById('confirmOrder');
    if (confirmOrderBtn) {
        confirmOrderBtn.addEventListener('click', processOrder);
    }
    
    // Deposit Page Functionality
    initializeDepositPage();
    
    // Real-time Updates Simulation
    simulateRealTimeUpdates();
}

function verifyYouTubeChannel() {
    const youtubeLink = document.getElementById('youtubeLink').value;
    const channelInfo = document.getElementById('channelInfo');
    
    if (!youtubeLink) {
        alert('Please enter a YouTube channel URL');
        return;
    }
    
    // Simulate verification
    channelInfo.style.display = 'flex';
    document.getElementById('channelName').textContent = 'Verified Channel';
    document.getElementById('channelSubs').textContent = 'Subscribers: 1,234';
    
    // Update order summary
    document.getElementById('summaryChannel').textContent = youtubeLink;
    
    enableOrderButton();
}

function updateOrderSummary(subs, price) {
    document.getElementById('summarySubs').textContent = subs;
    document.getElementById('summaryPrice').textContent = `₹${price}`;
    document.getElementById('summaryTotal').textContent = `₹${price}`;
    
    enableOrderButton();
}

function enableOrderButton() {
    const confirmOrderBtn = document.getElementById('confirmOrder');
    const channel = document.getElementById('summaryChannel').textContent;
    const subs = document.getElementById('summarySubs').textContent;
    
    if (channel !== 'Not Selected' && subs !== '0') {
        confirmOrderBtn.disabled = false;
    }
}

function processOrder() {
    const subs = document.getElementById('summarySubs').textContent;
    const price = document.getElementById('summaryTotal').textContent;
    
    // Check balance
    const balance = parseInt(document.getElementById('userBalance').textContent);
    const priceNum = parseInt(price.replace('₹', ''));
    
    if (balance < priceNum) {
        alert('Insufficient balance! Please deposit funds.');
        window.location.href = 'deposit.html';
        return;
    }
    
    // Deduct balance
    const newBalance = balance - priceNum;
    document.getElementById('userBalance').textContent = newBalance;
    
    // Start real-time updates
    startSubscriberProgress(parseInt(subs));
    
    // Show success message
    showNotification('Order placed successfully! Subscribers are being added.');
}

function startSubscriberProgress(targetSubs) {
    const progressFill = document.querySelector('.progress-fill');
    const currentSubs = document.getElementById('currentSubs');
    const targetSubsElement = document.getElementById('targetSubs');
    const estimatedTime = document.getElementById('estimatedTime');
    
    targetSubsElement.textContent = targetSubs;
    
    let current = 0;
    const totalTime = targetSubs * 100; // 100ms per subscriber
    const interval = 100;
    const increment = (interval / totalTime) * targetSubs;
    
    const timer = setInterval(() => {
        current += increment;
        
        if (current >= targetSubs) {
            current = targetSubs;
            clearInterval(timer);
            showNotification('Subscribers added successfully!');
        }
        
        const percentage = (current / targetSubs) * 100;
        progressFill.style.width = `${percentage}%`;
        currentSubs.textContent = Math.round(current);
        
        const remaining = Math.round((targetSubs - current) * 100 / 1000);
        estimatedTime.textContent = remaining > 0 ? remaining : 0;
    }, interval);
}

function initializeDepositPage() {
    // Payment Method Selection
    const methodCards = document.querySelectorAll('.method-card');
    methodCards.forEach(card => {
        card.addEventListener('click', function() {
            methodCards.forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            
            const method = this.dataset.method;
            updatePaymentMethod(method);
        });
    });
    
    // Amount Selection
    const amountOptions = document.querySelectorAll('.amount-option');
    amountOptions.forEach(option => {
        option.addEventListener('click', function() {
            amountOptions.forEach(o => o.classList.remove('active'));
            this.classList.add('active');
            
            const amount = this.dataset.amount;
            updateDepositAmount(amount);
        });
    });
    
    // Custom Amount Input
    const customAmountInput = document.getElementById('customAmount');
    if (customAmountInput) {
        customAmountInput.addEventListener('input', function() {
            amountOptions.forEach(o => o.classList.remove('active'));
            updateDepositAmount(this.value || '100');
        });
    }
    
    // Copy UPI ID
    const copyBtns = document.querySelectorAll('.copy-btn');
    copyBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const upiId = this.dataset.text;
            navigator.clipboard.writeText(upiId).then(() => {
                showNotification('UPI ID copied to clipboard!');
            });
        });
    });
    
    // Proceed to Payment
    const proceedPaymentBtn = document.getElementById('proceedPayment');
    if (proceedPaymentBtn) {
        proceedPaymentBtn.addEventListener('click', processPayment);
    }
}

function updatePaymentMethod(method) {
    document.getElementById('selectedMethod').textContent = method.toUpperCase();
    
    // Show corresponding payment details
    const allMethods = document.querySelectorAll('.method-details');
    allMethods.forEach(m => m.style.display = 'none');
    
    if (method === 'upi') {
        document.getElementById('upiDetails').style.display = 'block';
    } else if (method === 'card') {
        document.getElementById('cardDetails').style.display = 'block';
    }
}

function updateDepositAmount(amount) {
    const amountNum = parseInt(amount) || 100;
    const subscribers = amountNum * 50; // 50 subscribers per ₹1
    
    document.getElementById('selectedAmount').textContent = `₹${amountNum}`;
    document.getElementById('totalAmount').textContent = `₹${amountNum}`;
    document.getElementById('payAmount').textContent = amountNum;
    document.getElementById('subscribersCount').textContent = 
        subscribers.toLocaleString();
    
    // Update UPI QR code with new amount
    const upiQr = document.querySelector('.upi-qr img');
    if (upiQr) {
        upiQr.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=upi://pay?pa=ytsubboost@upi&pn=YTSubBoost&am=${amountNum}&cu=INR`;
    }
}

function processPayment() {
    const amount = document.getElementById('payAmount').textContent;
    const method = document.getElementById('selectedMethod').textContent;
    
    // Simulate payment processing
    const statusSteps = document.querySelectorAll('.status-step');
    const statusMessage = document.getElementById('statusMessage');
    
    statusMessage.textContent = 'Processing payment...';
    
    // Step 1 to 2
    setTimeout(() => {
        statusSteps[1].classList.add('active');
        statusMessage.textContent = 'Payment authorized. Processing...';
    }, 2000);
    
    // Step 2 to 3
    setTimeout(() => {
        statusSteps[2].classList.add('active');
        statusMessage.textContent = 'Payment successful! Adding funds to your account...';
        
        // Update balance
        const currentBalance = parseInt(document.getElementById('depositBalance').textContent);
        const newBalance = currentBalance + parseInt(amount);
        document.getElementById('depositBalance').textContent = newBalance;
        
        // Also update in dashboard
        const dashboardBalance = document.getElementById('userBalance');
        if (dashboardBalance) {
            dashboardBalance.textContent = newBalance;
        }
        
        // Store in localStorage
        localStorage.setItem('userBalance', newBalance);
        
        // Show success message
        setTimeout(() => {
            showNotification(`₹${amount} added to your account successfully!`);
            window.location.href = 'dashboard.html';
        }, 1000);
    }, 4000);
}

function simulateRealTimeUpdates() {
    // Simulate live subscriber count updates
    setInterval(() => {
        const totalSubs = document.getElementById('totalSubs');
        if (totalSubs) {
            const current = parseInt(totalSubs.textContent.replace(/,/g, ''));
            const increment = Math.floor(Math.random() * 10);
            totalSubs.textContent = (current + increment).toLocaleString();
        }
    }, 5000);
}

function showNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${message}</span>
    `;
    
    // Style notification
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    
    // Add animation
    const style = document.createElement('style');
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
    
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Check if user is logged in
function checkLogin() {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const currentPage = window.location.pathname;
    
    if (!isLoggedIn && currentPage.includes('dashboard.html')) {
        window.location.href = 'login.html';
    }
    
    if (isLoggedIn && currentPage.includes('login.html')) {
        window.location.href = 'dashboard.html';
    }
}

// Initialize on page load
window.onload = function() {
    checkLogin();
    
    // Set user info if logged in
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (isLoggedIn) {
        const userName = localStorage.getItem('userName') || 'User';
        const userBalance = localStorage.getItem('userBalance') || '100';
        
        // Update all balance elements
        document.querySelectorAll('#userBalance, #depositBalance').forEach(el => {
            if (el) el.textContent = userBalance;
        });
        
        // Update user name if element exists
        const userNameElement = document.querySelector('.user-info span');
        if (userNameElement) {
            userNameElement.textContent = `Welcome, ${userName}`;
        }
    }
};