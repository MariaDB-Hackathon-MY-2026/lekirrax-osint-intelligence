import fetch from 'node-fetch';

//GeoSpy: Performs deep IP intelligence and geolocation analysis
export const runGeoSpy = async (target) => {
    try {
        const res = await fetch(`http://ip-api.com/json/${target}?fields=status,message,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,as,proxy,hosting,query`);
        const data = await res.json();

        if (data.status !== 'success') {
            throw new Error(data.message || 'Geolocation lookup failed');
        }

        return {
            module: 'GeoSpy',
            risk: data.proxy || data.hosting ? 'Medium' : 'Low',
            data: {
                target: data.query,
                location: `${data.city}, ${data.regionName}, ${data.country}`,
                coordinates: `${data.lat}° N, ${data.lon}° E`,
                asn: data.as,
                isp: data.isp,
                timezone: data.timezone,
                privacy_masking: data.proxy || false,
                is_hosting: data.hosting || false
            }
        };
    } catch (err) {
        return {
            module: 'GeoSpy',
            risk: 'Unknown',
            error: err.message
        };
    }
};
