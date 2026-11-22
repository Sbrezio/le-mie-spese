# Prova del ponte Google Apps Script.
# Chiede l'indirizzo dell'App web e la chiave segreta (che NON vengono salvate da nessuna parte),
# poi controlla che il ponte risponda, che rifiuti una chiave sbagliata e che non crei doppioni.
# Il movimento di prova viene cancellato alla fine.

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ErrorActionPreference = 'Stop'

$url = (Read-Host 'Incolla l''indirizzo dell''App web (finisce con /exec)').Trim()
$sec = Read-Host 'Incolla la chiave segreta (non si vede mentre la incolli)' -AsSecureString
$key = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)).Trim()

function Chiama($chiave, $azione, $dati) {
  $corpo = @{ key = $chiave; action = $azione; data = $dati } | ConvertTo-Json -Depth 5 -Compress
  $byte = [Text.Encoding]::UTF8.GetBytes($corpo)
  Invoke-RestMethod -Uri $url -Method Post -Body $byte -ContentType 'text/plain;charset=utf-8'
}

$errori = 0
function Esito($ok, $testo) {
  if ($ok) { Write-Host "  OK   $testo" -ForegroundColor Green }
  else { Write-Host "  NO   $testo" -ForegroundColor Red; $script:errori++ }
}

Write-Host ''
Write-Host '1. Il ponte risponde'
$r = Invoke-RestMethod -Uri $url -Method Get
Esito ($r.ok -eq $true) 'Indirizzo raggiungibile'

Write-Host '2. Chiave sbagliata rifiutata'
$r = Chiama 'chiave-sbagliata' 'tutto' @{}
Esito ($r.ok -eq $false) "Risposta: $($r.errore)"

Write-Host '3. Lettura dei dati con la chiave giusta'
$r = Chiama $key 'tutto' @{}
Esito ($r.ok -eq $true) "Categorie: $(@($r.categorie).Count), conti: $(@($r.conti).Count), movimenti: $(@($r.movimenti).Count)"
if (-not $r.ok) { Write-Host "  Errore: $($r.errore)"; exit 1 }

Write-Host '4. Doppio invio della stessa spesa'
$id = 'prova-' + [guid]::NewGuid().ToString()
$mov = @{ id = $id; data = (Get-Date -Format 'yyyy-MM-dd'); descrizione = 'Prova collegamento'; categoria = 'noconta'; importo = 1; origine = 'app' }
$a = Chiama $key 'aggiungiMovimento' $mov
$b = Chiama $key 'aggiungiMovimento' $mov
$r = Chiama $key 'tutto' @{}
$quanti = @($r.movimenti | Where-Object { $_.id -eq $id }).Count
Esito ($a.ok -and $b.ok -and $b.duplicato -and $quanti -eq 1) "Movimenti di prova nel foglio: $quanti (deve essere 1)"

Write-Host '5. Importo non valido rifiutato'
$r = Chiama $key 'aggiungiMovimento' @{ id = 'prova-x'; data = '2026-01-01'; descrizione = 'x'; importo = 0 }
Esito ($r.ok -eq $false) "Risposta: $($r.errore)"

Write-Host '6. Elenco categorie per il widget'
$r = Chiama $key 'categoriePerWidget' @{}
Esito ($r.ok -and @($r.elenco).Count -gt 0) "Categorie nell'elenco: $(@($r.elenco).Count)"

Write-Host '7. Cancellazione del movimento di prova'
$r = Chiama $key 'eliminaMovimento' @{ id = $id }
Esito ($r.ok -and $r.eliminato) 'Movimento di prova cancellato'

Write-Host ''
if ($errori -eq 0) { Write-Host 'TUTTO A POSTO: il collegamento funziona.' -ForegroundColor Green }
else { Write-Host "Ci sono $errori problemi: copia questa schermata e mandala a Claude." -ForegroundColor Red }
