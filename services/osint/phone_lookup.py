import json
import sys


def main():
    try:
        import phonenumbers
        from phonenumbers import carrier, timezone, geocoder
    except Exception as e:
        print(json.dumps({"ok": False, "error": f"phonenumbers_not_installed: {str(e)}"}))
        return 1

    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "missing_number"}))
        return 1

    raw = sys.argv[1]
    if not raw:
        print(json.dumps({"ok": False, "error": "missing_number"}))
        return 1

    try:
        num = phonenumbers.parse(raw, None)
        is_possible = phonenumbers.is_possible_number(num)
        is_valid = phonenumbers.is_valid_number(num)
        e164 = phonenumbers.format_number(num, phonenumbers.PhoneNumberFormat.E164)

        c = carrier.name_for_number(num, "en") or None
        tz = list(timezone.time_zones_for_number(num)) if is_possible else []
        desc = geocoder.description_for_number(num, "en") or None

        print(
            json.dumps(
                {
                    "ok": True,
                    "e164": e164,
                    "possible": bool(is_possible),
                    "valid": bool(is_valid),
                    "carrier": c,
                    "time_zones": tz,
                    "description": desc,
                }
            )
        )
        return 0
    except Exception as e:
        print(json.dumps({"ok": False, "error": f"parse_failed: {str(e)}"}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

