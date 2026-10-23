"""Asynchronous SQLite database operations for session history using aiosqlite."""

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
    """Initialize the SQLite database, create directories and schema if not exist.

    Args:
        db_path: Optional custom path to SQLite database. Defaults to data/physio.db.
    """
    path = db_path or DB_PATH
    path.parent.mkdir(parents=True, exist_ok=True)

    async with aiosqlite.connect(str(path)) as db:
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                started_at TEXT NOT NULL,
                ended_at TEXT,
                exercise_type TEXT NOT NULL,
                total_reps INTEGER DEFAULT 0,
                avg_form_score REAL DEFAULT 0.0,
                feedback_log TEXT DEFAULT '[]'
            )
            """
        )
        await db.commit()
    logger.info(f"Database initialized at {path}")


async def create_session(exercise_type: str, db_path: Optional[Path] = None) -> int:
    """Create a new workout session record.

    Args:
        exercise_type: Name/type of the exercise being recorded.
        db_path: Optional custom path to SQLite database.

    Returns:
        int: The auto-generated session ID.
    """
    path = db_path or DB_PATH
    started_at = datetime.now(timezone.utc).isoformat()

    async with aiosqlite.connect(str(path)) as db:
        cursor = await db.execute(
            """
            INSERT INTO sessions (started_at, exercise_type, total_reps, avg_form_score, feedback_log)
            VALUES (?, ?, 0, 0.0, '[]')
            """,
            (started_at, exercise_type),
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
    """Update an existing session with final rep counts, average score, and feedback logs.

    Args:
        session_id: The ID of the session to update.
        total_reps: Total completed repetitions.
        avg_form_score: Computed mean form score in range [0.0, 1.0].
        feedback_log: List of feedback strings or events encountered during session.
        db_path: Optional custom path to SQLite database.
    """
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


async def get_sessions(db_path: Optional[Path] = None) -> List[Dict[str, Any]]:
    """Retrieve all recorded exercise sessions ordered by started_at descending.

    Args:
        db_path: Optional custom path to SQLite database.

    Returns:
        list[dict]: List of session dictionaries.
    """
    path = db_path or DB_PATH
    async with aiosqlite.connect(str(path)) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM sessions ORDER BY started_at DESC"
        )
        rows = await cursor.fetchall()
        return [_format_session_row(row) for row in rows]


async def get_session(session_id: int, db_path: Optional[Path] = None) -> Optional[Dict[str, Any]]:
    """Retrieve a single session by its unique ID.

    Args:
        session_id: The session ID to look up.
        db_path: Optional custom path to SQLite database.

    Returns:
        dict or None: The session record if found, else None.
    """
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
