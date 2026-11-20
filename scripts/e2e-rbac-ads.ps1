# Authenticated E2E for RBAC CRUD + ad playback (10s) + schedule + eligibility.
# Requires: API on :8080, DAMA_ALLOW_E2E_AUTH=1
$ErrorActionPreference = "Stop"
$base = "http://127.0.0.1:8080/api/v1"

function Invoke-Json($Method, $Path, $Body, $Token) {
  $headers = @{ "Content-Type" = "application/json" }
  if ($Token) { $headers["Authorization"] = "Bearer $Token" }
  $params = @{
    Uri = "$base$Path"
    Method = $Method
    Headers = $headers
    UseBasicParsing = $true
  }
  if ($null -ne $Body) {
    $params.Body = ($Body | ConvertTo-Json -Depth 8 -Compress)
  }
  $res = Invoke-WebRequest @params
  return ($res.Content | ConvertFrom-Json)
}

Write-Host "== health =="
$hz = Invoke-WebRequest "http://127.0.0.1:8080/healthz" -UseBasicParsing
if ($hz.Content -notmatch "ok") { throw "healthz failed" }

Write-Host "== mint superadmin =="
$auth = Invoke-Json POST "/auth/e2e/session" @{
  username = "e2e_superadmin"
  email = "e2e_superadmin@example.com"
  role = "superadmin"
} $null
$token = $auth.access_token
if (-not $token) { throw "no access_token (is DAMA_ALLOW_E2E_AUTH=1?)" }

Write-Host "== normalize platform non_skippable to seed default 10 =="
$cab0 = Invoke-Json GET "/console/ads/playback" $null $token
$pb0seed = $cab0.playback
Invoke-Json PUT "/console/ads/playback" @{
  non_skippable_seconds = 10
  first_show_after_game_seconds = [int]$pb0seed.first_show_after_game_seconds
  default_interval_seconds = [int]$pb0seed.default_interval_seconds
} $token | Out-Null

Write-Host "== playback public (non_skippable must be 10) =="
$pb = Invoke-Json GET "/ads/playback" $null $null
if ([int]$pb.non_skippable_seconds -ne 10) { throw ("expected non_skippable 10 got " + $pb.non_skippable_seconds) }
if (-not $pb.player_chrome.sponsored_label) { throw "player_chrome missing" }
if (-not $pb.player_chrome.placement_in_match) { throw "placement_in_match missing" }
if (-not $pb.schedule_chrome.publisher_page_title) { throw "publisher_page_title missing" }
if (-not $pb.schedule_chrome.toast_schedule_saved) { throw "toast_schedule_saved missing" }
if (-not $pb.schedule_chrome.ph_title) { throw "publisher form chrome missing" }
if (-not $pb.schedule_chrome.create_action) { throw "create_action missing" }
if (-not $pb.schedule_chrome.publisher_dash_title) { throw "publisher_dash_title missing" }
if (-not $pb.schedule_chrome.publisher_analytics_title) { throw "publisher_analytics_title missing" }
if (-not $pb.schedule_chrome.publisher_invoice_action) { throw "publisher_invoice_action missing" }
if (-not $pb.schedule_chrome.publisher_manage_campaigns_href) { throw "publisher_manage_campaigns_href missing" }
if (-not $pb.schedule_chrome.first_show_label) { throw "first_show_label missing" }
if (-not $pb.schedule_chrome.daily_cap_label) { throw "daily_cap_label missing" }
Write-Host ("non_skippable_seconds=" + $pb.non_skippable_seconds)

Write-Host "== me/permissions =="
$me = Invoke-Json GET "/console/me/permissions" $null $token
$manageKey = [string]$me.chrome.manage_permission_key
if (-not $manageKey) { throw "manage_permission_key missing" }
if ($me.permissions -notcontains $manageKey) { throw "superadmin lacks manage permission from chrome" }
if (-not $me.chrome.page_title) { throw "rbac chrome missing on me/permissions" }
if (-not $me.chrome.toast_catalog_saved) { throw "rbac toast chrome missing" }
if (-not $me.ads_chrome.lacks_permissions) { throw "ads_chrome missing" }
if (-not $me.ads_chrome.runtime_permission_key) { throw "runtime_permission_key missing" }
if (-not $me.ads_chrome.campaigns_permission_key) { throw "campaigns_permission_key missing" }

Write-Host "== rbac forbidden without manage permission (admin role) =="
$adminAuth = Invoke-Json POST "/auth/e2e/session" @{
  username = "e2e_admin_norbac"
  email = "e2e_admin_norbac@example.com"
  role = "admin"
} $null
$adminTok = $adminAuth.access_token
$rbacForbidden = $false
try {
  Invoke-Json GET "/console/rbac" $null $adminTok | Out-Null
} catch { $rbacForbidden = $true }
if (-not $rbacForbidden) { throw "expected admin without rbac.manage to be forbidden on /console/rbac" }

Write-Host "== rbac snapshot + catalog CRUD (roles) =="
$snap = Invoke-Json GET "/console/rbac" $null $token
if (-not $snap.chrome.page_title) { throw "rbac snapshot chrome missing" }
$probeRole = "e2e_role_" + [guid]::NewGuid().ToString("N").Substring(0, 6)
$rolesBefore = @($snap.roles)
$rolesWithProbe = $rolesBefore + $probeRole
Invoke-Json PUT "/console/rbac/catalog" @{
  roles = $rolesWithProbe
  console_roles = @($snap.console_roles)
  publisher_roles = @($snap.publisher_roles)
  default_role = $snap.default_role
} $token | Out-Null
$snap2 = Invoke-Json GET "/console/rbac" $null $token
if ($snap2.roles -notcontains $probeRole) { throw "catalog add role failed" }
Invoke-Json PUT "/console/rbac/catalog" @{
  roles = $rolesBefore
  console_roles = @($snap.console_roles)
  publisher_roles = @($snap.publisher_roles)
  default_role = $snap.default_role
} $token | Out-Null
$snap3 = Invoke-Json GET "/console/rbac" $null $token
if ($snap3.roles -contains $probeRole) { throw "catalog remove role failed" }

Write-Host "== rbac refuse remove role still assigned to users =="
# superadmin token user holds role superadmin; removing it from catalog must fail closed.
$rolesWithoutSuper = @($snap3.roles | Where-Object { $_ -ne "superadmin" })
if ($rolesWithoutSuper.Count -ge 1 -and ($snap3.roles -contains "superadmin")) {
  $denied = $false
  try {
    Invoke-Json PUT "/console/rbac/catalog" @{
      roles = $rolesWithoutSuper
      console_roles = @($snap3.console_roles | Where-Object { $_ -ne "superadmin" })
      publisher_roles = @($snap3.publisher_roles)
      default_role = $snap3.default_role
    } $token | Out-Null
  } catch {
    $denied = $true
  }
  if (-not $denied) { throw "expected catalog remove of in-use superadmin to fail" }
  $snapGuard = Invoke-Json GET "/console/rbac" $null $token
  if ($snapGuard.roles -notcontains "superadmin") { throw "superadmin role was removed despite users" }
}

Write-Host "== rbac upsert + update permission =="
$key = "e2e.probe." + [guid]::NewGuid().ToString("N").Substring(0, 8)
$perm = Invoke-Json PUT "/console/rbac/permissions" @{
  key = $key
  title = "E2E probe"
  description = "temporary"
} $token
if ($perm.key -ne $key) { throw "upsert permission failed" }
$perm2 = Invoke-Json PUT "/console/rbac/permissions" @{
  key = $key
  title = "E2E probe updated"
  description = "temporary-updated"
} $token
if ($perm2.title -ne "E2E probe updated") { throw "update permission failed" }

Write-Host "== rbac refuse delete protected permission =="
$snapProt = Invoke-Json GET "/console/rbac" $null $token
$protected = @($snapProt.chrome.protected_permission_keys)
if ($protected.Count -lt 1) { throw "protected_permission_keys missing" }
$protKey = [string]$protected[0]
$delProtDenied = $false
try {
  Invoke-Json DELETE "/console/rbac/permissions/$protKey" $null $token | Out-Null
} catch { $delProtDenied = $true }
if (-not $delProtDenied) { throw "expected protected permission delete to fail" }
$snapProt2 = Invoke-Json GET "/console/rbac" $null $token
$protKeys2 = @($snapProt2.permissions | ForEach-Object { $_.key })
if ($protKeys2 -notcontains $protKey) { throw "protected permission was deleted" }

Write-Host "== rbac refuse strip protected grant from last role =="
$superGrants = @($snapProt2.role_permissions.superadmin)
if (-not $superGrants) { $superGrants = @() }
$superWithoutProt = @($superGrants | Where-Object { $_ -ne $protKey })
$stripDenied = $false
try {
  Invoke-Json PUT "/console/rbac/roles/superadmin/permissions" @{ permissions = $superWithoutProt } $token | Out-Null
} catch { $stripDenied = $true }
if (-not $stripDenied) { throw "expected strip of last protected grant to fail" }
$snapStrip = Invoke-Json GET "/console/rbac" $null $token
if ($snapStrip.role_permissions.superadmin -notcontains $protKey) { throw "protected grant was stripped from last role" }

Write-Host "== replace grants for admin (add probe) =="
$adminGrants = @($snapStrip.role_permissions.admin)
if (-not $adminGrants) { $adminGrants = @() }
if ($adminGrants -notcontains $key) { $adminGrants += $key }
Invoke-Json PUT "/console/rbac/roles/admin/permissions" @{ permissions = $adminGrants } $token | Out-Null
$snapGrants = Invoke-Json GET "/console/rbac" $null $token
if ($snapGrants.role_permissions.admin -notcontains $key) { throw "grant add failed" }

Write-Host "== delete probe permission =="
Invoke-Json DELETE "/console/rbac/permissions/$key" $null $token | Out-Null
$snapDel = Invoke-Json GET "/console/rbac" $null $token
$permKeys = @($snapDel.permissions | ForEach-Object { $_.key })
if ($permKeys -contains $key) { throw "delete permission failed" }
if ($snapDel.role_permissions.admin -contains $key) { throw "grant not cleaned after delete" }

Write-Host "== console ads playback get + bounds =="
$cab = Invoke-Json GET "/console/ads/playback" $null $token
$pb0 = $cab.playback
if ([int]$pb0.non_skippable_min -lt 1) { throw "bounds min missing" }
if ([int]$pb0.non_skippable_max -le [int]$pb0.non_skippable_min) { throw "bounds max invalid" }
if ([int]$pb0.impression_cap_min -lt 1) { throw "impression_cap_min missing" }
$first = [int]$pb0.first_show_after_game_seconds
$interval = [int]$pb0.default_interval_seconds

Write-Host "== flexible non-skippable: set 15 (admin CRUD) =="
$put15 = Invoke-Json PUT "/console/ads/playback" @{
  non_skippable_seconds = 15
  first_show_after_game_seconds = $first
  default_interval_seconds = $interval
} $token
if ([int]$put15.non_skippable_seconds -ne 15) { throw "put 15 failed" }
$pubPb = Invoke-Json GET "/ads/playback" $null $null
if ([int]$pubPb.non_skippable_seconds -ne 15) { throw "public playback not 15" }
if (-not $pubPb.schedule_chrome.save_campaign_schedule_action) { throw "schedule_chrome missing" }

Write-Host "== mint publisher + create campaign =="
$enums = Invoke-Json GET "/platform/enums" $null $null
$servable = $enums.servable_campaign_status
if (-not $enums.default_creative_type) { throw "default_creative_type missing" }
if (-not $enums.video_creative_type) { throw "video_creative_type missing" }
if (-not $enums.creative_types) { throw "creative_types missing" }
if ($enums.creative_types -notcontains $enums.default_creative_type) { throw "default creative not in list" }
if ($enums.creative_types -notcontains $enums.video_creative_type) { throw "video creative not in list" }

$pub = Invoke-Json POST "/auth/e2e/session" @{
  username = "e2e_publisher"
  email = "e2e_publisher@example.com"
  role = "advertiser"
} $null
$pubToken = $pub.access_token
# Unique ISO country so prior E2E campaigns (often ET) cannot pollute eligibility.
# Nuuk pin required (server rejects country-only geo_targets).
$geoCountry = "GL"
$camp = Invoke-Json POST "/ads/campaigns" @{
  title = "E2E in-match campaign"
  creative_type = $enums.default_creative_type
  creative_url = "https://example.com/e2e-ad.png"
  geo_targets = @(@{ country = $geoCountry; lat = 64.1836; lng = -51.7214 })
} $pubToken
$campId = $camp.id
if (-not $campId) { throw "campaign create failed" }
Invoke-Json PATCH "/ads/campaigns/$campId/status" @{ status = $servable } $pubToken | Out-Null

Write-Host "== in-match impression requires schedule_enabled =="
$pbPlaceEarly = Invoke-Json GET "/ads/playback" $null $null
$placeEarly = [string]$pbPlaceEarly.player_chrome.placement_in_match
$impSchedDenied = $false
try {
  Invoke-Json POST "/ads/campaigns/$campId/impression" @{
    viewer_key = "e2e-viewer-no-sched"
    placement = $placeEarly
  } $null | Out-Null
} catch { $impSchedDenied = $true }
if (-not $impSchedDenied) { throw "expected in-match impression without schedule to fail" }

Write-Host "== first-show gate (before_first_show) =="
Invoke-Json PATCH "/console/ads/campaigns/$campId/schedule" @{
  schedule_enabled = $true
  first_show_after_seconds = 120
  interval_seconds = 60
  non_skippable_seconds = $null
  daily_impression_cap = 100
  weekly_impression_cap = $null
  monthly_impression_cap = $null
  yearly_impression_cap = $null
} $token | Out-Null
$eligEarly = Invoke-Json POST "/ads/in-match/eligibility" @{
  game_elapsed_seconds = 5
  viewer_key = "e2e-viewer-early"
  country = $geoCountry
} $null
if ($eligEarly.show -eq $true) { throw ("expected before_first_show block got " + ($eligEarly | ConvertTo-Json -Compress)) }
if ([string]$eligEarly.reason -ne "before_first_show") { throw ("expected reason before_first_show got " + $eligEarly.reason) }

Write-Host "== interval gate (interval_not_elapsed) =="
Invoke-Json PATCH "/console/ads/campaigns/$campId/schedule" @{
  schedule_enabled = $true
  first_show_after_seconds = 0
  interval_seconds = 300
  non_skippable_seconds = $null
  daily_impression_cap = 100
  weekly_impression_cap = $null
  monthly_impression_cap = $null
  yearly_impression_cap = $null
} $token | Out-Null
$eligInterval = Invoke-Json POST "/ads/in-match/eligibility" @{
  game_elapsed_seconds = 5
  seconds_since_last_ad = 10
  viewer_key = "e2e-viewer-interval"
  country = $geoCountry
} $null
if ($eligInterval.show -eq $true) { throw ("expected interval_not_elapsed block got " + ($eligInterval | ConvertTo-Json -Compress)) }
if ([string]$eligInterval.reason -ne "interval_not_elapsed") { throw ("expected reason interval_not_elapsed got " + $eligInterval.reason) }

Write-Host "== admin enable schedule (platform non-skip 15, no campaign override) =="
Invoke-Json PATCH "/console/ads/campaigns/$campId/schedule" @{
  schedule_enabled = $true
  first_show_after_seconds = 0
  interval_seconds = 60
  non_skippable_seconds = $null
  daily_impression_cap = 100
  weekly_impression_cap = $null
  monthly_impression_cap = $null
  yearly_impression_cap = $null
} $token | Out-Null

Write-Host "== eligibility must use admin-changed 15 =="
$elig = Invoke-Json POST "/ads/in-match/eligibility" @{
  game_elapsed_seconds = 5
  viewer_key = "e2e-viewer-flex"
  country = $geoCountry
} $null
if (-not $elig.show) { throw ("expected show=true got " + ($elig | ConvertTo-Json -Compress)) }
if ([int]$elig.non_skippable_seconds -ne 15) { throw ("expected non_skippable 15 got " + $elig.non_skippable_seconds) }
if ($elig.campaign.id -ne $campId) { throw "wrong campaign" }

Write-Host "== campaign override non-skippable to 12 =="
Invoke-Json PATCH "/console/ads/campaigns/$campId/schedule" @{
  schedule_enabled = $true
  first_show_after_seconds = 0
  interval_seconds = 60
  non_skippable_seconds = 12
  daily_impression_cap = 100
  weekly_impression_cap = $null
  monthly_impression_cap = $null
  yearly_impression_cap = $null
} $token | Out-Null
$elig2 = Invoke-Json POST "/ads/in-match/eligibility" @{
  game_elapsed_seconds = 5
  seconds_since_last_ad = 999
  viewer_key = "e2e-viewer-flex2"
  country = $geoCountry
} $null
if (-not $elig2.show) { throw "expected show after override" }
if ([int]$elig2.non_skippable_seconds -ne 12) { throw ("expected override 12 got " + $elig2.non_skippable_seconds) }
if ($elig2.campaign.id -ne $campId) { throw "wrong campaign on override" }

Write-Host "== restore platform non-skippable to 10 =="
$put10 = Invoke-Json PUT "/console/ads/playback" @{
  non_skippable_seconds = 10
  first_show_after_game_seconds = $first
  default_interval_seconds = $interval
} $token
if ([int]$put10.non_skippable_seconds -ne 10) { throw "restore 10 failed" }

Write-Host "== placement keys from player_chrome (DB) =="
$pbPlace = Invoke-Json GET "/ads/playback" $null $null
$placeInMatch = [string]$pbPlace.player_chrome.placement_in_match
$placeLobby = [string]$pbPlace.player_chrome.placement_lobby
if (-not $placeInMatch -or -not $placeLobby) { throw "placement keys missing from player_chrome" }

Write-Host "== impression in_match (DB placement) =="
Invoke-Json POST "/ads/campaigns/$campId/impression" @{
  viewer_key = "e2e-viewer-flex"
  placement = $placeInMatch
} $null | Out-Null

Write-Host "== daily cap blocks further eligibility =="
# Prior impressions already recorded for this campaign; cap=1 must exhaust it.
Invoke-Json PATCH "/console/ads/campaigns/$campId/schedule" @{
  schedule_enabled = $true
  first_show_after_seconds = 0
  interval_seconds = 60
  non_skippable_seconds = 10
  daily_impression_cap = 1
  weekly_impression_cap = $null
  monthly_impression_cap = $null
  yearly_impression_cap = $null
} $token | Out-Null
$eligCap = Invoke-Json POST "/ads/in-match/eligibility" @{
  game_elapsed_seconds = 5
  seconds_since_last_ad = 999
  viewer_key = "e2e-viewer-cap-elig"
  country = $geoCountry
} $null
if ($eligCap.show -eq $true -and $eligCap.campaign.id -eq $campId) {
  throw "expected daily cap to block this campaign"
}
if ($eligCap.show -eq $true) { throw "expected no other campaign for isolated geo" }
if ([string]$eligCap.reason -ne "period_cap_reached") { throw ("expected reason period_cap_reached got " + $eligCap.reason) }
if ([int]$eligCap.next_check_after_seconds -lt 1) { throw "expected next_check until period reset" }

Write-Host "== weekly cap blocks (same impression counts as weekly=1) =="
Invoke-Json PATCH "/console/ads/campaigns/$campId/schedule" @{
  schedule_enabled = $true
  first_show_after_seconds = 0
  interval_seconds = 60
  non_skippable_seconds = 10
  daily_impression_cap = $null
  weekly_impression_cap = 1
  monthly_impression_cap = $null
  yearly_impression_cap = $null
} $token | Out-Null
$eligWeek = Invoke-Json POST "/ads/in-match/eligibility" @{
  game_elapsed_seconds = 5
  seconds_since_last_ad = 999
  viewer_key = "e2e-viewer-week-cap"
  country = $geoCountry
} $null
if ($eligWeek.show -eq $true) { throw "expected weekly cap to block" }
if ([string]$eligWeek.reason -ne "period_cap_reached") { throw ("expected weekly period_cap_reached got " + $eligWeek.reason) }

Write-Host "== monthly cap blocks (monthly=1) =="
Invoke-Json PATCH "/console/ads/campaigns/$campId/schedule" @{
  schedule_enabled = $true
  first_show_after_seconds = 0
  interval_seconds = 60
  non_skippable_seconds = 10
  daily_impression_cap = $null
  weekly_impression_cap = $null
  monthly_impression_cap = 1
  yearly_impression_cap = $null
} $token | Out-Null
$eligMonth = Invoke-Json POST "/ads/in-match/eligibility" @{
  game_elapsed_seconds = 5
  seconds_since_last_ad = 999
  viewer_key = "e2e-viewer-month-cap"
  country = $geoCountry
} $null
if ($eligMonth.show -eq $true) { throw "expected monthly cap to block" }
if ([string]$eligMonth.reason -ne "period_cap_reached") { throw ("expected monthly period_cap_reached got " + $eligMonth.reason) }

Write-Host "== yearly cap blocks (yearly=1) =="
Invoke-Json PATCH "/console/ads/campaigns/$campId/schedule" @{
  schedule_enabled = $true
  first_show_after_seconds = 0
  interval_seconds = 60
  non_skippable_seconds = 10
  daily_impression_cap = $null
  weekly_impression_cap = $null
  monthly_impression_cap = $null
  yearly_impression_cap = 1
} $token | Out-Null
$eligYear = Invoke-Json POST "/ads/in-match/eligibility" @{
  game_elapsed_seconds = 5
  seconds_since_last_ad = 999
  viewer_key = "e2e-viewer-year-cap"
  country = $geoCountry
} $null
if ($eligYear.show -eq $true) { throw "expected yearly cap to block" }
if ([string]$eligYear.reason -ne "period_cap_reached") { throw ("expected yearly period_cap_reached got " + $eligYear.reason) }

Write-Host "== me/permissions includes ads_chrome =="
$me2 = Invoke-Json GET "/console/me/permissions" $null $token
if (-not $me2.ads_chrome.lacks_permissions) { throw "ads_chrome.lacks_permissions missing" }

Write-Host "E2E OK"
