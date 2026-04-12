import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { getIpInfo } from './services/ipsInfo.js'; 
import { getSSLInfo } from './services/sslInfo.js';  
import { getServerLocation } from './services/serverLocation.js';
import { getDNSInfo } from './services/dnsInfo.js';
import { getHeadersInfo } from './services/headersInfo.js';
import { getPortsInfo } from './services/portsInfo.js';
import { getSubdomainInfo } from './services/subdomainInfo.js';
import { runRecon } from './services/reconPipeline.js';
import { getScanHistory, saveScan, saveSystems, saveFirewall, saveOsintResult } from './database/storage.js';
import { getFirewallInfo } from './services/firewallInfo.js';
import { normalizeTarget } from './services/utils.js';
import { prioritizeTargets } from './services/smartFilter.js';
import { runOsintModule } from './services/osint/index.js';

// Hardening
import { scanLimiter, apiLimiter } from './middleware/rateLimiter.js';
import { validateScanRequest } from './middleware/validator.js';
import { logger } from './services/logger.js';

dotenv.config();

// 🔥 FIX BigInt JSON issue globally
BigInt.prototype.toJSON = function () {
  return Number(this);
};

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json()); 

// Apply global rate limiter to all API routes
app.use('/api', apiLimiter);

app.get('/api/ip-info', async (req, res) => {
  try {
    let { target } = req.query;

    if (!target) {
      return res.status(400).json({ error: 'No target provided' });
    }

    target = normalizeTarget(target);

    const data = await getIpInfo(target);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/ssl-info', async (req, res) => {
    try {
        let { target } = req.query;

        if (!target) {
          return res.status(400).json({ error: 'No hostname provided' });
        }
        
        target = normalizeTarget(target);

        const data = await getSSLInfo(target);
        res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
});

app.get('/api/server-location', async (req, res) => {
    try {
        let { target } = req.query;

        if (!target) {
          return res.status(400).json({ error: 'No hostname provided' });
        }
        
        target = normalizeTarget(target);

        const data = await getServerLocation(target);
        res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
});

app.get('/api/dns-info', async (req, res) => {
    try {
        let { target } = req.query;

        if (!target) {
          return res.status(400).json({ error: 'No domain provided' });
        }
        
        target = normalizeTarget(target);

        const data = await getDNSInfo(target);
        res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

app.get('/api/header-info', async (req, res) => {
    try {
        let { target } = req.query;

        if (!target) {
          return res.status(400).json({ error: 'No target provided' });
        }

        target = normalizeTarget(target);

        const data = await getHeadersInfo(target);
        res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
});

app.get('/api/port-info', async (req, res) => {
    try {
        let { target } = req.query;
        if (!target) {
          return res.status(400).json({ error: 'No target provided' });
        }
        
        target = normalizeTarget(target);
        
        const data = await getPortsInfo(target);
        res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
});

app.get('/api/subdomains', async (req, res) => {
    try {
        let { target } = req.query;
        if (!target) {
          return res.status(400).json({ error: 'No target provided' });
        }

        target = normalizeTarget(target);

        const data = await getSubdomainInfo(target);
        res.json({
          domain: target,
          count: data.length,
          subdomains: data
    }) ;
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
}); 

// Protected Scan Endpoint
app.get('/api/recon', scanLimiter, validateScanRequest, async (req, res) => {
  try {
    let { target } = req.query; // validateScanRequest validates req.body, but this is GET... 
    // Wait, validateScanRequest uses req.body. But GET requests usually use query params.
    // I need to update validateScanRequest to check req.query if it's a GET request.
    // Or change this to POST. The current implementation uses GET.
    // Let's assume I should update validateScanRequest to check req.query or req.body depending on method.
    // For now, I will update validateScanRequest to check req.query because the route is app.get
    
    // Actually, let's fix validateScanRequest first or here.
    // The previous implementation of validateScanRequest checked req.body.
    // Since this is a GET request, I should check req.query.
    // I'll update validateScanRequest in a separate tool call or just modify it here if I was rewriting it.
    // But I'm writing server.js.
    
    // I'll proceed with writing server.js, but I need to fix validateScanRequest.
    // I will write server.js assuming validateScanRequest works correctly (I'll fix it next).
    
    // Also, GET /api/recon uses `req.query.target`.
    
    if (!target) {
       // Should be handled by validator but just in case
      return res.status(400).json({ error: 'No target provided' });
    }

    target = normalizeTarget(target);

    //1 Run Recon
    const recon = await runRecon(target);
    //2 Save Scan + Systems
    const scanId = await saveScan(target);
    // 3 Save Firewall Info
    await saveFirewall(scanId, recon.firewall);
    // 4 Save Systems
    await saveSystems(scanId, recon.systems);
    
    res.json({
      scan_id: scanId,
      target: target,
      ...recon
    });
  } catch (err) {
    logger.error(`Recon failed for target ${req.query.target}: ${err.message}`, { error: err });
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/scan-history', async (req, res) => {
  try {
    const history = await getScanHistory();
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/firewall-info', async (req, res) => {
  try {
    const { target } = req.query;
    if (!target) {
      return res.status(400).json({ error: 'No target provided' });
    }

    const data = await getFirewallInfo(target);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/osint/:module', async (req, res) => {
    try {
        const { module } = req.params;
        let { target, scanId } = req.query;

        if (!target) {
            return res.status(400).json({ error: 'No target provided' });
        }

        target = normalizeTarget(target);
        
        const data = await runOsintModule(module, target);

        if (scanId) {
            await saveOsintResult(scanId, module, data.risk, data.data);
        }

        res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
});

// Dashboard Threat Map Endpoint
app.get('/api/dashboard/threat-map', (req, res) => {
    try {
        // Generate mock threat data
        const threatTypes = ['DDoS', 'Phishing', 'Malware', 'SQL Injection', 'Brute Force'];
        const severities = ['low', 'medium', 'high', 'critical'];
        const count = 20; // Number of active threats
        
        const threats = Array.from({ length: count }).map((_, i) => {
            // Random coordinates (approximate world coverage)
            const startLat = (Math.random() * 160) - 80;
            const startLng = (Math.random() * 360) - 180;
            const endLat = (Math.random() * 160) - 80;
            const endLng = (Math.random() * 360) - 180;

            return {
                id: `threat-${Date.now()}-${i}`,
                type: threatTypes[Math.floor(Math.random() * threatTypes.length)],
                severity: severities[Math.floor(Math.random() * severities.length)],
                timestamp: new Date().toISOString(),
                source: {
                    lat: startLat,
                    lng: startLng,
                    country: "Unknown" // Could use a geo library if needed
                },
                destination: {
                    lat: endLat,
                    lng: endLng,
                    country: "Target"
                }
            };
        });

        res.json(threats);
    } catch (err) {
        res.status(500).json({ error: "Failed to generate threat map data" });
    }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
