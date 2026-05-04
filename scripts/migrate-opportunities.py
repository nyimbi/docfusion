#!/usr/bin/env python3
"""
Migrate opportunities data from Azure PostgreSQL to self-hosted database.

Usage:
    python scripts/migrate-opportunities.py

Environment variables:
    SOURCE_DB_URL: Source database URL (Azure)
    TARGET_DB_URL: Target database URL (self-hosted)
"""

import asyncio
import asyncpg
import os
from datetime import datetime

# Database URLs
SOURCE_URL = os.environ.get('SOURCE_DB_URL')
TARGET_URL = os.environ.get('TARGET_DB_URL')

if not SOURCE_URL or not TARGET_URL:
    raise SystemExit("SOURCE_DB_URL and TARGET_DB_URL are required")


async def migrate_opportunities():
    """Migrate opportunities from source to target database."""
    print("=" * 70)
    print("RFP Opportunities Migration")
    print("=" * 70)
    print(f"\nSource: {SOURCE_URL.split('@')[1].split('/')[0]}")
    print(f"Target: {TARGET_URL.split('@')[1].split('/')[0]}")

    # Connect to both databases
    print("\nConnecting to databases...")
    source = await asyncpg.connect(SOURCE_URL)
    target = await asyncpg.connect(TARGET_URL)
    print("✓ Connected to both databases")

    # Get source count
    source_count = await source.fetchval('SELECT COUNT(*) FROM opportunities')
    print(f"\nSource opportunities: {source_count:,}")

    # Get target count
    try:
        target_count = await target.fetchval('SELECT COUNT(*) FROM opportunities')
        print(f"Target opportunities: {target_count:,}")
    except Exception as e:
        if 'does not exist' in str(e):
            print("Target table does not exist. Will create...")
            target_count = 0
        else:
            raise

    if target_count >= source_count:
        print("\n✓ Target already has equal or more data. Migration not needed.")
        await source.close()
        await target.close()
        return

    # Get column definitions
    cols = await source.fetch('''
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'opportunities'
        ORDER BY ordinal_position
    ''')
    col_names = [c['column_name'] for c in cols]
    print(f"\nColumns to migrate: {len(col_names)}")

    # Check if target table exists and has same structure
    target_cols = await target.fetch('''
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'opportunities'
        ORDER BY ordinal_position
    ''')
    target_col_names = [c['column_name'] for c in target_cols]

    if len(target_col_names) == 0:
        print("Target table doesn't exist. Creating...")
        # Create table structure
        create_sql = '''
        CREATE TABLE opportunities (
            id UUID PRIMARY KEY,
            source_id VARCHAR(255),
            title VARCHAR(1000),
            category VARCHAR(255),
            it_category VARCHAR(255),
            sector VARCHAR(255),
            country_region VARCHAR(255),
            organization VARCHAR(500),
            funder VARCHAR(255),
            deadline TIMESTAMPTZ,
            days_left INTEGER,
            is_expired BOOLEAN DEFAULT FALSE,
            budget_value VARCHAR(255),
            budget_numeric REAL,
            budget_currency VARCHAR(10),
            project_summary TEXT,
            project_scope TEXT,
            key_requirements TEXT,
            technical_requirements TEXT,
            submission_method VARCHAR(100),
            submission_requirements TEXT,
            rfp_link TEXT,
            source_platform VARCHAR(255),
            source_file VARCHAR(500),
            opportunity_type VARCHAR(100),
            priority_rank INTEGER,
            fit_score REAL,
            win_probability REAL,
            revenue_potential VARCHAR(255),
            strategic_notes TEXT,
            decision_status VARCHAR(100),
            decision_reason TEXT,
            assigned_to VARCHAR(255),
            is_reviewed BOOLEAN DEFAULT FALSE,
            tags JSONB DEFAULT '{}',
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            imported_at TIMESTAMPTZ,
            notes TEXT,
            source VARCHAR(255),
            fingerprint VARCHAR(64),
            notice_id VARCHAR(255),
            portal_url TEXT,
            document_url TEXT,
            scraped_at TIMESTAMPTZ,
            published_date TIMESTAMPTZ,
            documents_discovered BOOLEAN DEFAULT FALSE,
            documents_discovered_at TIMESTAMPTZ,
            documents_downloaded_count INTEGER DEFAULT 0,
            last_document_scan_at TIMESTAMPTZ
        );

        CREATE INDEX idx_opportunities_deadline ON opportunities(deadline);
        CREATE INDEX idx_opportunities_source ON opportunities(source);
        CREATE INDEX idx_opportunities_country ON opportunities(country_region);
        CREATE INDEX idx_opportunities_created ON opportunities(created_at);
        '''
        await target.execute(create_sql)
        print("✓ Created opportunities table")

    # Export data from source
    print(f"\nExporting {source_count:,} rows from source...")
    rows = await source.fetch('SELECT * FROM opportunities ORDER BY created_at')
    print(f"✓ Exported {len(rows):,} rows")

    # Import to target
    print(f"\nImporting to target database...")

    col_list = ', '.join(f'"{c}"' for c in col_names)
    placeholders = ', '.join(f'${i+1}' for i in range(len(col_names)))
    insert_sql = f'INSERT INTO opportunities ({col_list}) VALUES ({placeholders}) ON CONFLICT (id) DO UPDATE SET updated_at = NOW()'

    inserted = 0
    updated = 0
    errors = 0

    for i, row in enumerate(rows):
        try:
            values = [row[c] for c in col_names]
            result = await target.execute(insert_sql, *values)
            if 'INSERT' in result:
                inserted += 1
            else:
                updated += 1
        except Exception as e:
            errors += 1
            if errors <= 5:
                print(f"  Error on row {i}: {str(e)[:100]}")

        if (i + 1) % 100 == 0:
            print(f"  Processed {i+1:,}/{len(rows):,} rows...")

    # Verify
    final_count = await target.fetchval('SELECT COUNT(*) FROM opportunities')

    print(f"\n{'='*70}")
    print("Migration Complete!")
    print(f"{'='*70}")
    print(f"  Source rows: {source_count:,}")
    print(f"  Inserted: {inserted:,}")
    print(f"  Updated: {updated:,}")
    print(f"  Errors: {errors:,}")
    print(f"  Final target count: {final_count:,}")

    await source.close()
    await target.close()

    return final_count


async def migrate_scraper_sources():
    """Migrate scraper sources configuration."""
    print("\n" + "=" * 70)
    print("Migrating Scraper Sources...")
    print("=" * 70)

    source = await asyncpg.connect(SOURCE_URL)
    target = await asyncpg.connect(TARGET_URL)

    # Check source count
    source_count = await source.fetchval('SELECT COUNT(*) FROM scraper_sources')
    print(f"Source scraper_sources: {source_count:,}")

    # Check target
    try:
        target_count = await target.fetchval('SELECT COUNT(*) FROM scraper_sources')
        print(f"Target scraper_sources: {target_count:,}")
    except:
        target_count = 0

    if target_count >= source_count:
        print("✓ Scraper sources already migrated")
        await source.close()
        await target.close()
        return

    # Export
    rows = await source.fetch('SELECT * FROM scraper_sources')
    print(f"Exporting {len(rows):,} scraper sources...")

    # Get columns
    cols = await source.fetch('''
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'scraper_sources' ORDER BY ordinal_position
    ''')
    col_names = [c['column_name'] for c in cols]

    # Insert
    col_list = ', '.join(f'"{c}"' for c in col_names)
    placeholders = ', '.join(f'${i+1}' for i in range(len(col_names)))
    insert_sql = f'INSERT INTO scraper_sources ({col_list}) VALUES ({placeholders}) ON CONFLICT (source_id) DO NOTHING'

    inserted = 0
    for row in rows:
        try:
            values = [row[c] for c in col_names]
            await target.execute(insert_sql, *values)
            inserted += 1
        except Exception as e:
            pass

    print(f"✓ Inserted {inserted:,} scraper sources")

    await source.close()
    await target.close()


if __name__ == '__main__':
    print(f"\nMigration started at {datetime.now().isoformat()}")

    asyncio.run(migrate_opportunities())
    asyncio.run(migrate_scraper_sources())

    print(f"\nMigration completed at {datetime.now().isoformat()}")
