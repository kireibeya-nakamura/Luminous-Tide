param(
  [string]$Root = (Get-Location).Path,
  [int]$Port = 8787
)

$ErrorActionPreference = 'Stop'
$rootPath = [System.IO.Path]::GetFullPath($Root)
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
$listener.Start()

$mimeTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.webp' = 'image/webp'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
}

function Send-Response {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode,
    [string]$Reason,
    [byte[]]$Body,
    [string]$ContentType = 'text/plain; charset=utf-8'
  )

  $header = "HTTP/1.1 $StatusCode $Reason`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($Body.Length -gt 0) {
    $Stream.Write($Body, 0, $Body.Length)
  }
}

Write-Host "Serving $rootPath on http://0.0.0.0:$Port/"

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 8192, $true)
    $requestLine = $reader.ReadLine()

    while ($true) {
      $line = $reader.ReadLine()
      if ($null -eq $line -or $line -eq '') { break }
    }

    if ([string]::IsNullOrWhiteSpace($requestLine)) {
      Send-Response $stream 400 'Bad Request' ([System.Text.Encoding]::UTF8.GetBytes('Bad Request'))
      continue
    }

    $parts = $requestLine.Split(' ')
    if ($parts.Length -lt 2 -or ($parts[0] -ne 'GET' -and $parts[0] -ne 'HEAD')) {
      Send-Response $stream 405 'Method Not Allowed' ([System.Text.Encoding]::UTF8.GetBytes('Method Not Allowed'))
      continue
    }

    $requestPath = ($parts[1] -split '\?')[0]
    if ($requestPath -eq '/') { $requestPath = '/index.html' }
    $decodedPath = [System.Uri]::UnescapeDataString($requestPath)
    $relativePath = $decodedPath.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
    $fullPath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($rootPath, $relativePath))

    if (-not $fullPath.StartsWith($rootPath, [System.StringComparison]::OrdinalIgnoreCase)) {
      Send-Response $stream 403 'Forbidden' ([System.Text.Encoding]::UTF8.GetBytes('Forbidden'))
      continue
    }

    if (-not [System.IO.File]::Exists($fullPath)) {
      Send-Response $stream 404 'Not Found' ([System.Text.Encoding]::UTF8.GetBytes('Not Found'))
      continue
    }

    $bytes = [System.IO.File]::ReadAllBytes($fullPath)
    $extension = [System.IO.Path]::GetExtension($fullPath).ToLowerInvariant()
    $contentType = $mimeTypes[$extension]
    if ([string]::IsNullOrEmpty($contentType)) {
      $contentType = 'application/octet-stream'
    }

    if ($parts[0] -eq 'HEAD') {
      $bytes = [byte[]]::new(0)
    }
    Send-Response $stream 200 'OK' $bytes $contentType
  }
  catch {
    try {
      $message = [System.Text.Encoding]::UTF8.GetBytes('Internal Server Error')
      Send-Response $stream 500 'Internal Server Error' $message
    }
    catch {
      # Ignore errors while reporting errors to a closing socket.
    }
  }
  finally {
    $client.Close()
  }
}
