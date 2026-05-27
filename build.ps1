Write-Host "Installing frontend dependencies..."
cd frontend

npm install

Write-Host "Building frontend..."
npm run build

cd ..

Write-Host "Moving build to backend..."

Remove-Item -Recurse -Force backend\build -ErrorAction Ignore
New-Item -ItemType Directory -Path backend\build | Out-Null

Copy-Item -Recurse -Force frontend\dist\* backend\build\

Write-Host "Build completed successfully!"