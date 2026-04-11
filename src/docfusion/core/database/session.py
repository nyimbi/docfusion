	session_manager = await get_database_session()
	
	# Basic sync session usage
	with session_manager.sync_session() as session:
		with session_manager.sync_session() as session:
			from sqlalchemy import text
			result = session.execute(text("SELECT current_database()"))
	# Basic async session usage

		# Basic async session usage
		async with session_manager.async_session() as session:
			from sqlalchemy import text
			result = await session.execute(text("SELECT current_user"))
			logging.info(f"Current user: {result.scalar()}")
	# Transaction usage

		# Transaction usage
		async with session_manager.async_transaction() as session:
			# Multiple operations in single transaction
			await session.execute(text("SELECT 1"))
			await session.execute(text("SELECT 2"))
	# Health check
	health = await session_manager.health_check()
	logging.info(f"Database health: {health}")


if __name__ == "__main__":
	asyncio.run(example_database_usage())