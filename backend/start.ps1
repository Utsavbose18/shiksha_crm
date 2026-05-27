# Write-Host "Running migrations..."
# alembic upgrade head

Write-Host "Seeding database..."
python seed.py

Write-Host "Starting server..."
uvicorn app.main:app --port 8000 --reload --reload-dir app