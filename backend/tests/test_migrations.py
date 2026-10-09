"""Bootstrap regressions, isolated from application/conftest import side effects.

Focused run: python -m pytest --noconftest backend/tests/test_migrations.py
All database files and child working directories belong to pytest's tmp_path.
"""
import os
from pathlib import Path
import subprocess
import sys
import textwrap

import pytest


BACKEND_DIR = Path(__file__).resolve().parents[1]


@pytest.fixture(autouse=True)
def setup_db():
    # Override the legacy conftest fixture when collected in the wider suite.
    # These tests own isolated databases, not that fixture's relative test.db.
    yield


def _run(tmp_path, code, *, demo="false", testing="0", url=None):
    env = os.environ.copy()
    env.update({
        "DATABASE_URL": url or f"sqlite:///{(tmp_path / 'bootstrap%.db').as_posix()}",
        "DEMO_MODE": demo,
        "TESTING": testing,
        "ENCRYPTION_KEY": "",
        "SECRET_KEY": "migration-tests-only-secret",
        "REFRESH_SECRET_KEY": "migration-tests-only-refresh-secret",
        "SSL_CERTFILE": "",
        "SSL_KEYFILE": "",
        "PYTHONDONTWRITEBYTECODE": "1",
    })
    # dotenv 1.0.x has no disable switch. Disable it in this child only so a
    # developer's .env cannot supply database URLs, credentials, or TLS paths.
    bootstrap = (
        "import sys\n"
        f"sys.path.insert(0, {str(BACKEND_DIR)!r})\n"
        "import dotenv\n"
        "dotenv.load_dotenv = lambda *args, **kwargs: False\n"
    )
    result = subprocess.run(
        [sys.executable, "-B", "-c", bootstrap + textwrap.dedent(code)],
        cwd=tmp_path, env=env, capture_output=True, text=True, timeout=90,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert not (tmp_path / "cybercrime_intel.db").exists()
    return result


MIGRATE = f"""
        from alembic import command
        from alembic.config import Config
        config = Config({str(BACKEND_DIR / 'alembic.ini')!r})
"""


def test_empty_database_upgrade_has_complete_schema(tmp_path):
    _run(tmp_path, MIGRATE + """
        from sqlalchemy import inspect, text, Table, Column, Integer
        from database import engine, Base, DATABASE_URL
        import models_db

        assert inspect(engine).get_table_names() == []
        expected_tables = dict(Base.metadata.tables)
        # Autogeneration metadata must not be used to execute the baseline.
        Table('not_part_of_frozen_baseline', Base.metadata, Column('id', Integer, primary_key=True))
        command.upgrade(config, 'head')
        inspector = inspect(engine)
        assert set(inspector.get_table_names()) == set(expected_tables) | {'alembic_version'}
        for name, table in expected_tables.items():
            actual = {column['name']: column for column in inspector.get_columns(name)}
            assert set(actual) == set(table.columns.keys()), name
            for column in table.columns:
                assert actual[column.name]['nullable'] == column.nullable, (name, column.name)
            assert set(inspector.get_pk_constraint(name)['constrained_columns']) == {
                column.name for column in table.primary_key.columns
            }, name
            actual_fks = {
                (tuple(fk['constrained_columns']), fk['referred_table'], tuple(fk['referred_columns']))
                for fk in inspector.get_foreign_keys(name)
            }
            expected_fks = {
                ((fk.parent.name,), fk.column.table.name, (fk.column.name,))
                for fk in table.foreign_keys
            }
            assert actual_fks == expected_fks, name
            indexes = {index['name'] for index in inspector.get_indexes(name)}
            assert {index.name for index in table.indexes} <= indexes, name
        assert config.get_main_option('sqlalchemy.url') == DATABASE_URL
        with engine.connect() as conn:
            assert conn.execute(text('SELECT version_num FROM alembic_version')).scalar_one() == '0004_review_records'
        command.upgrade(config, 'head')
        engine.dispose()
    """)


@pytest.mark.parametrize("demo,testing", [("false", "0"), ("true", "0"), ("false", "1")])
def test_configured_sqlite_path_is_shared_by_app_and_alembic(tmp_path, demo, testing):
    _run(tmp_path, MIGRATE + """
        from sqlalchemy import inspect
        from database import DATABASE_URL, engine, USE_SQLITE
        import os
        assert USE_SQLITE
        assert DATABASE_URL == os.environ['DATABASE_URL']
        assert engine.url.database == 'configured%.db'
        command.upgrade(config, 'head')
        assert config.get_main_option('sqlalchemy.url') == DATABASE_URL
        assert 'transaction_records' in inspect(engine).get_table_names()
        engine.dispose()
    """, demo=demo, testing=testing, url="sqlite+pysqlite:///configured%.db")
    assert (tmp_path / "configured%.db").is_file()


@pytest.mark.parametrize("existing", ["legacy", "current", "versioned"])
def test_existing_schema_upgrade_preserves_data(tmp_path, existing):
    _run(tmp_path, MIGRATE + f"""
        from sqlalchemy import text, inspect
        from database import engine, Base
        import models_db

        existing = {existing!r}
        if existing == 'current':
            Base.metadata.create_all(engine)
        else:
            command.upgrade(config, '0000_baseline')
            if existing == 'legacy':
                # Simulate the unversioned pre-hardening schema.
                with engine.begin() as conn:
                    conn.execute(text('DELETE FROM alembic_version'))
            else:
                command.upgrade(config, '0001_production_hardening')
        with engine.begin() as conn:
            conn.execute(text("INSERT INTO cases (case_id, crime_type, amount) VALUES ('keep-me', 'Fraud', 123)"))
            if existing == 'current':
                conn.execute(text('DROP INDEX ix_predictions_model_version'))
        command.upgrade(config, 'head')
        inspector = inspect(engine)
        assert {{'assigned_to', 'department'}} <= {{c['name'] for c in inspector.get_columns('cases')}}
        assert 'ix_predictions_model_version' in {{i['name'] for i in inspector.get_indexes('predictions')}}
        with engine.connect() as conn:
            assert conn.execute(text("SELECT amount FROM cases WHERE case_id = 'keep-me'")).scalar_one() == 123
            assert conn.execute(text('SELECT version_num FROM alembic_version')).scalar_one() == '0004_review_records'
        engine.dispose()
    """)


def test_demo_setup_only_is_repeatable(tmp_path):
    code = """
        import random
        from sqlalchemy import text
        import start
        from database import engine

        state = random.getstate()
        start.main(['--setup-only'])
        assert random.getstate() == state
        with engine.connect() as conn:
            counts = {name: conn.execute(text('SELECT COUNT(*) FROM ' + name)).scalar_one()
                      for name in ('cases', 'predictions', 'ranked_locations', 'users')}
        assert all(counts.values()), counts
        start.main(['--setup-only'])
        with engine.connect() as conn:
            for name, count in counts.items():
                assert conn.execute(text('SELECT COUNT(*) FROM ' + name)).scalar_one() == count
            assert conn.execute(text('SELECT version_num FROM alembic_version')).scalar_one() == '0004_review_records'
        engine.dispose()
    """
    _run(tmp_path, code, demo="true")


@pytest.mark.parametrize("tls", ["unset", "paired", "partial"])
def test_startup_respects_optional_tls(tmp_path, tls):
    _run(tmp_path, f"""
        import os
        import sys
        import types
        from sqlalchemy import inspect
        import start
        from database import engine

        tls = {tls!r}
        if tls != 'unset':
            os.environ['SSL_CERTFILE'] = ' local-cert.pem '
        if tls == 'paired':
            os.environ['SSL_KEYFILE'] = ' local-key.pem '
        calls = []
        sys.modules['uvicorn'] = types.SimpleNamespace(run=lambda *args, **kwargs: calls.append((args, kwargs)))
        if tls == 'partial':
            try:
                start.main([])
            except SystemExit as exc:
                assert exc.code == 2
            else:
                raise AssertionError('Incomplete TLS configuration accepted')
            assert calls == []
            assert inspect(engine).get_table_names() == []
        else:
            start.main([])
            assert len(calls) == 1
            args, kwargs = calls[0]
            assert args == ('main:app',)
            assert kwargs['reload'] is False
            if tls == 'paired':
                assert kwargs['ssl_certfile'] == 'local-cert.pem'
                assert kwargs['ssl_keyfile'] == 'local-key.pem'
            else:
                assert 'ssl_certfile' not in kwargs and 'ssl_keyfile' not in kwargs
        engine.dispose()
    """)
