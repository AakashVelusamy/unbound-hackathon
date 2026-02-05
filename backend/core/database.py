"""PostgreSQL connection pool. All queries go through stored functions in db/schema.sql."""
import logging
from contextlib import contextmanager

import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor

from core.config import settings

logger = logging.getLogger(__name__)

_connection_pool: pool.ThreadedConnectionPool | None = None


def _get_pool():
    global _connection_pool
    if _connection_pool is None:
        _connection_pool = pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=10,
            dsn=settings.database_url,
        )
    return _connection_pool


def get_connection():
    """Yield a connection from the pool. Caller must close or use as context manager."""
    return _get_pool().getconn()


def return_connection(conn):
    """Return connection to the pool."""
    _get_pool().putconn(conn)


@contextmanager
def cursor():
    """Context manager: get connection, get dict cursor, yield it, then close and return connection."""
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        return_connection(conn)


def get_db():
    """FastAPI dependency: yield a connection; commit on success, rollback on error."""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        return_connection(conn)


def init_db():
    """Verify DB connectivity. Schema must be applied separately (run db/schema.sql)."""
    try:
        with cursor() as cur:
            cur.execute("SELECT 1")
    except Exception as e:
        logger.warning("Database not ready: %s", e)
