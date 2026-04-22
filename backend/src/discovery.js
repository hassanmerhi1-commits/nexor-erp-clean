// Kwanza ERP - Server Discovery Broadcaster
// Responds to discovery requests from clients on the local network

const dgram = require('dgram');
const os = require('os');

const DISCOVERY_PORT = 41234;
const DISCOVERY_MESSAGE = 'KWANZA_ERP_DISCOVER';
const DISCOVERY_RESPONSE = 'KWANZA_ERP_SERVER';

class DiscoveryBroadcaster {
  constructor(serverPort, options = {}) {
    this.serverPort = serverPort;
    this.serverName = options.name || 'Kwanza ERP Server';
    this.version = options.version || '1.0.0';
    this.branch = options.branch || null;
    this.socket = null;
    this.connectedClients = 0;
  }

  // Update connected client count (called by Socket.io)
  setConnectedClients(count) {
    this.connectedClients = count;
  }

  // Start listening for discovery requests
  start() {
    return new Promise((resolve, reject) => {
      try {
        this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

        this.socket.on('error', (err) => {
          console.error('[Discovery] Broadcaster error:', err.message);
          this.socket.close();
          // Try to restart after error
          setTimeout(() => this.start(), 5000);
        });

        this.socket.on('message', (msg, rinfo) => {
          const message = msg.toString();
          
          if (message === DISCOVERY_MESSAGE) {
            console.log(`[Discovery] Request from ${rinfo.address}:${rinfo.port}`);
            
            // Send response with server info
            const response = JSON.stringify({
              port: this.serverPort,
              name: this.serverName,
              version: this.version,
              branch: this.branch,
              connectedClients: this.connectedClients,
              hostname: os.hostname(),
              platform: os.platform()
            });
            
            const responseBuffer = Buffer.from(`${DISCOVERY_RESPONSE}:${response}`);
            
            this.socket.send(responseBuffer, 0, responseBuffer.length, rinfo.port, rinfo.address, (err) => {
              if (err) {
                console.error('[Discovery] Response error:', err.message);
              } else {
                console.log(`[Discovery] Response sent to ${rinfo.address}`);
              }
            });
          }
        });

        this.socket.bind(DISCOVERY_PORT, '0.0.0.0', () => {
          console.log(`[Discovery] Listening on port ${DISCOVERY_PORT}`);
          console.log('[Discovery] Server will respond to discovery requests');
          resolve();
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  // Stop broadcaster
  stop() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  // Get local IP addresses for display
  getLocalIPs() {
    const ips = [];
    const interfaces = os.networkInterfaces();
    
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.internal || iface.family !== 'IPv4') continue;
        ips.push({ name, address: iface.address });
      }
    }
    
    return ips;
  }
}

module.exports = { DiscoveryBroadcaster, DISCOVERY_PORT };
