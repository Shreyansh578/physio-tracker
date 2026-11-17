"""Asynchronous SQLite database operations for user profiles and workout session history."""

from datetime import datetime, timezone
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
import aiosqlite

logger = logging.getLogger(__name__)

# Base paths
BACKEND_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BACKEND_DIR / "data" / "physio.db"


async def init_db(db_path: Optional[Path] = None) -> None:
    """Initialize the SQLite database, create directories, users table, and session schema.

    Args:
        db_path: Optional custom path to SQLite database. Defaults to data/physio.db.
    """
    path = db_path or DB_PATH
    path.parent.mkdir(parents=True, exist_ok=True)

    async with aiosqlite.connect(str(path)) as db:
        # 1. Users table for Google OAuth profiles
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                picture TEXT,
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

        # Check if user_id column exists in existing database; add if missing
        cursor = await db.execute("PRAGMA table_info(sessions)")
        columns = [row[1] for row in await cursor.fetchall()]
        if "user_id" not in columns:
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

    Args:
        user_id: Unique Google user ID (e.g. google_12345).
        email: User email address.
        name: Full user display name.
        picture: Avatar URL.
        db_path: Optional path to SQLite database.

    Returns:
        dict: User profile record.
    """
    path = db_path or DB_PATH
    now = datetime.now(timezone.utc).isoformat()

    async with aiosqlite.connect(str(path)) as db:
        db.row_factory = aiosqlite.Row
        await db.execute(
            """
            INSERT INTO users (id, email, name, picture, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                email = excluded.email,
                name = excluded.name,
                picture = excluded.picture
            """,
            (user_id, email, name, picture or "", now),
        )
        await db.commit()

        cursor = await db.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = await cursor.fetchone()
        assert row is not None
        return dict(row)


async def get_user_by_id(user_id: str, db_path: Optional[Path] = None) -> Optional[Dict[str, Any]]:
    """Look up a user profile by user ID."""
    path = db_path or DB_PATH
    async with aiosqlite.connect(str(path)) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = await cursor.fetchone()
        if row is None:
            return None
        return dict(row)


async def create_session(
    exercise_type: str,
    user_id: Optional[str] = None,
    db_path: Optional[Path] = None,
) -> int:
    """Create a new workout session record linked to a user.

    Args:
        exercise_type: Name/type of the exercise being recorded.
        user_id: Optional authenticated user ID.
        db_path: Optional custom path to SQLite database.

    Returns:
        int: The auto-generated session ID.
    """
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
        session_id = cursor.lastrowid
        assert session_id is not None
        return session_id


async def update_session(
    session_id: int,
    total_reps: int,
    avg_form_score: float,
    feedback_log: List[Any],
    db_path: Optional[Path] = None,
) -> None:
    """Update an existing session with final rep counts, average score, and feedback logs."""
    path = db_path or DB_PATH
    ended_at = datetime.now(timezone.utc).isoformat()
    feedback_json = json.dumps(feedback_log)

    async with aiosqlite.connect(str(path)) as db:
        await db.execute(
            """
            UPDATE sessions
            SET ended_at = ?,
                total_reps = ?,
                avg_form_score = ?,
                feedback_log = ?
            WHERE id = ?
            """,
            (ended_at, total_reps, avg_form_score, feedback_json, session_id),
        )
        await db.commit()


def _format_session_row(row: aiosqlite.Row) -> Dict[str, Any]:
    """Helper to convert a sqlite Row to a dict, deserializing feedback_log JSON."""
    item = dict(row)
    if isinstance(item.get("feedback_log"), str):
        try:
            item["feedback_log"] = json.loads(item["feedback_log"])
        except Exception:
            item["feedback_log"] = []
    return item


async def get_sessions(
    user_id: Optional[str] = None,
    db_path: Optional[Path] = None,
) -> List[Dict[str, Any]]:
    """Retrieve recorded exercise sessions ordered by started_at descending.

    If user_id is provided, returns sessions for that user or unassigned legacy sessions.
    """
    path = db_path or DB_PATH
    async with aiosqlite.connect(str(path)) as db:
        db.row_factory = aiosqlite.Row
        if user_id:
            cursor = await db.execute(
                "SELECT * FROM sessions WHERE user_id = ? OR user_id IS NULL ORDER BY started_at DESC LIMIT 50",
                (user_id,),
            )
        else:
            cursor = await db.execute(
                "SELECT * FROM sessions ORDER BY started_at DESC LIMIT 50"
            )
        rows = await cursor.fetchall()
        return [_format_session_row(row) for row in rows]


async def get_session(session_id: int, db_path: Optional[Path] = None) -> Optional[Dict[str, Any]]:
    """Retrieve a single session by its unique ID."""
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
        return _format_session_row(row)
