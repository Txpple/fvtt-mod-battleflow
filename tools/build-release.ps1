# Build the release zip for a GitHub release.
#
# ⚠ DO NOT USE Compress-Archive FOR THIS. On Windows PowerShell 5.1 it writes directory
# separators as BACKSLASHES — "scripts\battleflow.js" — which is not what the ZIP spec says and
# not what Node-based extractors do with it: they treat the whole thing as one literal filename
# and drop the file at the archive root, so `esmodules: ["scripts/battleflow.js"]` then points at
# nothing and the module loads as an empty shell. Every release from v1.1.0 to v1.1.15 shipped
# that way. It never bit, because the live box is hot-deployed over WebDAV rather than installed
# from the zip — but a clean install from any of those releases would have.
#
# So the entry names are written explicitly, with forward slashes, through ZipArchive.CreateEntry.
#
# Usage, from the repo root:
#   powershell -ExecutionPolicy Bypass -File tools/build-release.ps1
#
# Then attach BOTH assets — the zip and a bare copy of module.json:
#   gh release create vX.Y.Z --title "vX.Y.Z - short phrase" --notes-file NOTES.md `
#     dist/fvtt-mod-battleflow.zip module.json

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$repo = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content (Join-Path $repo "module.json") -Raw | ConvertFrom-Json
$version = $manifest.version

# Exactly what ships. scripts/ is enumerated (the split, v1.6.1) so a new phase file rides
# along without a tooling change; the read-back below still verifies every entry by name.
#
# The enumeration is RECURSIVE, and that word is load-bearing. It was not until v1.21.0, and
# Phase 2's scripts/decide/ - six pure modules that eleven files import - silently fell out of
# every zip built after 2026-08-22. Nothing caught it: the gate's import check reads the WORKING
# TREE, and the live box is hot-deployed over WebDAV, so no build here has ever been installed
# from its own archive. Exactly how the backslash bug survived fifteen releases.
$scriptRoot = Join-Path $repo "scripts"
$scriptFiles = Get-ChildItem $scriptRoot -Filter "*.js" -Recurse -File | Sort-Object FullName |
  ForEach-Object { "scripts/" + ($_.FullName.Substring($scriptRoot.Length + 1) -replace "\\", "/") }
if ($scriptFiles -notcontains "scripts/battleflow.js") { throw "scripts/battleflow.js (the esmodules entry) is missing" }
$contents = @($scriptFiles) + @(
  "module.json",
  "LICENSE",
  "README.md"
)

$outDir = Join-Path $repo "dist"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
$zip = Join-Path $outDir "fvtt-mod-battleflow.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }

$fs = [System.IO.File]::Open($zip, [System.IO.FileMode]::Create)
$archive = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($name in $contents) {
    $source = Join-Path $repo ($name -replace "/", "\")
    if (-not (Test-Path $source)) { throw "missing release file: $name" }
    [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $archive, $source, $name, [System.IO.Compression.CompressionLevel]::Optimal)
  }
} finally {
  $archive.Dispose()
  $fs.Dispose()
}

# Read it back and prove the separators survived. A silent regression here is invisible until
# someone installs the module for real, which is the worst possible time to find out.
$check = [System.IO.Compression.ZipFile]::OpenRead($zip)
try {
  $names = $check.Entries | ForEach-Object { $_.FullName }
  $bad = $names | Where-Object { $_ -like "*\*" }
  if ($bad) { throw "backslash separators in: $($bad -join ', ') - do not ship this" }
  $missing = $contents | Where-Object { $names -notcontains $_ }
  if ($missing) { throw "missing from archive: $($missing -join ', ')" }

  # And every relative import inside a packed script must resolve to something ALSO in the
  # archive. The list above only proves the zip contains what we asked for; this proves what we
  # asked for is enough to load. It is the check that would have caught the missing decide/
  # directory on the first build after Phase 2 instead of at the next release.
  $entrySet = @{}
  foreach ($n in $names) { $entrySet[$n] = $true }
  $dangling = @()
  foreach ($n in ($names | Where-Object { $_ -like "*.js" })) {
    $dir = $n.Substring(0, $n.LastIndexOf("/"))
    $body = Get-Content (Join-Path $repo ($n -replace "/", "\")) -Raw
    foreach ($m in [regex]::Matches($body, '(?:from|import)\s+"(\.[^"]+)"')) {
      $stack = New-Object System.Collections.ArrayList
      foreach ($part in (($dir + "/" + $m.Groups[1].Value) -split "/")) {
        if ($part -eq "." -or $part -eq "") { continue }
        elseif ($part -eq "..") { if ($stack.Count) { $stack.RemoveAt($stack.Count - 1) } }
        else { [void]$stack.Add($part) }
      }
      $target = $stack -join "/"
      if (-not $entrySet.ContainsKey($target)) { $dangling += "$n -> $target" }
    }
  }
  if ($dangling) { throw "imports that resolve to nothing in the archive: $($dangling -join '; ')" }
  Write-Output "fvtt-mod-battleflow v$version -> $zip"
  $check.Entries | Select-Object FullName, Length | Format-Table -AutoSize | Out-String | Write-Output
  Write-Output ("{0:N0} bytes, {1} entries, forward slashes verified" -f (Get-Item $zip).Length, $names.Count)
} finally {
  $check.Dispose()
}
