import json
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone


def fetch_rdap(domain):
    url = "https://rdap.org/domain/" + domain
    req = urllib.request.Request(url, headers={"Accept": "application/rdap+json"})
    with urllib.request.urlopen(req, timeout=5) as resp:
        data = resp.read().decode("utf-8", errors="replace")
        return json.loads(data)


def parse_created(events):
    if not isinstance(events, list):
        return None
    candidates = []
    for ev in events:
        if not isinstance(ev, dict):
            continue
        action = str(ev.get("eventAction") or "").lower()
        dt = ev.get("eventDate")
        if not isinstance(dt, str) or not dt:
            continue
        if action in ("registration", "registered", "create", "created"):
            candidates.append(dt)
    if candidates:
        return sorted(candidates)[0]
    all_dates = [ev.get("eventDate") for ev in events if isinstance(ev, dict) and isinstance(ev.get("eventDate"), str)]
    all_dates = [d for d in all_dates if d]
    return sorted(all_dates)[0] if all_dates else None


def iso_to_date(s):
    if not isinstance(s, str) or not s:
        return None
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(s)
    except Exception:
        return None


def compute_age_days(created_dt):
    if created_dt is None:
        return None
    if created_dt.tzinfo is None:
        created_dt = created_dt.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    delta = now - created_dt.astimezone(timezone.utc)
    days = int(delta.total_seconds() // 86400)
    return days if days >= 0 else 0


def iter_domains(hostname):
    labels = [p for p in hostname.strip(".").split(".") if p]
    if len(labels) < 2:
        return []
    out = []
    for i in range(0, len(labels) - 1):
        out.append(".".join(labels[i:]))
    return out


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "missing_hostname"}))
        return 1
    hostname = sys.argv[1].strip()
    if not hostname:
        print(json.dumps({"ok": False, "error": "missing_hostname"}))
        return 1

    last_err = None
    for candidate in iter_domains(hostname):
        try:
            rdap = fetch_rdap(candidate)
            created_raw = parse_created(rdap.get("events"))
            created_dt = iso_to_date(created_raw) if created_raw else None
            age_days = compute_age_days(created_dt)
            if age_days is None:
                continue
            created_date = created_dt.date().isoformat() if created_dt else None
            print(json.dumps({"ok": True, "domain": candidate, "created": created_date, "age_days": age_days}))
            return 0
        except urllib.error.HTTPError as e:
            last_err = f"http_{e.code}"
        except Exception as e:
            last_err = str(e)

    print(json.dumps({"ok": False, "error": last_err or "not_found"}))
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

