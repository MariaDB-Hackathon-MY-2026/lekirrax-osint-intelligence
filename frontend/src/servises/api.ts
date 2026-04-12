export async function runRecon(target: string) {
    const res = await fetch(
        `/api/recon?target=${encodeURIComponent(target)}`
    );

    if (!res.ok) {
        throw new Error("API error");
    }

    return res.json();
    }

export async function getOsintData(module: string, target: string, scanId?: number) {
    let url = `/api/osint/${module}?target=${encodeURIComponent(target)}`;
    if (scanId) {
        url += `&scanId=${scanId}`;
    }

    const res = await fetch(url);

    if (!res.ok) {
        throw new Error(`Failed to fetch OSINT data for ${module}`);
    }

    return res.json();
}