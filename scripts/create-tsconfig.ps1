param(
    [string]$Package
)

$path = "$Package/tsconfig.json"

$content = @"
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": [
    "src"
  ]
}
"@

Set-Content -Path $path -Value $content

Write-Host "Created $path"