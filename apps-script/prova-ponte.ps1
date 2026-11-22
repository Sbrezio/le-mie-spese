# Prova del ponte Google Apps Script.
# Chiede l'indirizzo dell'App web e la chiave segreta (che NON vengono salvate da nessuna parte),
# poi controlla che il ponte risponda, che rifiuti una chiave sbagliata, che non crei doppioni
# e che le spese ricorrenti vengano inserite una volta sola. I movimenti di prova vengono cancellati alla fine.
# ATTENZIONE: il punto 7 inserisce davvero le spese ricorrenti previste fino a oggi (come farebbe l'attivatore del mattino).

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ErrorActionPreference = 'Stop'
Start-Sleep -Seconds 3

$url = (Read-Host 'Incolla l''indirizzo dell''App web (finisce con /exec)').Trim()
$sec = Read-Host 'Incolla la chiave segreta (non si vede mentre la incolli)' -AsSecureString
$key = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)).Trim()

function Chiama($chiave, $azione, $dati) {
  $corpo = ConvertTo-Json -InputObject @{ key = $chiave; action = $azione; data = $dati } -Depth 6 -Compress
  $byte = [Text.Encoding]::UTF8.GetBytes($corpo)
  Invoke-RestMethod -Uri $url -Method Post -Body $byte -ContentType 'text/plain;charset=utf-8'
}
function Movimento($id, $importo) {
  @{ id = $id; data = (Get-Date -Format 'yyyy-MM-dd'); descrizione = 'Prova collegamento'; categoria = 'noconta'; importo = $importo; origine = 'app' }
}
function Quanti($id) { $r = Chiama $key 'tutto' @{}; @($r.movimenti | Where-Object { $_.id -eq $id }) }

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
$r = Chiama 'chiave-sbagliata' 'aggiungiMovimento' (Movimento 'prova-intruso' 1)
Esito ($r.ok -eq $false -and @(Quanti 'prova-intruso').Count -eq 0) 'Con la chiave sbagliata non si scrive nulla'

Write-Host '3. Lettura dei dati con la chiave giusta'
$r = Chiama $key 'tutto' @{}
Esito ($r.ok -eq $true) "Categorie: $(@($r.categorie).Count), conti: $(@($r.conti).Count), movimenti: $(@($r.movimenti).Count)"
if (-not $r.ok) { Write-Host "  Errore: $($r.errore)"; exit 1 }

Write-Host '4. Widget: doppio invio della stessa spesa'
$id1 = 'prova-' + [guid]::NewGuid().ToString()
$a = Chiama $key 'aggiungiMovimento' (Movimento $id1 1)
$b = Chiama $key 'aggiungiMovimento' (Movimento $id1 1)
$n = @(Quanti $id1).Count
Esito ($a.ok -and $b.ok -and $b.duplicato -and $n -eq 1) "Movimenti di prova nel foglio: $n (deve essere 1)"

Write-Host '5. App: invio a gruppi e reinvio dalla coda offline'
$id2 = 'prova-' + [guid]::NewGuid().ToString()
$gruppo = @{ aggiungi = @((Movimento $id2 2), (Movimento $id2 2)); modifica = @(); elimina = @() }
$a = Chiama $key 'salvaModifiche' $gruppo
$b = Chiama $key 'salvaModifiche' $gruppo
$n = @(Quanti $id2).Count
Esito ($a.ok -and $b.ok -and $n -eq 1) "Stessa spesa mandata 4 volte: nel foglio $n (deve essere 1)"
$m = Movimento $id2 3.5; $m.descrizione = 'Prova modifica'
$c = Chiama $key 'salvaModifiche' @{ aggiungi = @(); modifica = @($m); elimina = @() }
$q = @(Quanti $id2)
Esito ($c.ok -and $q.Count -eq 1 -and [double]$q[0].importo -eq 3.5 -and $q[0].descrizione -eq 'Prova modifica') 'Modifica arrivata (importo 3,50 e descrizione nuova)'

Write-Host '6. Importo non valido rifiutato'
$r = Chiama $key 'aggiungiMovimento' @{ id = 'prova-x'; data = '2026-01-01'; descrizione = 'x'; importo = 0 }
Esito ($r.ok -eq $false) "Risposta: $($r.errore)"

Write-Host '7. Spese ricorrenti arretrate inserite una volta sola'
$p = Chiama $key 'inserisciRicorrenti' @{}
$s = Chiama $key 'inserisciRicorrenti' @{}
$tutto = Chiama $key 'tutto' @{}
$ric = @($tutto.movimenti | Where-Object { $_.ricorrente_id })
$doppie = @($ric | Group-Object { $_.ricorrente_id + '|' + $_.data.Substring(0, 7) } | Where-Object { $_.Count -gt 1 })
Esito ($p.ok -and $s.ok -and $s.inserite -eq 0) "Prima chiamata: $($p.inserite) inserite, seconda: $($s.inserite) (deve essere 0)"
Esito ($doppie.Count -eq 0) "Spese ricorrenti nel foglio: $($ric.Count), doppie: $($doppie.Count) (deve essere 0)"
$ric | Sort-Object data | ForEach-Object { Write-Host "       $($_.data)  $($_.descrizione)  $($_.importo)" }

Write-Host '8. Elenco categorie per il widget'
$r = Chiama $key 'categoriePerWidget' @{}
Esito ($r.ok -and @($r.categorie).Count -gt 0) "Categorie nell'elenco: $(@($r.categorie).Count)"

Write-Host '9. Cancellazione dei movimenti di prova'
$r1 = Chiama $key 'eliminaMovimento' @{ id = $id1 }
$r2 = Chiama $key 'salvaModifiche' @{ aggiungi = @(); modifica = @(); elimina = @($id2) }
Esito ($r1.eliminato -and $r2.eliminati -eq 1 -and @(Quanti $id1).Count -eq 0 -and @(Quanti $id2).Count -eq 0) 'Movimenti di prova cancellati'

Write-Host ''
if ($errori -eq 0) { Write-Host 'TUTTO A POSTO: il ponte funziona.' -ForegroundColor Green }
else { Write-Host "Ci sono $errori problemi: dillo a Claude." -ForegroundColor Red }
