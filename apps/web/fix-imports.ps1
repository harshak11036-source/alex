$files = @(
"src\app\api\assessments\[id]\route.ts",
"src\app\api\assessments\[id]\results\route.ts",
"src\app\api\ai\credentials\[id]\route.ts",
"src\app\api\subjects\[id]\resources\route.ts",
"src\app\api\notifications\[id]\read\route.ts",
"src\app\api\flashcards\[id]\review\route.ts",
"src\app\api\documents\local\[...path]\route.ts",
"src\app\api\documents\[id]\download\route.ts",
"src\app\api\flashcards\decks\[id]\route.ts",
"src\app\api\documents\[id]\retry\route.ts",
"src\app\api\documents\[id]\route.ts",
"src\app\api\assignments\[id]\submissions\route.ts"
)

$base = "C:\Users\harsh\Downloads\Project_1 (2)\Project_1\alex\apps\web"
foreach ($f in $files) {
  $full = Join-Path $base $f
  if (Test-Path -LiteralPath $full) {
    $content = Get-Content -LiteralPath $full
    if ($content -match "@/lib/prisma'") {
      $content -replace "@/lib/prisma'", "@/lib/prisma-edge'" | Out-File -FilePath $full -Encoding UTF8
      Write-Host "Updated: $f"
    }
  } else {
    Write-Host "Not found: $f"
  }
}