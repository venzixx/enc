$c = Get-Content -LiteralPath 'dashboard/src/app/dashboard/[guildId]/messages/page.tsx'
$c[885] = ''
$c | Set-Content -LiteralPath 'dashboard/src/app/dashboard/[guildId]/messages/page.tsx'
