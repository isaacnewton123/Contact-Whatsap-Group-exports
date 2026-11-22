$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root "dist"
$icons = Join-Path $dist "icons"
$logo = "c:\Users\Isaac Newton\Documents\Point-AI\logo_noBG.png"

New-Item -ItemType Directory -Force -Path $icons | Out-Null
Copy-Item (Join-Path $root "src\popup.html") $dist -Force
Copy-Item (Join-Path $root "src\popup.css") $dist -Force
Copy-Item (Join-Path $root "src\manifest.json") $dist -Force

function Save-Icon([int]$size, [string]$path) {
  $source = [System.Drawing.Bitmap]::FromFile($logo)
  $target = New-Object System.Drawing.Bitmap $size, $size
  $graphics = [System.Drawing.Graphics]::FromImage($target)
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $destination = New-Object System.Drawing.Rectangle 1, 1, ($size - 2), ($size - 2)
  $crop = New-Object System.Drawing.Rectangle 108, 103, 294, 292
  $graphics.DrawImage($source, $destination, $crop, [System.Drawing.GraphicsUnit]::Pixel)
  $target.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $target.Dispose()
  $source.Dispose()
}

Save-Icon 16 (Join-Path $icons "icon16.png")
Save-Icon 32 (Join-Path $icons "icon32.png")
Save-Icon 48 (Join-Path $icons "icon48.png")
Save-Icon 128 (Join-Path $icons "icon128.png")
Save-Icon 192 (Join-Path $icons "logo.png")
