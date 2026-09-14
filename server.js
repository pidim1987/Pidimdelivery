const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ฐานข้อมูลจำลองสำหรับเก็บออเดอร์ในระบบ
let orders = [];
let systemStatuses = {
    Customer: 'green',
    Merchant: 'green',
    Rider: 'green'
};

// REST API: ดึงรายการออเดอร์ทั้งหมด
app.get('/api/orders', (req, res) => {
    res.json(orders);
});

// REST API: สร้างออเดอร์ใหม่
app.post('/api/orders', (req, res) => {
    const newOrder = {
        id: Date.now(),
        ...req.body,
        status: req.body.status || 'pending',
        createdAt: new Date().toISOString()
    };
    orders.push(newOrder);
    
    // Broadcast แจ้งเตือนไปยังทุกฝั่งแบบเรียลไทม์
    io.emit('new-order', newOrder);
    io.emit('broadcast-new-order', newOrder);
    
    res.status(201).json(newOrder);
});

// REST API: อัปเดตสถานะออเดอร์ (รับงาน, ทำอาหารเสร็จ, กำลังส่ง, ปิดงาน)
app.patch('/api/orders/:id', (req, res) => {
    const orderId = parseInt(req.params.id);
    const order = orders.find(o => o.id === orderId);

    if (!order) {
        return res.status(404).json({ error: 'ไม่พบออเดอร์นี้ในระบบ' });
    }

    Object.assign(order, req.body);
    
    // Broadcast การอัปเดตสถานะให้ทุกหน้าจอซิงค์กัน
    io.emit('broadcast-order-updated', order);
    
    res.json(order);
});

// Socket.io การเชื่อมต่อและการสื่อสารเรียลไทม์
io.on('connection', (socket) => {
    console.Hologram || console.log('🟢 ผู้ใช้งานเชื่อมต่อเข้ามาผ่าน Socket.io ID:', socket.id);

    // ส่งสถานะไฟปัจจุบันให้ผู้ใช้ใหม่ทันทีที่เชื่อมต่อ
    socket.emit('broadcast-system-status', systemStatuses);

    // รับอีเวนต์สร้างออเดอร์ใหม่ผ่าน Socket
    socket.on('new-order', (orderData) => {
        const newOrder = {
            id: Date.now(),
            ...orderData,
            status: orderData.status || 'pending',
            createdAt: new Date().toISOString()
        };
        orders.push(newOrder);
        io.emit('broadcast-new-order', newOrder);
    });

    // รับข้อความแชทสาธารณะ 3 ฝั่ง
    socket.on('send-public-message', (data) => {
        io.emit('receive-public-message', data);
    });

    // อัปเดตสถานะไฟความปลอดภัย 3 สี (SOS)
    socket.on('update-system-status', (newStatuses) => {
        systemStatuses = newStatuses;
        io.emit('broadcast-system-status', systemStatuses);
    });

    socket.on('disconnect', () => {
        console.log('🔴 ผู้ใช้งานตัดการเชื่อมต่อ:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 เซิร์ฟเวอร์ปิยสัตตาบริการรันแล้วที่พอร์ต ${PORT}`);
});
