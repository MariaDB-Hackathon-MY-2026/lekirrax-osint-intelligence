import type { ScanSection } from '../types';

export const mockScanResults: ScanSection[] = [
    {
        id: 'host-infrastructure',
        title: 'Host & Infrastructure',
        cards: [
            {
                id: 'server-location',
                title: 'Server Location',
                type: 'kv-list',
                delay: 0.1,
                data: [
                    { label: 'IP Address', value: '142.250.190.46' },
                    { label: 'City', value: 'Mountain View' },
                    { label: 'Country', value: 'United States 🇺🇸' },
                    { label: 'ISP', value: 'Google LLC' },
                ],
                customContentId: 'map-visualization'
            },
            {
                id: 'firewall-waf',
                title: 'Firewall / WAF',
                type: 'kv-list',
                delay: 0.2,
                data: [
                    { label: 'Detected', value: 'Yes', color: 'var(--accent-success)' },
                    { label: 'Type', value: 'Google Front End' },
                    { label: 'WAF', value: 'Likely (Heuristic Analysis)' },
                ]
            },
            {
                id: 'open-ports',
                title: 'Open Ports',
                type: 'tags',
                delay: 0.3,
                data: [
                    { label: '80 (HTTP)' },
                    { label: '443 (HTTPS)' },
                    { label: '8080 (ALT-HTTP)' },
                    { label: '8443 (ALT-HTTPS)' },
                ]
            }
        ]
    },
    {
        id: 'domain-dns',
        title: 'Domain & DNS',
        cards: [
            {
                id: 'domain-whois',
                title: 'Domain WHOIS',
                type: 'kv-list',
                delay: 0.1,
                data: [
                    { label: 'Registrar', value: 'MarkMonitor Inc.' },
                    { label: 'Created', value: '1997-09-15' },
                    { label: 'Expires', value: '2028-09-14' },
                    { label: 'Status', value: 'clientDeleteProhibited' },
                ]
            },
            {
                id: 'dns-records',
                title: 'DNS Records',
                type: 'kv-list',
                delay: 0.2,
                data: [
                    { label: 'A', value: '142.250.190.46' },
                    { label: 'AAAA', value: '2607:f8b0:4009:804::200e' },
                    { label: 'MX', value: 'smtp.google.com (10)' },
                    { label: 'TXT', value: 'v=spf1 include:_spf.google.com ~all' },
                ]
            },
            {
                id: 'sub-domain',
                title: 'Sub-Domain',
                type: 'tags',
                delay: 0.3,
                data: [
                    { label: 'mail.google.com' },
                    { label: 'docs.google.com' },
                    { label: 'drive.google.com' },
                    { label: 'maps.google.com' },
                    { label: 'play.google.com' },
                    { label: 'cloud.google.com' },
                ]
            }
        ]
    },
    {
        id: 'ssl-security',
        title: 'SSL & Security',
        cards: [
            {
                id: 'ssl-certificate',
                title: 'SSL Certificate',
                type: 'kv-list',
                delay: 0.1,
                data: [
                    { label: 'Issuer', value: 'GTS CA 1C3' },
                    { label: 'Valid From', value: '2023-10-23' },
                    { label: 'Valid To', value: '2024-01-15' },
                    { label: 'Protocol', value: 'TLS 1.3' },
                ]
            },
            {
                id: 'http-security-headers',
                title: 'HTTP Security Headers',
                type: 'kv-list',
                delay: 0.2,
                data: [
                    { label: 'HSTS', value: 'Present', color: 'var(--accent-success)' },
                    { label: 'X-Frame-Options', value: 'SAMEORIGIN', color: 'var(--accent-success)' },
                    { label: 'CSP', value: 'Weak', color: 'var(--accent-warning)' },
                ]
            },
            {
                id: 'security-txt',
                title: 'Security.txt',
                type: 'kv-list',
                delay: 0.3,
                data: [
                    { label: 'Status', value: 'Found', color: 'var(--accent-success)' },
                    { label: 'Contact', value: 'https://g.co/vulnz' },
                    { label: 'Expires', value: '2024-12-31' },
                ]
            }
        ]
    },
    {
        id: 'web-content',
        title: 'Web & Content',
        cards: [
            {
                id: 'headers',
                title: 'Headers',
                type: 'kv-list',
                delay: 0.1,
                data: [
                    { label: 'server', value: 'gws' },
                    { label: 'content-type', value: 'text/html; charset=UTF-8' },
                    { label: 'cache-control', value: 'private, max-age=0' },
                ]
            },
            {
                id: 'cookies',
                title: 'Cookies',
                type: 'kv-list',
                delay: 0.2,
                data: [
                    { label: 'NID', value: 'HttpOnly, Secure' },
                    { label: '1P_JAR', value: 'Secure, SameSite=None' },
                    { label: 'CONSENT', value: 'Pending' },
                ]
            },
            {
                id: 'pages',
                title: 'Pages',
                type: 'kv-list',
                delay: 0.3,
                data: [
                    { label: ' /about', value: '200 OK' },
                    { label: ' /products', value: '200 OK' },
                    { label: ' /admin', value: '403 Forbidden', color: 'var(--accent-danger)' },
                ]
            },
            {
                id: 'crawl-rules',
                title: 'Crawl Rules',
                type: 'kv-list',
                delay: 0.4,
                data: [
                    { label: 'robots.txt', value: 'Allowed', color: 'var(--accent-success)' },
                    { label: 'Sitemap', value: 'Found' },
                    { label: 'Disallow', value: ' /search' },
                ]
            },
            {
                id: 'social-tags',
                title: 'Social Tags',
                type: 'kv-list',
                delay: 0.5,
                data: [
                    { label: 'og:title', value: 'Google' },
                    { label: 'og:image', value: '/images/branding/googlelogo...' },
                    { label: 'twitter:card', value: 'summary' },
                ]
            }
        ]
    },
    {
        id: 'threat-intelligence',
        title: 'Threat Intelligence',
        cards: [
            {
                id: 'blocklists',
                title: 'Blocklists',
                type: 'kv-list',
                delay: 0.1,
                data: [
                    { label: 'Spamhaus', value: 'Clean', color: 'var(--accent-success)' },
                    { label: 'Sorbs', value: 'Clean', color: 'var(--accent-success)' },
                    { label: 'Barracuda', value: 'Clean', color: 'var(--accent-success)' },
                ]
            },
            {
                id: 'threat-intelligence',
                title: 'Threat Intelligence',
                type: 'kv-list',
                delay: 0.2,
                data: [
                    { label: 'Reputation', value: 'High', color: 'var(--accent-success)' },
                    { label: 'Malware', value: 'Not Detected', color: 'var(--accent-success)' },
                    { label: 'Phishing', value: 'Not Detected', color: 'var(--accent-success)' },
                ]
            }
        ]
    }
];