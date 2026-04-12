import dns from 'dns/promises';
import net from 'net';
import fetch from 'node-fetch';

function isIP(input) {
  return net.isIP(input) !== 0;
}

async function resolveDomain(domain) {
  try {
    const records = await dns.lookup(domain, { all: true });
    return records.map(r => r.address);
  } catch (err) {
    throw new Error(`DNS lookup failed: ${err.message}`);
  }
}

async function fetchIpInfo(ip) {
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}`);
    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error(data.message || 'IP lookup failed');
    }

    return {
      ip: data.query,
      country: data.country,
      countryCode: data.countryCode,
      region: data.region,
      regionName: data.regionName,
      city: data.city,
      zip: data.zip,
      isp: data.isp,
      org: data.org,
      asn: data.as,
      latitude: data.lat,
      longitude: data.lon,
      timezone: data.timezone
    };
  } catch (err) {
    throw new Error(`IP info fetch failed: ${err.message}`);
  }
}

async function reverseDNS(ip) {
  try {
    return await dns.reverse(ip);
  } catch {
    return [];
  }
}

export async function getIpInfo(target) {
  if (!target) {
    throw new Error('No target provided');
  }

  let ipList = [];

  // Direct IP or resolve domain to IPs
  if (isIP(target)) {
    ipList = [target];
  }
  // Domain name
  else {
    try {
      ipList = await resolveDomain(target);
    } catch (err) {

      const www = `www.${target}`;
    ipList = await resolveDomain(www);
    target = www;
    }
  }

  const results = [];

  for (const ip of ipList) {
    const info = await fetchIpInfo(ip);
    const reverse = await reverseDNS(ip);

    results.push({
      ...info,
      reverseDNS: reverse
    });
  }

  return {
    target,
    count: results.length,
    results
  };
}