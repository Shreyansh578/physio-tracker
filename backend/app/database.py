"""Asynchronous SQLite database operations for user profiles, workout sessions, and analytics."""

from datetime import datetime, timezone
import hashlib
import json
import logging
import os
from pathlib import Path
import secrets
from typing import Any, Dict, List, Optional
import aiosqlite

logger = logging.getLogger(__name__)

# Base paths
BACKEND_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BACKEND_DIR / "data" / "physio.db"


def hash_password(password: str) -> str:
    """Hash a plain text password using PBKDF2-HMAC-SHA256 with a unique random salt."""
    salt = secrets.token_hex(16)
    pwd_hash = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000
    ).hex()
    return f"{salt}:{pwd_hash}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify a plain text password against stored salt:hash string."""
    try:
        salt, pwd_hash = stored_hash.split(":")
        candidate_hash = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000
        ).hex()
        return secrets.compare_digest(candidate_hash, pwd_hash)
    except Exception:
        return False


async def init_db(db_path: Optional[Path] = None) -> None:
    """Initialize the SQLite database, create directories, users table, and session schema."""
    path = db_path or DB_PATH
    path.parent.mkdir(parents=True, exist_ok=True)

    async with aiosqlite.connect(str(path)) as db:
        # 1. Users table (supports both Google OAuth and manual email/password accounts)
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                picture TEXT,
                password_hash TEXT,
                created_at TEXT NOT NULL
            )
            """
        )

        # 2. Sessions table
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                started_at TEXT NOT NULL,
                ended_at TEXT,
                exercise_type TEXT NOT NULL,
                total_reps INTEGER DEFAULT 0,
                avg_form_score REAL DEFAULT 0.0,
                feedback_log TEXT DEFAULT '[]'
            )
            """
        )

        # Check existing columns in users table and add missing ones
        cursor = await db.execute("PRAGMA table_info(users)")
        user_cols = [row[1] for row in await cursor.fetchall()]
        if "password_hash" not in user_cols:
            await db.execute("ALTER TABLE users ADD COLUMN password_hash TEXT")
            logger.info("Migrated users table with password_hash column")

        # Check existing columns in sessions table and add missing ones
        cursor = await db.execute("PRAGMA table_info(sessions)")
        sess_cols = [row[1] for row in await cursor.fetchall()]
        if "user_id" not in sess_cols:
            await db.execute("ALTER TABLE sessions ADD COLUMN user_id TEXT")
            logger.info("Migrated sessions table with user_id column")

        await db.commit()
    logger.info(f"Database initialized at {path}")


async def upsert_user(
    user_id: str,
    email: str,
    name: str,
    picture: Optional[str] = None,
    db_path: Optional[Path] = None,
) -> Dict[str, Any]:
    """Insert or update a user profile from Google OAuth.
    Safely resolves existing user records by email or ID without UNIQUE constraint collisions.
    """
    path = db_path or DB_PATH
    now = datetime.now(timezone.utc).isoformat()
    clean_email = email.lower().strip()
    clean_name = name.strip() or clean_email.split("@")[0]

    async with aiosqlite.connect(str(path)) as db:
        db.row_factory = aiosqlite.Row

        # Check if user with this email or ID already exists
        cursor = await db.execute(
            "SELECT * FROM users WHERE email = ? OR id = ?",
            (clean_email, user_id),
        )
        existing = await cursor.fetchone()

        if existing:
            target_id = existing["id"]
            await db.execute(
                """
                UPDATE users
                SET name = ?, picture = CASE WHEN ? != '' THEN ? ELSE picture END
                WHERE id = ?
                """,
                (clean_name, picture or "", picture or "", target_id),
            )
            await db.commit()
            cursor = await db.execute("SELECT * FROM users WHERE id = ?", (target_id,))
            row = await cursor.fetchone()
        else:
            await db.execute(
                """
                INSERT INTO users (id, email, name, picture, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (user_id, clean_email, clean_name, picture or "", now),
            )
            await db.commit()
            cursor = await db.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            row = await cursor.fetchone()

        assert row is not None
        user_dict = dict(row)
        user_dict.pop("password_hash", None)
        return user_dict


async def register_user_email(
    email: str,
    password: str,
    name: str,
    db_path: Optional[Path] = None,
) -> Dict[str, Any]:
    """Register a new user account with manual email and password."""
    path = db_path or DB_PATH
    cleaned_email = email.lower().strip()
    cleaned_name = name.strip() or cleaned_email.split("@")[0]
    now = datetime.now(timezone.utc).isoformat()
    pwd_hashed = hash_password(password)
    user_id = f"usr_{secrets.token_hex(8)}"
    avatar = f"https://api.dicebear.com/7.x/initials/svg?seed={cleaned_name}"

    async with aiosqlite.connect(str(path)) as db:
        db.row_factory = aiosqlite.Row
        # Check if email is already taken
        cursor = await db.execute("SELECT id FROM users WHERE email = ?", (cleaned_email,))
        if await cursor.fetchone() is not None:
            raise ValueError("An account with this email address already exists.")

        await db.execute(
            """
            INSERT INTO users (id, email, name, picture, password_hash, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (user_id, cleaned_email, cleaned_name, avatar, pwd_hashed, now),
        )
        await db.commit()

        cursor = await db.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = await cursor.fetchone()
        assert row is not None
        user_dict = dict(row)
        user_dict.pop("password_hash", None)
        return user_dict


async def authenticate_user_email(
    email: str,
    password: str,
    db_path: Optional[Path] = None,
) -> Optional[Dict[str, Any]]:
    """Validate user credentials for email/password sign in."""
    path = db_path or DB_PATH
    cleaned_email = email.lower().strip()

    async with aiosqlite.connect(str(path)) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM users WHERE email = ?", (cleaned_email,)
        )
        row = await cursor.fetchone()
        if not row:
            return None

        stored_hash = row["password_hash"]
        if not stored_hash or not verify_password(password, stored_hash):
            return None

        user_dict = dict(row)
        user_dict.pop("password_hash", None)
        return user_dict


async def get_user_by_id(user_id: str, db_path: Optional[Path] = None) -> Optional[Dict[str, Any]]:
    """Look up a user profile by user ID."""
    path = db_path or DB_PATH
    async with aiosqlite.connect(str(path)) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = await cursor.fetchone()
        if row is None:
            return None
        user_dict = dict(row)
        user_dict.pop("password_hash", None)
        return user_dict


async def create_session(
    exercise_type: str,
    user_id: Optional[str] = None,
    db_path: Optional[Path] = None,
) -> int:
    """Create a new workout session record linked to a user."""
    path = db_path or DB_PATH
    started_at = datetime.now(timezone.utc).isoformat()

    async with aiosqlite.connect(str(path)) as db:
        cursor = await db.execute(
            """
            INSERT INTO sessions (user_id, started_at, exercise_type, total_reps, avg_form_score, feedback_log)
            VALUES (?, ?, ?, 0, 0.0, '[]')
            """,
            (user_id, started_at, exercise_type),
        )
        await db.commit()
        return cursor.lastrowid or 0


async def update_session(
    session_id: int,
    total_reps: int,
    avg_form_score: float,
    feedback_log: List[str],
    db_path: Optional[Path] = None,
) -> None:
    """Update an existing session with live exercise metrics."""
    path = db_path or DB_PATH
    async with aiosqlite.connect(str(path)) as db:
        await db.execute(
            """
            UPDATE sessions
            SET total_reps = ?, avg_form_score = ?, feedback_log = ?
            WHERE id = ?
            """,
            (total_reps, avg_form_score, json.dumps(feedback_log), session_id),
        )
        await db.commit()


async def end_session(session_id: int, db_path: Optional[Path] = None) -> None:
    """Finalize a session by recording the ended_at timestamp."""
    path = db_path or DB_PATH
    ended_at = datetime.now(timezone.utc).isoformat()

    async with aiosqlite.connect(str(path)) as db:
        await db.execute(
            """
            UPDATE sessions
            SET ended_at = ?
            WHERE id = ?
            """,
            (ended_at, session_id),
        )
        await db.commit()


async def get_session(session_id: int, db_path: Optional[Path] = None) -> Optional[Dict[str, Any]]:
    """Retrieve a single session by its primary key ID."""
    path = db_path or DB_PATH
    async with aiosqlite.connect(str(path)) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM sessions WHERE id = ?",
            (session_id,),
        )
        row = await cursor.fetchone()
        if row is None:
            return None

        data = dict(row)
        try:
            data["feedback_log"] = json.loads(data["feedback_log"])
        except Exception:
            data["feedback_log"] = []
        return data


async def get_sessions(
    limit: int = 50,
    user_id: Optional[str] = None,
    db_path: Optional[Path] = None,
) -> List[Dict[str, Any]]:
    """Retrieve recent workout sessions, optionally filtered by user ID."""
    path = db_path or DB_PATH
    async with aiosqlite.connect(str(path)) as db:
        db.row_factory = aiosqlite.Row
        if user_id:
            cursor = await db.execute(
                """
                SELECT * FROM sessions
                WHERE user_id = ?
                ORDER BY id DESC
                LIMIT ?
                """,
                (user_id, limit),
            )
        else:
            cursor = await db.execute(
                """
                SELECT * FROM sessions
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            )
        rows = await cursor.fetchall()
        result = []
        for row in rows:
            data = dict(row)
            try:
                data["feedback_log"] = json.loads(data["feedback_log"])
            except Exception:
                data["feedback_log"] = []
            result.append(data)
        return result


async def get_analytics_summary(
    user_id: Optional[str] = None,
    db_path: Optional[Path] = None,
) -> Dict[str, Any]:
    """Calculate aggregate recovery and exercise metrics for analytics."""
    path = db_path or DB_PATH
    async with aiosqlite.connect(str(path)) as db:
        db.row_factory = aiosqlite.Row
        where_clause = "WHERE user_id = ?" if user_id else ""
        params = (user_id,) if user_id else ()

        # Total sessions & reps
        cursor = await db.execute(
            f"""
            SELECT 
                COUNT(*) as total_sessions,
                COALESCE(SUM(total_reps), 0) as total_reps,
                COALESCE(AVG(avg_form_score), 0.0) as overall_form_score
            FROM sessions {where_clause}
            """,
            params,
        )
        stats = dict(await cursor.fetchone() or {})

        # Breakdown by exercise type
        cursor = await db.execute(
            f"""
            SELECT 
                exercise_type,
                COUNT(*) as sessions_count,
                SUM(total_reps) as total_reps,
                AVG(avg_form_score) as avg_form_score
            FROM sessions {where_clause}
            GROUP BY exercise_type
            """,
            params,
        )
        exercise_breakdown = [dict(row) for row in await cursor.fetchall()]

        # Recent 7 sessions trend
        cursor = await db.execute(
            f"""
            SELECT id, started_at, exercise_type, total_reps, avg_form_score
            FROM sessions {where_clause}
            ORDER BY id ASC
            LIMIT 14
            """,
            params,
        )
        recent_trend = [dict(row) for row in await cursor.fetchall()]

        return {
            "total_sessions": stats.get("total_sessions", 0),
            "total_reps": stats.get("total_reps", 0),
            "overall_form_score": round(stats.get("overall_form_score", 0.0), 2),
            "exercise_breakdown": exercise_breakdown,
            "recent_trend": recent_trend,
        }
