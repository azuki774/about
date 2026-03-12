#!/usr/bin/env python3

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qs, urlparse


VIDEOS: list[dict[str, Any]] = [
    {
        "id": "parapara-001",
        "youtubeVideoId": "dQw4w9WgXcQ",
        "playlistItemId": "playlist-item-001",
        "youtubeTitle": "Eurobeat Night Mix",
        "youtubePublishedAt": "2025-01-15T12:00:00.000Z",
        "displayTitle": "Eurobeat Night Mix",
        "downloadUrl": "https://example.com/downloads/eurobeat-night-mix.zip",
        "isPublic": True,
    },
    {
        "id": "parapara-002",
        "youtubeVideoId": "9bZkp7q19f0",
        "playlistItemId": "playlist-item-002",
        "youtubeTitle": "ParaPara Practice Session",
        "youtubePublishedAt": "2025-02-01T12:00:00.000Z",
        "displayTitle": "",
        "downloadUrl": "https://example.com/downloads/parapara-practice.mp4",
        "isPublic": True,
    },
    {
        "id": "parapara-003",
        "youtubeVideoId": "3JZ_D3ELwOQ",
        "playlistItemId": "playlist-item-003",
        "youtubeTitle": "Spring Stage Performance",
        "youtubePublishedAt": "2024-12-20T12:00:00.000Z",
        "displayTitle": "Spring Stage Performance 2024",
        "downloadUrl": "",
        "isPublic": True,
    },
    {
        "id": "parapara-004",
        "youtubeVideoId": "RgKAFK5djSk",
        "playlistItemId": "playlist-item-004",
        "youtubeTitle": "Hidden Draft Movie",
        "youtubePublishedAt": "2025-03-01T12:00:00.000Z",
        "displayTitle": "Hidden Draft Movie",
        "downloadUrl": "https://example.com/downloads/hidden-draft.zip",
        "isPublic": False,
    },
]


@dataclass(frozen=True)
class QueryOptions:
    limit: int
    offset: int
    filters: str | None
    orders: str | None


def first(query: dict[str, list[str]], key: str) -> str | None:
    values = query.get(key)
    if not values:
        return None
    return values[0]


def parse_int(value: str | None, default: int, *, minimum: int = 0, maximum: int | None = None) -> int:
    try:
        parsed = int(value) if value is not None else default
    except ValueError:
        parsed = default

    if parsed < minimum:
        parsed = minimum
    if maximum is not None and parsed > maximum:
        parsed = maximum
    return parsed


def parse_query_options(query: dict[str, list[str]]) -> QueryOptions:
    return QueryOptions(
        limit=parse_int(first(query, "limit"), 100, minimum=1, maximum=100),
        offset=parse_int(first(query, "offset"), 0, minimum=0),
        filters=first(query, "filters"),
        orders=first(query, "orders"),
    )


def apply_filters(items: list[dict[str, Any]], expression: str | None) -> list[dict[str, Any]]:
    if expression == "isPublic[equals]true":
        return [item for item in items if item.get("isPublic") is True]
    if expression == "isPublic[equals]false":
        return [item for item in items if item.get("isPublic") is False]
    return items


def apply_orders(items: list[dict[str, Any]], expression: str | None) -> list[dict[str, Any]]:
    if not expression:
        return items

    ordered = list(items)
    specs = [segment.strip() for segment in expression.split(",") if segment.strip()]
    for spec in reversed(specs):
        reverse = spec.startswith("-")
        field = spec[1:] if reverse else spec
        ordered.sort(key=lambda item: item.get(field), reverse=reverse)
    return ordered


class MockMicroCmsHandler(BaseHTTPRequestHandler):
    server_version = "MockMicroCMS/0.1"

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/":
            self._send_json(
                {
                    "service": "mock-microcms",
                    "endpoints": ["/api/v1/videos"],
                }
            )
            return

        if parsed.path == "/healthz":
            self._send_json({"ok": True})
            return

        if parsed.path == "/api/v1/videos":
            query = parse_qs(parsed.query, keep_blank_values=True)
            options = parse_query_options(query)
            items = apply_orders(apply_filters(VIDEOS, options.filters), options.orders)
            total_count = len(items)
            page = items[options.offset : options.offset + options.limit]
            self._send_json(
                {
                    "contents": page,
                    "totalCount": total_count,
                    "limit": options.limit,
                    "offset": options.offset,
                }
            )
            return

        self._send_json({"message": "Not Found"}, status=404)

    def log_message(self, format: str, *args: Any) -> None:
        return

    def _send_json(self, payload: dict[str, Any], *, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    host = os.environ.get("MOCK_MICROCMS_HOST", "127.0.0.1")
    port = parse_int(os.environ.get("MOCK_MICROCMS_PORT"), 8080, minimum=1, maximum=65535)
    server = ThreadingHTTPServer((host, port), MockMicroCmsHandler)
    print(f"Mock microCMS server listening on http://{host}:{port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
