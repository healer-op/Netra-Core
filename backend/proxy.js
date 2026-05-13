const dgram = require('dgram');
const dnsPacket = require('dns-packet');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const DOH_IP_MAP = {
    'cloudflare-dns.com': '1.1.1.1',
    'dns.google': '8.8.8.8',
    'dns.quad9.net': '9.9.9.9',
    'dns.adguard-dns.com': '94.140.14.14',
    'doh.opendns.com': '208.67.222.222',
    'doh.cleanbrowsing.org': '185.228.168.9',
    'doh.applied-privacy.net': '146.255.56.98',
    'doh.dns.sb': '185.222.222.222',
    'public.dns.iij.jp': '202.232.2.2',
    'dns.twnic.tw': '101.101.101.101',
    'rdns.faelix.net': '46.227.200.9',
    'dns.aa.net.uk': '217.169.20.22',
    'doh.42l.fr': '45.155.171.163',
    'dns.digitale-gesellschaft.ch': '185.95.218.42',
    'fi.doh.dns.snopyta.org': '95.216.24.230',
    'doh.dnslify.com': '185.235.81.1',
    'private.canadianshield.cira.ca': '149.112.121.10'
};

class NetraProxy {
    constructor(options = {}) {
        this.port = options.port || 53;
        this.address = options.address || '127.0.0.1';
        this.dohUrl = options.dohUrl || 'https://cloudflare-dns.com/dns-query';
        this.server = null;
        this.stats = {
            queries: 0,
            errors: 0
        };
        this.onStatsUpdate = options.onStatsUpdate || (() => {});
        this.onLog = options.onLog || (() => {});
    }

    setDohUrl(url) {
        this.dohUrl = url;
    }

    async start() {
        return new Promise((resolve, reject) => {
            this.server = dgram.createSocket('udp4');

            this.server.on('message', async (msg, rinfo) => {
                this.stats.queries++;
                
                try {
                    const packet = dnsPacket.decode(msg);
                    const domain = packet.questions[0]?.name;
                    
                    const response = await this.resolveDoH(msg);
                    
                    // Decode response to extract resolved IPs
                    try {
                        const respPacket = dnsPacket.decode(response);
                        const ips = respPacket.answers
                            .filter(a => a.type === 'A' || a.type === 'AAAA')
                            .map(a => a.data)
                            .join(', ');
                        
                        this.onLog(`${domain} → [${ips || 'No IP'}]`);
                    } catch (e) {
                        this.onLog(`Resolving: ${domain}`);
                    }
                    
                    this.onStatsUpdate(this.stats);
                    this.server.send(response, rinfo.port, rinfo.address);
                } catch (err) {
                    this.onLog(`Error resolving: ${err.message}`);
                    this.stats.errors++;
                    this.onStatsUpdate(this.stats);
                }
            });

            this.server.on('error', (err) => {
                this.onLog(`UDP Server Error: ${err.message}`);
                reject(err);
            });

            this.server.bind(this.port, this.address, () => {
                this.onLog(`Netra Engine Active on ${this.address}:${this.port}`);
                resolve();
            });
        });
    }

    async stop() {
        if (this.server) {
            return new Promise((resolve) => {
                this.server.close(() => {
                    this.server = null;
                    this.onLog('Netra Engine Stopped');
                    resolve();
                });
            });
        }
    }

    async resolveDoH(dnsQuery) {
        let finalUrl = this.dohUrl;
        try {
            const urlObj = new URL(this.dohUrl);
            const hostname = urlObj.hostname;
            if (DOH_IP_MAP[hostname]) {
                finalUrl = this.dohUrl.replace(hostname, DOH_IP_MAP[hostname]);
            }
        } catch (e) {}

        const response = await fetch(finalUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/dns-message',
                'Accept': 'application/dns-message',
                'Host': new URL(this.dohUrl).hostname 
            },
            body: dnsQuery
        });

        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        return Buffer.from(buffer);
    }
}

module.exports = NetraProxy;
