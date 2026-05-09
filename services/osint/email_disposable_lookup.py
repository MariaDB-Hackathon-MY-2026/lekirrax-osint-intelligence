import json
import os
import sys


def load_domains(path):
    domains = set()
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            s = line.strip().lower()
            if not s or s.startswith("#"):
                continue
            domains.add(s)
    return domains


def is_disposable_domain(domain, domain_set):
    d = domain.strip(".").lower()
    if not d:
        return False, None
    parts = [p for p in d.split(".") if p]
    for i in range(0, len(parts)):
        candidate = ".".join(parts[i:])
        if candidate in domain_set:
            return True, candidate
    return False, None


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"ok": False, "error": "usage: script <list_path> <domain>"}))
        return 1

    list_path = sys.argv[1]
    domain = sys.argv[2]

    if not os.path.isfile(list_path):
        print(json.dumps({"ok": False, "error": "list_not_found"}))
        return 1

    try:
        domain_set = load_domains(list_path)
        disposable, matched = is_disposable_domain(domain, domain_set)
        print(json.dumps({"ok": True, "is_disposable": bool(disposable), "matched": matched, "source": "list"}))
        return 0
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

