# Docker Compose Runner with Automatic Timezone Detection
# This script automatically detects the Windows timezone, maps it to Linux format,
# and runs docker-compose build followed by docker-compose up

# Get the Windows timezone
$windowsTimeZone = (Get-TimeZone).Id
Write-Host "Detected Windows timezone: $windowsTimeZone"

# Map Windows timezone ID to Linux/IANA timezone format
$linuxTimeZone = switch -Wildcard ($windowsTimeZone) {
    # North America
    "Pacific Standard Time" { "America/Los_Angeles" }
    "Mountain Standard Time" { "America/Denver"  }
    "Central Standard Time" { "America/Chicago" }
    "Eastern Standard Time" { "America/New_York" }
    "Atlantic Standard Time" { "America/Halifax" }
    "Alaskan Standard Time" { "America/Anchorage" }
    "Hawaiian Standard Time" { "Pacific/Honolulu" }

    # Europe
    "GMT Standard Time" { "Europe/London" }
    "Greenwich Standard Time" { "Europe/London" }
    "W. Europe Standard Time" { "Europe/Berlin" }
    "Romance Standard Time" { "Europe/Paris" }
    "Central Europe Standard Time" { "Europe/Budapest" }
    "Central European Standard Time" { "Europe/Warsaw" }
    "E. Europe Standard Time" { "Europe/Bucharest" }
    "FLE Standard Time" { "Europe/Kiev" }
    "GTB Standard Time" { "Europe/Athens" }
    "Russian Standard Time" { "Europe/Moscow" }
    "W. Central Africa Standard Time" { "Africa/Lagos" }

    # Asia
    "China Standard Time" { "Asia/Shanghai" }
    "Tokyo Standard Time" { "Asia/Tokyo" }
    "Korea Standard Time" { "Asia/Seoul" }
    "India Standard Time" { "Asia/Kolkata" }
    "Singapore Standard Time" { "Asia/Singapore" }
    "Taipei Standard Time" { "Asia/Taipei" }
    "West Asia Standard Time" { "Asia/Tashkent" }
    "SE Asia Standard Time" { "Asia/Bangkok" }
    "North Asia Standard Time" { "Asia/Krasnoyarsk" }

    # Australia & Pacific
    "AUS Eastern Standard Time" { "Australia/Sydney" }
    "E. Australia Standard Time" { "Australia/Brisbane" }
    "AUS Central Standard Time" { "Australia/Darwin" }
    "Cen. Australia Standard Time" { "Australia/Adelaide" }
    "W. Australia Standard Time" { "Australia/Perth" }
    "New Zealand Standard Time" { "Pacific/Auckland" }
    "Fiji Standard Time" { "Pacific/Fiji" }

    # South America
    "SA Pacific Standard Time" { "America/Bogota" }
    "Central Brazilian Standard Time" { "America/Cuiaba" }
    "Argentina Standard Time" { "America/Buenos_Aires" }
    "SA Eastern Standard Time" { "America/Cayenne" }
    "Brazil Eastern Standard Time" { "America/Sao_Paulo" }

    # Middle East
    "Egypt Standard Time" { "Africa/Cairo" }
    "Israel Standard Time" { "Asia/Jerusalem" }
    "Arabic Standard Time" { "Asia/Baghdad" }
    "Arab Standard Time" { "Asia/Riyadh" }
    "Iran Standard Time" { "Asia/Tehran" }

    # Africa
    "South Africa Standard Time" { "Africa/Johannesburg" }
    "Morocco Standard Time" { "Africa/Casablanca" }

    # Default case
    default { 
        Write-Host "Unknown timezone: $windowsTimeZone - defaulting to UTC" -ForegroundColor Yellow
        "UTC" 
    }
}

Write-Host "Mapped to Linux timezone: $linuxTimeZone" -ForegroundColor Green

# Set environment variable for docker-compose
$env:HOST_TIMEZONE = $linuxTimeZone

# Function to run docker-compose commands
function Run-DockerCompose {
    param (
        [string]$Command
    )
    
    Write-Host "`nRunning: docker-compose $Command" -ForegroundColor Blue
    
    try {
        # Execute the command
        $process = Start-Process -FilePath "docker-compose" -ArgumentList $Command -NoNewWindow -PassThru -Wait
        
        if ($process.ExitCode -ne 0) {
            Write-Host "Command failed with exit code: $($process.ExitCode)" -ForegroundColor Red
            return $false
        }
        else {
            Write-Host "Command completed successfully!" -ForegroundColor Green
            return $true
        }
    }
    catch {
        Write-Host "Error executing docker-compose: $_" -ForegroundColor Red
        return $false
    }
}

# Execute docker-compose build
Write-Host "`nBuilding containers..." -ForegroundColor Cyan
$buildSuccess = Run-DockerCompose "build"

# Execute docker-compose up if build was successful
if ($buildSuccess) {
    Write-Host "`nStarting containers..." -ForegroundColor Cyan
    Run-DockerCompose "up -d"
    
    Write-Host "`nContainers are now running in the background with the correct timezone ($linuxTimeZone)" -ForegroundColor Green
    Write-Host "To view logs: docker-compose logs -f" -ForegroundColor Cyan
    Write-Host "To stop containers: docker-compose down" -ForegroundColor Cyan
}
else {
    Write-Host "`nBuild failed, containers were not started." -ForegroundColor Red
}