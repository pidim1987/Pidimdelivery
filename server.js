const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PATCH"]
    }
});

const port = process.env.PORT || 3000;

app.use(express.json());

// ตั้งค่าให้เซิร์ฟเวอร์อ่านไฟล์ Static (เช่น CSS, รูปภาพ, หรือไฟล์ HTML ในโฟลเดอร์เดียวกัน)
app.use(express.static(__dirname));

// ==========================================
// 1. Mock Databases & Global States
// ==========================================
let orders = [];
let orderIdCounter = 1;

let wallets = {
    'rider_01': { balance: 500.00, history: [] },
    'merchant_01': { balance: 1000.00, history: [] }
};

let systemStatuses = {
    Customer: 'green',
    Merchant: 'green',
    Rider: 'green'
};

// ==========================================
// 2. Real-time Communication (Socket.io)
// ==========================================
io.on('connection', (socket) => {
    console.log(`[Socket] ผู้ใช้งานเชื่อมต่อแล้ว: ${socket.id}`);

    socket.emit('broadcast-system-status', systemStatuses);

    socket.on('send-public-message', (data) => {
        io.emit('receive-public-message', data);
    });

    socket.on('update-system-status', (newStatuses) => {
        systemStatuses = newStatuses;
        io.emit('broadcast-system-status', systemStatuses);
    });

    socket.on('new-order', (order) => {
        order.id = orderIdCounter++;
        orders.unshift(order);
        io.emit('broadcast-new-order', order);
    });

    socket.on('disconnect', () => {
        console.log(`[Socket] ผู้ใช้งานตัดการเชื่อมต่อ: ${socket.id}`);
    });
});

// ==========================================
// 3. API Routes: Orders & Wallet
// ==========================================
app.post('/api/orders', (req, res) => {
    const { 
        orderType = 'delivery', 
        customerName, 
        phone, 
        address, 
        pickupLocation, 
        dropoffLocation, 
        items, 
        totalAmount, 
        vehicleType 
    } = req.body;

    const newOrder = {
        id: orderIdCounter++,
        orderType,
        customerName,
        phone,
        address,
        pickupLocation: orderType === 'taxi' ? pickupLocation : 'ร้านกะเพราถาดยอดฮิต',
        dropoffLocation: orderType === 'taxi' ? dropoffLocation : address,
        items: items || [],
        totalAmount: totalAmount || 0,
        vehicleType: vehicleType || 'รถจักรยานยนต์',
        status: 'pending',
        createdAt: new Date()
    };

    orders.push(newOrder);
    io.emit('broadcast-new-order', newOrder);
    res.json({ success: true, order: newOrder });
});

app.get('/api/orders', (req, res) => {
    res.json(orders);
});

// เพิ่ม Endpoint สำหรับอัปเดตสถานะออเดอร์ (รองรับการกดรับงาน และปิดงานของไรเดอร์)
app.patch('/api/orders/:id', (req, res) => {
    const orderId = parseInt(req.params.id);
    const order = orders.find(o => o.id === orderId);

    if (!order) {
        return res.status(404).json({ success: false, message: 'ไม่พบออเดอร์นี้ในระบบ' });
    }

    // อัปเดตข้อมูลสถานะหรือข้อมูลไรเดอร์ที่ส่งเข้ามา
    Object.assign(order, req.body);

    // ส่งสัญญาณเตือนไปยังทุก client ผ่าน Socket.io ว่าออเดอร์มีการเปลี่ยนแปลง
    io.emit('broadcast-order-updated', order);

    res.json({ success: true, order });
});

// ==========================================
// 4. Frontend HTML Routes (รองรับไฟล์แยก)
// ==========================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'customer.html'));
});

app.get('/customer.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'customer.html'));
});

app.get('/merchant.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'merchant.html'));
});

app.get('/rider.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'rider.html'));
});

server.listen(port, () => {
    console.log(`เซิร์ฟเวอร์เปิดทำงานแล้วที่: http://localhost:${port}`);
});
