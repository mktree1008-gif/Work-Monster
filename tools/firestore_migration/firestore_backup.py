#!/usr/bin/env python3
"""
Export all Firestore documents (including nested subcollections) into a JSON backup.

Default source env file: .env.local
Required source vars:
- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote

import requests
from google.oauth2 import service_account
from google.auth.transport.requests import Request
from dotenv import dotenv_values

SCOPES = ["https://www.googleapis.com/auth/datastore"]
DEFAULT_COLLECTIONS = [
    "users",
    "submissions",
    "scores",
    "rules",
    "rewards",
    "reward_claims",
    "penalty_history",
    "audit_logs",
    "announcements",
    "notifications",
]


@dataclass
class FirebaseAdminCreds:
    project_id: str
    client_email: str
    private_key: str


def load_env_file(path: str) -> Dict[str, str]:
    if not os.path.exists(path):
        return {}
    parsed = dotenv_values(path)
    return {str(k): str(v) for k, v in parsed.items() if k is not None and v is not None}


def resolve_env(key: str, env_file_map: Dict[str, str], fallback: Optional[str] = None) -> Optional[str]:
    if key in os.environ and os.environ[key].strip() != "":
        return os.environ[key]
    value = env_file_map.get(key)
    if value is not None and value.strip() != "":
        return value
    return fallback


def load_source_creds(env_file: str) -> FirebaseAdminCreds:
    file_map = load_env_file(env_file)
    project_id = resolve_env("FIREBASE_PROJECT_ID", file_map)
    client_email = resolve_env("FIREBASE_CLIENT_EMAIL", file_map)
    private_key = resolve_env("FIREBASE_PRIVATE_KEY", file_map)

    if not project_id or not client_email or not private_key:
        raise RuntimeError(
            f"Missing source Firebase admin vars. Check {env_file} or shell env: "
            "FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY"
        )

    private_key = private_key.replace("\\n", "\n")
    return FirebaseAdminCreds(project_id=project_id, client_email=client_email, private_key=private_key)


def get_access_token(creds: FirebaseAdminCreds) -> str:
    info = {
        "type": "service_account",
        "project_id": creds.project_id,
        "private_key": creds.private_key,
        "client_email": creds.client_email,
        "token_uri": "https://oauth2.googleapis.com/token",
    }
    scoped = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
    scoped.refresh(Request())
    if not scoped.token:
        raise RuntimeError("Failed to fetch Google access token")
    return scoped.token


def decode_value(value: Dict[str, Any]) -> Any:
    if "nullValue" in value:
        return None
    if "booleanValue" in value:
        return bool(value["booleanValue"])
    if "stringValue" in value:
        return str(value["stringValue"])
    if "timestampValue" in value:
        return str(value["timestampValue"])
    if "integerValue" in value:
        return int(value["integerValue"])
    if "doubleValue" in value:
        return float(value["doubleValue"])
    if "mapValue" in value:
        fields = value.get("mapValue", {}).get("fields", {})
        return {k: decode_value(v) for k, v in fields.items()}
    if "arrayValue" in value:
        values = value.get("arrayValue", {}).get("values", [])
        return [decode_value(v) for v in values]
    if "bytesValue" in value:
        return str(value["bytesValue"])
    if "referenceValue" in value:
        return str(value["referenceValue"])
    if "geoPointValue" in value:
        gp = value["geoPointValue"]
        return {"latitude": gp.get("latitude"), "longitude": gp.get("longitude")}
    return None


def decode_fields(fields: Dict[str, Any]) -> Dict[str, Any]:
    return {k: decode_value(v) for k, v in fields.items()}


def api_base(project_id: str) -> str:
    return f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents"


def post_json(url: str, token: str, body: Dict[str, Any]) -> Dict[str, Any]:
    response = requests.post(
        url,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        data=json.dumps(body),
        timeout=60,
    )
    if response.status_code >= 400:
        raise RuntimeError(f"POST {url} failed ({response.status_code}): {response.text[:800]}")
    return response.json() if response.text else {}


def get_json(url: str, token: str) -> Dict[str, Any]:
    response = requests.get(
        url,
        headers={"Authorization": f"Bearer {token}"},
        timeout=60,
    )
    if response.status_code >= 400:
        raise RuntimeError(f"GET {url} failed ({response.status_code}): {response.text[:800]}")
    return response.json() if response.text else {}


def list_collection_ids(project_id: str, token: str, parent_path: Optional[str] = None) -> List[str]:
    base = api_base(project_id)
    url = f"{base}:listCollectionIds" if not parent_path else f"{base}/{quote(parent_path, safe='/')}:listCollectionIds"
    ids: List[str] = []
    page_token: Optional[str] = None
    while True:
        body: Dict[str, Any] = {"pageSize": 200}
        if page_token:
            body["pageToken"] = page_token
        payload = post_json(url, token, body)
        ids.extend(payload.get("collectionIds", []))
        page_token = payload.get("nextPageToken")
        if not page_token:
            break
    return ids


def list_documents_in_collection(project_id: str, token: str, collection_path: str) -> List[Dict[str, Any]]:
    base = api_base(project_id)
    docs: List[Dict[str, Any]] = []
    page_token: Optional[str] = None
    while True:
        url = f"{base}/{quote(collection_path, safe='/')}?pageSize=200"
        if page_token:
            url += f"&pageToken={quote(page_token, safe='')}"
        payload = get_json(url, token)
        docs.extend(payload.get("documents", []))
        page_token = payload.get("nextPageToken")
        if not page_token:
            break
    return docs


def parse_doc_path(project_id: str, doc_name: str) -> str:
    prefix = f"projects/{project_id}/databases/(default)/documents/"
    if not doc_name.startswith(prefix):
        raise RuntimeError(f"Unexpected document name format: {doc_name}")
    return doc_name[len(prefix):]


def backup_doc(
    project_id: str,
    token: str,
    doc_payload: Dict[str, Any],
    include_subcollections: bool = False,
    depth: int = 0,
) -> Dict[str, Any]:
    doc_name = str(doc_payload.get("name", "")).strip()
    if not doc_name:
        raise RuntimeError("Document payload missing 'name'")
    doc_path = parse_doc_path(project_id, doc_name)
    doc_id = doc_path.split("/")[-1]
    fields = decode_fields(doc_payload.get("fields", {}))

    subcollections: Dict[str, Any] = {}
    if include_subcollections:
        for col_id in list_collection_ids(project_id, token, parent_path=doc_path):
            collection_path = f"{doc_path}/{col_id}"
            col_docs = list_documents_in_collection(project_id, token, collection_path)
            col_bucket: Dict[str, Any] = {}
            for child in col_docs:
                child_name = child.get("name")
                if not child_name:
                    continue
                child_doc_path = parse_doc_path(project_id, child_name)
                child_doc_id = child_doc_path.split("/")[-1]
                col_bucket[child_doc_id] = backup_doc(
                    project_id,
                    token,
                    child,
                    include_subcollections=include_subcollections,
                    depth=depth + 1,
                )
            subcollections[col_id] = {"docs": col_bucket}

    return {
        "id": doc_id,
        "path": doc_path,
        "fields": fields,
        "subcollections": subcollections,
    }


def run_backup(
    env_file: str,
    output: str,
    include_subcollections: bool = False,
    collections_override: Optional[List[str]] = None,
) -> Tuple[int, int]:
    creds = load_source_creds(env_file)
    token = get_access_token(creds)

    if collections_override:
        root_ids = collections_override
    else:
        root_ids = list_collection_ids(creds.project_id, token)
    result: Dict[str, Any] = {
        "format_version": 1,
        "source_project_id": creds.project_id,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "collections": {},
    }

    total_collections = 0
    total_docs = 0

    for col_id in root_ids:
        total_collections += 1
        print(f"[backup] collection: {col_id}")
        docs = list_documents_in_collection(creds.project_id, token, col_id)
        bucket: Dict[str, Any] = {}
        for doc in docs:
            name = doc.get("name")
            if not name:
                continue
            total_docs += 1
            node = backup_doc(
                creds.project_id,
                token,
                doc,
                include_subcollections=include_subcollections,
            )
            bucket[node["id"]] = node
        result["collections"][col_id] = {"docs": bucket}

    os.makedirs(os.path.dirname(output) or ".", exist_ok=True)
    with open(output, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    return total_collections, total_docs


def main() -> int:
    parser = argparse.ArgumentParser(description="Backup Firestore data to JSON")
    parser.add_argument("--env-file", default=".env.local", help="Source env file path (default: .env.local)")
    parser.add_argument("--output", default="", help="Backup output JSON path")
    parser.add_argument(
        "--collections",
        default="",
        help="Comma-separated top-level collections. If omitted, auto-discovery is used.",
    )
    parser.add_argument(
        "--include-subcollections",
        action="store_true",
        help="Recursively backup subcollections for each document (uses more read quota)",
    )
    args = parser.parse_args()

    output = args.output.strip()
    if not output:
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        output = f"backups/firestore-backup-{stamp}.json"

    collections_override: Optional[List[str]] = None
    if args.collections.strip():
        collections_override = [
            token.strip()
            for token in args.collections.split(",")
            if token.strip()
        ]
    elif os.environ.get("FIRESTORE_BACKUP_USE_DEFAULT_COLLECTIONS", "").strip() == "1":
        collections_override = DEFAULT_COLLECTIONS

    try:
        collections, docs = run_backup(
            args.env_file,
            output,
            include_subcollections=args.include_subcollections,
            collections_override=collections_override,
        )
    except Exception as exc:
        print(f"[backup] FAILED: {exc}", file=sys.stderr)
        return 1

    print(f"[backup] DONE: {output}")
    print(f"[backup] collections={collections}, root_docs={docs}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
