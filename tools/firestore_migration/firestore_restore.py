#!/usr/bin/env python3
"""
Restore Firestore data from a JSON backup produced by firestore_backup.py.

Default target env file: .env.target.local
Required target vars (env or env file):
- TARGET_FIREBASE_PROJECT_ID
- TARGET_FIREBASE_CLIENT_EMAIL
- TARGET_FIREBASE_PRIVATE_KEY
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from typing import Any, Dict, Optional
from urllib.parse import quote

import requests
from google.oauth2 import service_account
from google.auth.transport.requests import Request
from dotenv import dotenv_values

SCOPES = ["https://www.googleapis.com/auth/datastore"]


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


def load_target_creds(env_file: str) -> FirebaseAdminCreds:
    file_map = load_env_file(env_file)
    project_id = resolve_env("TARGET_FIREBASE_PROJECT_ID", file_map)
    client_email = resolve_env("TARGET_FIREBASE_CLIENT_EMAIL", file_map)
    private_key = resolve_env("TARGET_FIREBASE_PRIVATE_KEY", file_map)

    if not project_id or not client_email or not private_key:
        raise RuntimeError(
            f"Missing target Firebase admin vars. Check {env_file} or shell env: "
            "TARGET_FIREBASE_PROJECT_ID, TARGET_FIREBASE_CLIENT_EMAIL, TARGET_FIREBASE_PRIVATE_KEY"
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


def encode_value(value: Any) -> Dict[str, Any]:
    if value is None:
        return {"nullValue": None}
    if isinstance(value, bool):
        return {"booleanValue": value}
    if isinstance(value, int) and not isinstance(value, bool):
        return {"integerValue": str(value)}
    if isinstance(value, float):
        return {"doubleValue": value}
    if isinstance(value, str):
        return {"stringValue": value}
    if isinstance(value, list):
        return {"arrayValue": {"values": [encode_value(item) for item in value]}}
    if isinstance(value, dict):
        return {"mapValue": {"fields": encode_fields(value)}}
    return {"stringValue": str(value)}


def encode_fields(data: Dict[str, Any]) -> Dict[str, Any]:
    return {k: encode_value(v) for k, v in data.items()}


def api_base(project_id: str) -> str:
    return f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents"


def upsert_doc(project_id: str, token: str, doc_path: str, fields: Dict[str, Any], dry_run: bool) -> None:
    if dry_run:
        print(f"[restore] DRY_RUN upsert {doc_path}")
        return

    url = f"{api_base(project_id)}/{quote(doc_path, safe='/')}"
    response = requests.patch(
        url,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        data=json.dumps({"fields": encode_fields(fields)}),
        timeout=60,
    )
    if response.status_code >= 400:
        raise RuntimeError(f"PATCH {url} failed ({response.status_code}): {response.text[:800]}")


def restore_doc_tree(project_id: str, token: str, node: Dict[str, Any], dry_run: bool) -> int:
    doc_path = str(node.get("path", "")).strip()
    if not doc_path:
        raise RuntimeError("Backup node missing 'path'")

    fields = node.get("fields", {})
    if not isinstance(fields, dict):
        raise RuntimeError(f"Invalid fields for {doc_path}")

    upsert_doc(project_id, token, doc_path, fields, dry_run=dry_run)
    count = 1

    subcollections = node.get("subcollections", {})
    if isinstance(subcollections, dict):
        for col_id, col_value in subcollections.items():
            if not isinstance(col_value, dict):
                continue
            docs = col_value.get("docs", {})
            if not isinstance(docs, dict):
                continue
            for _doc_id, child_node in docs.items():
                if not isinstance(child_node, dict):
                    continue
                count += restore_doc_tree(project_id, token, child_node, dry_run=dry_run)
    return count


def run_restore(backup_file: str, env_file: str, dry_run: bool) -> int:
    if not os.path.exists(backup_file):
        raise RuntimeError(f"Backup file not found: {backup_file}")

    with open(backup_file, "r", encoding="utf-8") as f:
        payload = json.load(f)

    collections = payload.get("collections", {})
    if not isinstance(collections, dict):
        raise RuntimeError("Invalid backup format: missing collections")

    creds = load_target_creds(env_file)
    token = get_access_token(creds)

    total_docs = 0
    for col_id, col_value in collections.items():
        if not isinstance(col_value, dict):
            continue
        docs = col_value.get("docs", {})
        if not isinstance(docs, dict):
            continue
        print(f"[restore] collection: {col_id}")
        for _doc_id, node in docs.items():
            if not isinstance(node, dict):
                continue
            total_docs += restore_doc_tree(creds.project_id, token, node, dry_run=dry_run)

    return total_docs


def main() -> int:
    parser = argparse.ArgumentParser(description="Restore Firestore backup JSON into target project")
    parser.add_argument("--backup-file", required=True, help="Backup JSON file path")
    parser.add_argument("--env-file", default=".env.target.local", help="Target env file path")
    parser.add_argument("--dry-run", action="store_true", help="Print actions without writing")
    args = parser.parse_args()

    try:
        total_docs = run_restore(args.backup_file, args.env_file, dry_run=args.dry_run)
    except Exception as exc:
        print(f"[restore] FAILED: {exc}", file=sys.stderr)
        return 1

    if args.dry_run:
        print(f"[restore] DRY_RUN complete. docs={total_docs}")
    else:
        print(f"[restore] DONE. docs={total_docs}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
