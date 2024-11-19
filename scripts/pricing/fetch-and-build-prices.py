#!/usr/bin/env python3
"""抓取 pricing 接口并生成稳定的 prices.json。"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

DEFAULT_API_URL = "https://openrouter.ai/api/v1/models"
DEFAULT_TIMEOUT_SECONDS = 20
DEFAULT_RETRIES = 3
DEFAULT_OUTPUT_PATH = "prices.json"
DEFAULT_VENDOR_MAP_PATH = str(Path(__file__).with_name("vendor-channel-map.json"))
DEFAULT_MIN_VALID_MODELS = 1
DEFAULT_MIN_VALID_RATIO = 0.01
OPENROUTER_MAIN_PRICE_MULTIPLIER = Decimal("500000")
OPENROUTER_CACHE_PRICE_MULTIPLIER = Decimal("1000000")
OPENROUTER_CACHE_PRICE_FIELDS = {"input_cache_read", "input_cache_write"}

OPENROUTER_EXTRA_RATIO_FIELD_MAP: List[Tuple[str, str]] = [
    ("input_cache_read", "cached_tokens"),
    ("input_cache_read", "cached_read_tokens"),
    ("input_cache_write", "cached_write_tokens"),
    ("audio", "input_audio_tokens"),
    ("audio", "output_audio_tokens"),
    ("internal_reasoning", "reasoning_tokens"),
    ("image", "input_image_tokens"),
    ("image", "output_image_tokens"),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch pricing API and build canonical prices.json")
    parser.add_argument("--url", default=DEFAULT_API_URL, help="pricing API URL")
    parser.add_argument("--output", default=DEFAULT_OUTPUT_PATH, help="output prices.json path")
    parser.add_argument(
        "--vendor-map",
        default=DEFAULT_VENDOR_MAP_PATH,
        help="vendor name to channel_type mapping JSON path",
    )
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT_SECONDS, help="request timeout seconds")
    parser.add_argument("--retries", type=int, default=DEFAULT_RETRIES, help="retry attempts")
    parser.add_argument(
        "--source-file",
        default="",
        help="optional local JSON file (for test/dry-run), if set then skip HTTP request",
    )
    parser.add_argument(
        "--min-valid-models",
        type=int,
        default=DEFAULT_MIN_VALID_MODELS,
        help="minimum required valid models before writing output",
    )
    parser.add_argument(
        "--min-valid-ratio",
        type=float,
        default=DEFAULT_MIN_VALID_RATIO,
        help="minimum valid model ratio against source model_info count (0~1)",
    )
    return parser.parse_args()


def load_vendor_map(path: Path) -> Dict[str, int]:
    content = path.read_text(encoding="utf-8")
    raw = json.loads(content)
    if not isinstance(raw, dict):
        raise ValueError(f"vendor map must be JSON object: {path}")

    result: Dict[str, int] = {}
    for key, value in raw.items():
        if not isinstance(key, str):
            continue
        try:
            channel_type = int(value)
        except (TypeError, ValueError):
            continue
        result[normalize_vendor_name(key)] = channel_type
    return result


def normalize_vendor_name(name: str) -> str:
    return " ".join(name.strip().lower().split())


def extract_embedded_json(text: str) -> Any:
    stripped = text.lstrip()
    if stripped.startswith("{") or stripped.startswith("["):
        return json.loads(stripped)

    obj_start = text.find("{")
    arr_start = text.find("[")
    starts = [pos for pos in [obj_start, arr_start] if pos != -1]
    if not starts:
        raise ValueError("no JSON payload found in source content")

    start = min(starts)
    return json.loads(text[start:])


def fetch_payload(url: str, timeout: int, retries: int) -> Dict[str, Any]:
    headers = {
        "Accept": "application/json",
        "User-Agent": "one-hub-pricing-bot/1.0",
    }

    retries = max(1, retries)
    last_err: Optional[Exception] = None

    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url=url, headers=headers, method="GET")
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                status = getattr(resp, "status", 200)
                body = resp.read()

            if status >= 400:
                raise RuntimeError(f"HTTP {status} from upstream")

            payload = json.loads(body.decode("utf-8"))
            if not isinstance(payload, dict):
                raise ValueError("response JSON is not an object")
            return payload
        except urllib.error.HTTPError as err:
            should_retry = err.code == 429 or err.code >= 500
            if not should_retry:
                raise
            last_err = err
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError, RuntimeError) as err:
            last_err = err

        if attempt >= retries:
            break

        sleep_seconds = 2 ** (attempt - 1)
        print(f"[fetch] attempt {attempt}/{retries} failed, retry in {sleep_seconds}s: {last_err}")
        time.sleep(sleep_seconds)

    raise RuntimeError(f"failed to fetch pricing API after {retries} attempts: {last_err}")


def parse_decimal(value: Any) -> Optional[Decimal]:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return Decimal(str(value))
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            return Decimal(text)
        except InvalidOperation:
            return None
    return None


def to_number(value: Any, fallback: float = 0.0) -> float:
    dec = parse_decimal(value)
    if dec is None:
        return fallback
    return float(dec)


def clamp_non_negative(value: float) -> float:
    return value if value >= 0 else 0.0


def convert_openrouter_price(
    value: Any,
    multiplier: Decimal = OPENROUTER_MAIN_PRICE_MULTIPLIER,
) -> Optional[float]:
    dec = parse_decimal(value)
    if dec is None:
        return None
    return clamp_non_negative(float(dec * multiplier))


def validate_payload(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    # OpenRouter models endpoint shape: { "data": [ ... ] }
    data = payload.get("data")
    if not isinstance(data, list):
        raise ValueError('invalid response: "data" is missing or not array')
    return [item for item in data if isinstance(item, dict)]


def build_openrouter_extra_ratios(pricing_obj: Dict[str, Any]) -> Optional[Dict[str, float]]:
    extra: Dict[str, float] = {}
    for source_field, target_field in OPENROUTER_EXTRA_RATIO_FIELD_MAP:
        multiplier = (
            OPENROUTER_CACHE_PRICE_MULTIPLIER
            if source_field in OPENROUTER_CACHE_PRICE_FIELDS
            else OPENROUTER_MAIN_PRICE_MULTIPLIER
        )
        converted = convert_openrouter_price(pricing_obj.get(source_field), multiplier=multiplier)
        if converted is None:
            continue
        extra[target_field] = clamp_non_negative(converted)

    if not extra:
        return None

    ordered = {key: extra[key] for key in sorted(extra.keys())}
    return ordered


def extract_vendor_prefix(model_name: str) -> str:
    normalized_model_name = model_name.strip()
    if "/" not in normalized_model_name:
        return ""
    prefix = normalized_model_name.split("/", 1)[0]
    return normalize_vendor_name(prefix)


def pick_channel_type(vendor_name: str, vendor_map: Dict[str, int]) -> Optional[int]:
    normalized_vendor = normalize_vendor_name(vendor_name)
    if not normalized_vendor:
        return None

    raw_value = vendor_map.get(normalized_vendor)
    if raw_value is None:
        return None

    try:
        channel_type = int(raw_value)
    except (TypeError, ValueError):
        return None

    if channel_type <= 0:
        return None
    return channel_type


def normalize_models(
    model_info: List[Dict[str, Any]],
    vendor_map: Dict[str, int],
) -> List[Dict[str, Any]]:
    normalized_items: List[Dict[str, Any]] = []

    for item in model_info:
        if not isinstance(item, dict):
            continue

        openrouter_model_id = item.get("id")
        openrouter_pricing = item.get("pricing")
        if not isinstance(openrouter_model_id, str) or not isinstance(openrouter_pricing, dict):
            continue

        full_model_name = openrouter_model_id.strip()
        if not full_model_name:
            continue

        vendor_name = extract_vendor_prefix(full_model_name)
        channel_type = pick_channel_type(vendor_name, vendor_map)
        if channel_type is None:
            # vendor 仅用于识别 channel_type，未识别则跳过
            continue

        if "/" not in full_model_name:
            continue
        model_name = full_model_name.split("/", 1)[1].strip()
        if not model_name:
            continue

        input_value = convert_openrouter_price(
            openrouter_pricing.get("prompt"),
            multiplier=OPENROUTER_MAIN_PRICE_MULTIPLIER,
        )
        output_value = convert_openrouter_price(
            openrouter_pricing.get("completion"),
            multiplier=OPENROUTER_MAIN_PRICE_MULTIPLIER,
        )
        extra_ratios = build_openrouter_extra_ratios(openrouter_pricing)

        entry: Dict[str, Any] = {
            "model": model_name,
            "type": "tokens",
            "channel_type": channel_type,
            "input": input_value if input_value is not None else 0.0,
            "output": output_value if output_value is not None else 0.0,
        }
        if extra_ratios:
            entry["extra_ratios"] = extra_ratios

        normalized_items.append(entry)

    deduped: Dict[str, Dict[str, Any]] = {}

    def score(entry: Dict[str, Any]) -> Tuple[int, int, int, str]:
        has_price = 1 if (entry.get("input", 0) > 0 or entry.get("output", 0) > 0) else 0
        known_channel = 1 if entry.get("channel_type", 0) > 0 else 0
        token_priority = 1 if entry.get("type") == "tokens" else 0
        extras_count = len(entry.get("extra_ratios", {})) if isinstance(entry.get("extra_ratios"), dict) else 0
        canonical = json.dumps(entry, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        return (has_price, known_channel + token_priority, extras_count, canonical)

    for entry in normalized_items:
        model = entry["model"]
        existing = deduped.get(model)
        if existing is None:
            deduped[model] = entry
            continue

        if score(entry) > score(existing):
            deduped[model] = entry

    result = [deduped[key] for key in sorted(deduped.keys(), key=lambda x: (x.lower(), x))]
    return result


def is_effective_model_entry(entry: Dict[str, Any]) -> bool:
    model = entry.get("model")
    if not isinstance(model, str) or not model.strip():
        return False

    input_value = parse_decimal(entry.get("input"))
    output_value = parse_decimal(entry.get("output"))

    input_positive = input_value is not None and input_value > 0
    output_positive = output_value is not None and output_value > 0
    return bool(input_positive or output_positive)


def enforce_validity_guardrails(
    prices: List[Dict[str, Any]],
    source_model_count: int,
    min_valid_models: int,
    min_valid_ratio: float,
) -> Tuple[int, float]:
    if min_valid_models < 1:
        raise ValueError("--min-valid-models must be >= 1")
    if min_valid_ratio < 0 or min_valid_ratio > 1:
        raise ValueError("--min-valid-ratio must be between 0 and 1")

    valid_models = sum(1 for entry in prices if isinstance(entry, dict) and is_effective_model_entry(entry))
    if valid_models < min_valid_models:
        raise RuntimeError(
            f"validity guard failed: valid_models={valid_models} < min_valid_models={min_valid_models}"
        )

    denominator = max(1, int(source_model_count))
    valid_ratio = valid_models / denominator
    if valid_ratio < min_valid_ratio:
        raise RuntimeError(
            f"validity guard failed: valid_ratio={valid_ratio:.4f} < min_valid_ratio={min_valid_ratio:.4f}"
        )

    return valid_models, valid_ratio


def write_prices(path: Path, prices: List[Dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(prices, f, ensure_ascii=False, indent=2)
        f.write("\n")


def load_payload_from_file(path: Path) -> Dict[str, Any]:
    raw = path.read_text(encoding="utf-8")
    payload = extract_embedded_json(raw)
    if not isinstance(payload, dict):
        raise ValueError("source-file JSON root must be object")
    return payload


def main() -> int:
    args = parse_args()

    output_path = Path(args.output)
    vendor_map_path = Path(args.vendor_map)

    vendor_map = load_vendor_map(vendor_map_path)

    if args.source_file:
        payload = load_payload_from_file(Path(args.source_file))
    else:
        payload = fetch_payload(args.url, timeout=max(1, args.timeout), retries=max(1, args.retries))

    model_info = validate_payload(payload)
    prices = normalize_models(model_info, vendor_map)

    valid_models, valid_ratio = enforce_validity_guardrails(
        prices=prices,
        source_model_count=len(model_info),
        min_valid_models=args.min_valid_models,
        min_valid_ratio=args.min_valid_ratio,
    )

    write_prices(output_path, prices)

    print(
        f"[done] generated {len(prices)} models to {output_path} "
        f"(valid={valid_models}, ratio={valid_ratio:.4f}, source={len(model_info)})"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001
        print(f"[error] {exc}", file=sys.stderr)
        raise SystemExit(1)
