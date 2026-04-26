# IndieThis Mastering Engine — Replicate Deploy Script
# Run this from PowerShell with Docker Desktop running.
#
# One-time setup:
#   1. Install Docker Desktop: https://www.docker.com/products/docker-desktop/
#   2. Install cog: https://github.com/replicate/cog#install
#   3. Run this script

$ErrorActionPreference = "Stop"

$MODEL_OWNER = "iambluekb"
$MODEL_NAME  = "iambluekb-mastering"

# Get token from env or prompt
if (-not $env:REPLICATE_API_TOKEN) {
    $env:REPLICATE_API_TOKEN = Read-Host "Enter your Replicate API token (from replicate.com/account/api-tokens)"
}

Write-Host "=> Logging in to Replicate..." -ForegroundColor Cyan
cog login --token $env:REPLICATE_API_TOKEN

Write-Host "`n=> Pushing model r8.im/$MODEL_OWNER/$MODEL_NAME ..." -ForegroundColor Cyan
Write-Host "   (This builds a Docker image — first run takes 5-10 min)" -ForegroundColor Gray

cog push "r8.im/$MODEL_OWNER/$MODEL_NAME"

Write-Host "`n=> Done! Copy the version hash above and run:" -ForegroundColor Green
Write-Host "   vercel env add REPLICATE_MASTERING_MODEL_VERSION production" -ForegroundColor Yellow
Write-Host "   (paste the hash, then press Enter twice)" -ForegroundColor Gray
Write-Host "`n=> Also set these in Replicate model environment variables:" -ForegroundColor Cyan
Write-Host "   https://replicate.com/iambluekb/iambluekb-mastering/settings" -ForegroundColor Yellow
Write-Host "   SUPABASE_URL    = https://havnsrtfdeusaggoqfms.supabase.co" -ForegroundColor White
Write-Host "   SUPABASE_SERVICE_KEY = <get from supabase.com/dashboard/project/havnsrtfdeusaggoqfms/settings/api>" -ForegroundColor White
