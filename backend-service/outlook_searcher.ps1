# ====================================================================
# CEISA 4.0 - Dokumen Searcher Outlook MAPI Integration Engine
# outlook_searcher.ps1
# Direct COM Automation with local Outlook (POP/SMTP Compatible)
# ====================================================================

[CmdletBinding()]
param (
    [string]$ParamsJson = "",
    [string]$ParamsFile = ""
)

# Output helper
function Output-JsonResult ($obj) {
    $json = $obj | ConvertTo-Json -Depth 6 -Compress
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    Write-Output $json
    exit 0
}

function Output-JsonError ($msg) {
    $errObj = @{
        success = $false
        error   = $msg
        results = @{}
    }
    Output-JsonResult $errObj
}

try {
    # 1. Parse Input Parameters
    $rawJson = ""
    if (-not [string]::IsNullOrWhiteSpace($ParamsFile) -and (Test-Path -LiteralPath $ParamsFile)) {
        $rawJson = Get-Content -LiteralPath $ParamsFile -Raw -Encoding UTF8
    } elseif (-not [string]::IsNullOrWhiteSpace($ParamsJson)) {
        $rawJson = $ParamsJson
    }

    $params = @{}
    if (-not [string]::IsNullOrWhiteSpace($rawJson)) {
        try {
            $params = $rawJson | ConvertFrom-Json
        } catch {
            Output-JsonError "Format JSON parameter tidak valid: $($_.Exception.Message)"
        }
    }

    $invoiceNo    = if ($params.invoiceNo) { [string]$params.invoiceNo.Trim() } else { "" }
    $invoiceDate  = if ($params.invoiceDate) { [string]$params.invoiceDate.Trim() } else { "" }
    $blAwbNo      = if ($params.blAwbNo) { [string]$params.blAwbNo.Trim() } else { "" }
    $blAwbDate    = if ($params.blAwbDate) { [string]$params.blAwbDate.Trim() } else { "" }
    $pibPebNo     = if ($params.pibPebNo) { [string]$params.pibPebNo.Trim() } else { "" }
    $companyName  = if ($params.companyName) { [string]$params.companyName.Trim() } else { "" }
    $supplierName = if ($params.supplierName) { [string]$params.supplierName.Trim() } else { "" }
    $consigneeName= if ($params.consigneeName) { [string]$params.consigneeName.Trim() } else { "" }
    $vesselVoyage = if ($params.vesselVoyage) { [string]$params.vesselVoyage.Trim() } else { "" }
    $containerNo  = if ($params.containerNo) { [string]$params.containerNo.Trim() } else { "" }
    $customQuery  = if ($params.customQuery) { [string]$params.customQuery.Trim() } else { "" }

    # Setup Attachment Export Directory
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
    $exportDir = Join-Path $scriptDir "temp\outlook_attachments"
    if (-not (Test-Path -LiteralPath $exportDir)) {
        New-Item -ItemType Directory -Path $exportDir -Force | Out-Null
    }

    # 2. Connect to local Outlook via MAPI COM
    try {
        $outlook = New-Object -ComObject Outlook.Application
        $namespace = $outlook.GetNamespace('MAPI')
    } catch {
        Output-JsonError "Tidak dapat membuka Microsoft Outlook: $($_.Exception.Message). Pastikan aplikasi Outlook terpasang di komputer ini."
    }

    $inbox = $namespace.GetDefaultFolder(6) # 6 = olFolderInbox
    if (-not $inbox) {
        Output-JsonError "Folder Inbox Outlook tidak ditemukan."
    }

    # Safe Date Parser
    function Parse-SafeDate ($str) {
        if ([string]::IsNullOrWhiteSpace($str)) { return $null }
        try {
            return [DateTime]::Parse($str)
        } catch {
            return $null
        }
    }

    # Reference date for proximity calculation
    $refDate = $null
    foreach ($dtStr in @($invoiceDate, $blAwbDate)) {
        $parsedDt = Parse-SafeDate $dtStr
        if ($parsedDt) {
            if ($null -eq $refDate -or $parsedDt -gt $refDate) {
                $refDate = $parsedDt
            }
        }
    }

    # Build list of search terms and token variations
    $searchTerms = [System.Collections.Generic.List[string]]::new()
    $companyTokens = [System.Collections.Generic.List[string]]::new()
    $dateTokens = [System.Collections.Generic.List[string]]::new()

    function Add-TermDirect ($t) {
        if ([string]::IsNullOrWhiteSpace($t)) { return }
        $cl = $t.Trim()
        if ($cl.Length -ge 3 -and -not $searchTerms.Contains($cl)) {
            $searchTerms.Add($cl)
        }
    }

    function Add-TermVariations ($term) {
        if ([string]::IsNullOrWhiteSpace($term)) { return }
        $clean = $term.Trim()
        Add-TermDirect $clean

        # Trim leading zeroes (e.g. 00368 -> 368)
        $trimmedZeroes = $clean.TrimStart('0')
        if ($trimmedZeroes.Length -ge 3) {
            Add-TermDirect $trimmedZeroes
        }

        # Variation without dashes/slashes
        $stripped = $clean -replace '[-_/\\]', ' ' -replace '\s+', ' '
        $stripped = $stripped.Trim()
        if ($stripped.Length -ge 3) {
            Add-TermDirect $stripped
        }

        # Sub-tokens split by slash, dash, backslash, pipe (e.g., "BS 03 / 7384-A" -> "7384-A", "7384")
        $subTokens = $clean -split '[\/\\|]'
        if ($subTokens.Length -gt 1) {
            foreach ($st in $subTokens) {
                $stClean = $st.Trim()
                if ($stClean.Length -ge 4) {
                    Add-TermDirect $stClean
                    $stTrimmedZ = $stClean.TrimStart('0')
                    if ($stTrimmedZ.Length -ge 4) {
                        Add-TermDirect $stTrimmedZ
                    }
                }
            }
        }

        # Alphanumeric/core portion if long enough (e.g. "00368X26", "BE002X26")
        $core = $clean -replace '[^\w]', ''
        if ($core.Length -ge 5 -and $core -ne $clean) {
            Add-TermDirect $core
        }
    }

    # 1. Invoice Number variations
    if ($invoiceNo) {
        Add-TermVariations $invoiceNo
        # Sub-variations for invoice prefixes: e.g. "BE002" -> "B002", "002"
        if ($invoiceNo -match '^([A-Za-z]{1,3})0*(\d+)') {
            $prefix = $matches[1]
            $num = $matches[2]
            if ($prefix.ToUpperInvariant() -eq 'BE') {
                Add-TermDirect "B$($num.PadLeft(3, '0'))"
                Add-TermDirect "B$num"
            } elseif ($prefix.ToUpperInvariant() -eq 'B') {
                Add-TermDirect "BE$($num.PadLeft(3, '0'))"
                Add-TermDirect "BE$num"
            }
            if ($num.Length -ge 2) {
                Add-TermDirect $num
            }
        }
        # First segment before slash: e.g. "00368 / X / 26" -> "00368", "368"
        $firstInvSeg = ($invoiceNo -split '[\/\\-]')[0].Trim()
        if ($firstInvSeg.Length -ge 3) {
            Add-TermDirect $firstInvSeg
            Add-TermDirect ($firstInvSeg.TrimStart('0'))
        }
    }

    # 2. B/L / AWB Number variations
    if ($blAwbNo) {
        Add-TermVariations $blAwbNo
        # Specific forwarder booking prefix (e.g. "BTMSIN022953" -> "022953", "22953", "BTMSIN0229")
        if ($blAwbNo -match '(BTMSIN\d{4})') {
            Add-TermDirect $matches[1]
        }
        if ($blAwbNo -match '(SINBTM\d{4})') {
            Add-TermDirect $matches[1]
        }
    }

    # 3. PIB / PEB / Custom Query
    Add-TermVariations $pibPebNo
    Add-TermVariations $customQuery

    # 4. Container Number
    if ($containerNo) {
        Add-TermDirect $containerNo
        $numPart = $containerNo -replace '\D', ''
        if ($numPart.Length -ge 6) {
            Add-TermDirect $numPart
        }
    }

    # 5. Vessel & Voyage
    if ($vesselVoyage) {
        $voyTokens = $vesselVoyage -split '[\/,;]'
        foreach ($vt in $voyTokens) {
            $vtClean = $vt.Trim() -replace '^(KM\.?|LCT\.?|TB\.?|TK\.?)\s*', ''
            if ($vtClean.Length -ge 4) {
                Add-TermDirect $vtClean
            }
        }
        if ($vesselVoyage -match '(\d{3,}[A-Za-z]?)') {
            Add-TermDirect $matches[1]
        }
    }

    # 6. Dates to Filename/Subject Tokens (e.g., 2026-10-01 -> "011026", "01102026", "20261001", "01-10-26")
    foreach ($dtStr in @($invoiceDate, $blAwbDate)) {
        $pDt = Parse-SafeDate $dtStr
        if ($pDt) {
            $d1 = $pDt.ToString("ddMMyy")
            $d2 = $pDt.ToString("ddMMyyyy")
            $d3 = $pDt.ToString("yyyyMMdd")
            $d4 = $pDt.ToString("dd-MM-yy")
            $d5 = $pDt.ToString("dd.MM.yy")
            $d6 = $pDt.ToString("ddMMM").ToUpperInvariant()
            foreach ($df in @($d1, $d2, $d3, $d4, $d5, $d6)) {
                if (-not $dateTokens.Contains($df)) { $dateTokens.Add($df) }
                Add-TermDirect $df
            }
        }
    }

    # 7. CRITICAL: Company & Partner Name Tokens (ALWAYS SEARCHED)
    # Freight forwarders routinely title email subjects by company name (e.g. "BL Sanjaya Abadi", "FW: CIPL EXPORT HENG GUAN - ...")
    $stopWords = @(
        'PT', 'CV', 'LTD', 'PTE', 'CORP', 'CO', 'INC', 'TBK', 'THE', 'AND', 'DAN',
        'INDONESIA', 'SINGAPORE', 'BATAM', 'JAKARTA', 'SURABAYA', 'KEPULAUAN', 'RIAU',
        'SHIPPING', 'LOGISTICS', 'FREIGHT', 'FORWARDING', 'EXPRESS', 'TECHNOLOGIES',
        'INTERNATIONAL', 'GLOBAL', 'ASIA', 'LOT', 'KAWASAN', 'INDUSTRI', 'PARK',
        'SEKUPANG', 'BATU', 'AMPAR', 'FIRST', 'CITY', 'KOMPLEK', 'BLOK', 'TELUK', 'TERING',
        'KOTA', 'INDUSTRIAL', 'CREATIVE', 'FOOD', 'INDUSTRIES', 'HOLDINGS'
    )

    function Extract-CompanyTokens ($name) {
        if ([string]::IsNullOrWhiteSpace($name)) { return }
        # Remove punctuation, split into words
        $words = $name -split '[^a-zA-Z0-9]+'
        $validWords = [System.Collections.Generic.List[string]]::new()
        foreach ($w in $words) {
            $wClean = $w.Trim()
            if ($wClean.Length -ge 4 -and $stopWords -notcontains $wClean.ToUpperInvariant()) {
                $validWords.Add($wClean)
                if (-not $companyTokens.Contains($wClean)) {
                    $companyTokens.Add($wClean)
                }
            }
        }
        # Multi-word company phrase (e.g., "SANJAYA ABADI", "HENG GUAN")
        if ($validWords.Count -ge 2) {
            $phrase = "$($validWords[0]) $($validWords[1])"
            if (-not $companyTokens.Contains($phrase)) {
                $companyTokens.Add($phrase)
            }
            # Add composite phrase to search terms to avoid scanning hundreds of emails with generic sub-words
            Add-TermDirect $phrase
        } elseif ($validWords.Count -eq 1) {
            Add-TermDirect $validWords[0]
        }
    }

    Extract-CompanyTokens $companyName
    Extract-CompanyTokens $supplierName
    Extract-CompanyTokens $consigneeName

    # If no specific term provided, return error
    if ($searchTerms.Count -eq 0) {
        Output-JsonError "Tidak ada kata kunci pencarian yang valid (Invoice, B/L, atau PIB/PEB kosong)."
    }

    # Helper: Check if attachment is a real customs document (PDF, Excel, Word) and not a signature icon
    function Is-ValidDocAttachment ($att) {
        $name = [string]$att.FileName
        $ext = [System.IO.Path]::GetExtension($name).ToLowerInvariant()
        $validExts = @('.pdf', '.xlsx', '.xls', '.docx', '.doc', '.tif', '.tiff')
        if ($validExts -notcontains $ext) { return $false }
        # Filter out junk signature files
        if ($name -match '^(image00|icon_|logo|signature|header|footer|cid:)' -and $att.Size -lt 35000) {
            return $false
        }
        return $true
    }

    # Helper: Classify document type from filename with Invoice/BL context
    function Get-DocTypeCategory ($name, $invNo, $blNo, $mailSubject) {
        $n = $name.ToLowerInvariant()
        $subLower = if ($mailSubject) { $mailSubject.ToLowerInvariant() } else { "" }

        # Filter out customs declarations (PEB/PIB/NPPB/SPPB/Manifest/Draft PEB) so they don't get mixed with commercial documents
        if ($n -match '\b(peb|pib|nppb|sppb|manifest|bc.?1\.1|bc.?2\.0|bc.?3\.0)\b' -or $n -match 'draft.?(peb|pib)') { return 'OTHER' }

        # 1. Check Packing List (including 'pacsg011026.pdf', 'pac', 'pkg', 'pl')
        if ($n -match '\b(pack|pkg|pl|packing|p_list|daftar.?kemasan)\b' -or $n -match '^pac|pacsg|pac_\w+') {
            return 'PACKING_LIST'
        }
        if ($subLower -match 'packing.?list' -and ($n -match '^pac|pl')) { return 'PACKING_LIST' }

        # 2. Check Bill of Lading / AWB
        if ($n -match '\b(bill.?of.?lading|ocean.?bill|air.?waybill|awb|hbl|mbl|swb)\b' -or $n -match '(^|[^a-z])bl([^a-z]|$)') {
            return 'BILL_OF_LADING'
        }
        if ($blNo) {
            $blParts = $blNo -split '[\/\\|]'
            foreach ($bp in $blParts) {
                $bpTrim = $bp.Trim()
                if ($bpTrim.Length -ge 4 -and $bpTrim -ne 'BS 01' -and $name -match [regex]::Escape($bpTrim)) {
                    return 'BILL_OF_LADING'
                }
            }
        }
        # If subject explicitly says "BL ..." and attachment is PDF
        if ($subLower -match '\b(bl|bill.?of.?lading)\b' -and $name -match '\.pdf$' -and $n -notmatch 'inv|faktur|pac|pack') {
            return 'BILL_OF_LADING'
        }

        # 3. Check COO
        if ($n -match '\b(coo|origin|certificate)\b|form.?d|form.?e|form.?ak') { return 'COO' }

        # 4. Check Invoice (including 'invsg011026.pdf', 'inv', 'cipl', 'faktur')
        if ($n -match '\b(inv|faktur|commercial.?invoice|cipl)\b' -or $n -match '^inv|invsg|inv_\w+') {
            return 'INVOICE'
        }
        if ($n -match 'summary' -and ($subLower -match 'cipl|invoice|peb|shipping' -or $invNo)) {
            return 'INVOICE'
        }

        if ($invNo) {
            $invClean = $invNo.Trim()
            $invTrimmedZ = $invClean.TrimStart('0')
            if ($name -match [regex]::Escape($invClean) -or ($invTrimmedZ.Length -ge 4 -and $name -match [regex]::Escape($invTrimmedZ))) { return 'INVOICE' }
            $noSpaceInv = $invClean -replace '\s+', ''
            $noSpaceName = $name -replace '\s+', ''
            if ($noSpaceName -match [regex]::Escape($noSpaceInv)) { return 'INVOICE' }
            $numOnly = $invClean -replace '\D+', ''
            if ($numOnly.Length -ge 4 -and $name -match [regex]::Escape($numOnly)) { return 'INVOICE' }
        }

        # If email subject explicitly mentions Invoice/CIPL for this shipment and attachment is PDF:
        if ($subLower -match 'cipl|invoice|faktur' -and $name -match '\.pdf$' -and $n -notmatch 'bl|bill|manifest') {
            return 'INVOICE'
        }

        return 'OTHER'
    }

    # Collect matched emails (deduplicated by EntryID)
    $matchedEmails = @{}
    $searchedFolders = @($inbox)

    # Also search Sent Items if available
    try {
        $sentFolder = $namespace.GetDefaultFolder(5) # 5 = olFolderSentMail
        if ($sentFolder) { $searchedFolders += $sentFolder }
    } catch {}

    # STRATEGY 1: Windows Search (WDS) Index - Instant Attachment & Parent Subject Discovery
    try {
        $conn = New-Object -ComObject ADODB.Connection
        $conn.Open("Provider=Search.CollatorDSO;Extended Properties='Application=Windows';")
        $rs = New-Object -ComObject ADODB.Recordset
        
        $wdsTerms = [System.Collections.Generic.List[string]]::new()
        foreach ($st in $searchTerms) {
            if ($st.Length -ge 5 -or ($st -match '\d' -and $st.Length -ge 4 -and $st -ne 'BS 01')) {
                if (-not $wdsTerms.Contains($st)) {
                    $wdsTerms.Add($st)
                }
            }
        }

        foreach ($wTerm in $wdsTerms) {
            $safeWTerm = $wTerm -replace "'", "''"
            $sql = "SELECT System.ItemName, System.Subject FROM SystemIndex WHERE CONTAINS('$safeWTerm') OR System.ItemName LIKE '%$safeWTerm%'"
            try {
                $rs.Open($sql, $conn)
                while (-not $rs.EOF) {
                    $itemName = [string]$rs.Fields.Item('System.ItemName').Value
                    $fullSub = [string]$rs.Fields.Item('System.Subject').Value
                    
                    $parentSub = ""
                    $prefix = "$itemName ("
                    if ($fullSub.StartsWith($prefix) -and $fullSub.EndsWith(")")) {
                        $parentSub = $fullSub.Substring($prefix.Length, $fullSub.Length - $prefix.Length - 1).Trim()
                    } elseif ($fullSub.Contains("(") -and $fullSub.EndsWith(")")) {
                        $lastClose = $fullSub.LastIndexOf(")")
                        $firstOpen = $fullSub.IndexOf("(")
                        if ($firstOpen -ge 0 -and $lastClose -gt $firstOpen) {
                            $parentSub = $fullSub.Substring($firstOpen + 1, $lastClose - $firstOpen - 1).Trim()
                        }
                    } else {
                        $parentSub = $fullSub.Trim()
                    }

                    if (-not [string]::IsNullOrWhiteSpace($parentSub)) {
                        $cleanParentSub = $parentSub -replace '^(RE:\s*|FW:\s*|FWD:\s*)+', ''
                        $cleanParentSub = $cleanParentSub.Trim()

                        $queryTokens = [System.Collections.Generic.List[string]]::new()
                        if ($cleanParentSub -match '(BTH[A-Z0-9]+|SO#?\d+|194GA\w+|BK\s*\d+|GMNA-\w+|S\d{7,}|EBKG\d+|JF\s*:\s*[A-Z0-9]+|BTMSIN\d+|SINBTM\d+)') {
                            $queryTokens.Add($matches[1])
                        }
                        if ($cleanParentSub.Length -ge 8 -and $cleanParentSub -notmatch '^SHIPPING DOC(UMENT)?S') {
                            $pToken = $cleanParentSub.Substring(0, [Math]::Min(35, $cleanParentSub.Length)).Trim()
                            if (-not $queryTokens.Contains($pToken)) {
                                $queryTokens.Add($pToken)
                            }
                        }

                        foreach ($qToken in $queryTokens) {
                            $safeTerm = $qToken -replace "'", "''"
                            try {
                                $fItems = $inbox.Items.Restrict("@SQL=""urn:schemas:httpmail:subject"" LIKE '%$safeTerm%'")
                                foreach ($it in $fItems) {
                                    $eId = $it.EntryID
                                    if ($eId -and -not $matchedEmails.ContainsKey($eId)) {
                                        $matchedEmails[$eId] = @{
                                            Item = $it
                                            MatchedTerm = "WDS:$wTerm -> $qToken"
                                        }
                                    }
                                }
                            } catch {}
                        }
                    }
                    $rs.MoveNext()
                }
                $rs.Close()
            } catch {}
        }
        $conn.Close()
    } catch {}

    # STRATEGY 2: Outlook DASL Subject Matching (using searchTerms including Company Names)
    foreach ($folder in $searchedFolders) {
        foreach ($term in $searchTerms) {
            if ($term.Length -lt 4 -or $term -eq 'BS 01') { continue }
            $safeTerm = $term -replace "'", "''"
            $dasl = "@SQL=""urn:schemas:httpmail:subject"" LIKE '%$safeTerm%'"
            try {
                $filtered = $folder.Items.Restrict($dasl)
                foreach ($item in $filtered) {
                    $entryId = $item.EntryID
                    if (-not [string]::IsNullOrEmpty($entryId) -and -not $matchedEmails.ContainsKey($entryId)) {
                        $matchedEmails[$entryId] = @{
                            Item = $item
                            MatchedTerm = "Subject:$term"
                        }
                    }
                }
            } catch {}
        }
    }

    # STRATEGY 2B: Conversation Thread Expansion
    $threadTokensToExpand = [System.Collections.Generic.List[string]]::new()
    foreach ($entry in @($matchedEmails.Values)) {
        $mail = $entry.Item
        $topic = $mail.ConversationTopic
        if (-not [string]::IsNullOrWhiteSpace($topic)) {
            $cleanTopic = $topic -replace '^(RE:\s*|FW:\s*|FWD:\s*)+', ''
            $cleanTopic = $cleanTopic.Trim()
            if ($cleanTopic.Length -ge 8 -and $cleanTopic -notmatch '^SHIPPING DOC(UMENT)?S') {
                $prefixTopic = $cleanTopic.Substring(0, [Math]::Min(35, $cleanTopic.Length)).Trim()
                if (-not $threadTokensToExpand.Contains($prefixTopic) -and $threadTokensToExpand.Count -lt 6) {
                    $threadTokensToExpand.Add($prefixTopic)
                }
            }
        }
    }

    foreach ($tToken in $threadTokensToExpand) {
        $safeTToken = $tToken -replace "'", "''"
        try {
            $fItems = $inbox.Items.Restrict("@SQL=""urn:schemas:httpmail:subject"" LIKE '%$safeTToken%'")
            foreach ($it in $fItems) {
                $eId = $it.EntryID
                if ($eId -and -not $matchedEmails.ContainsKey($eId)) {
                    $matchedEmails[$eId] = @{
                        Item = $it
                        MatchedTerm = "Thread:$tToken"
                    }
                }
            }
        } catch {}
    }

    # STRATEGY 3: Deep Attachment Scan (Fallback if few emails matched)
    if ($matchedEmails.Count -lt 2 -and ($invoiceNo -or $blAwbNo -or $companyName)) {
        try {
            $hasAttFilter = "@SQL=""urn:schemas:httpmail:hasattachment"" = true"
            $recentItems = $inbox.Items.Restrict($hasAttFilter)
            $recentItems.Sort("[ReceivedTime]", $true)
            $inspectCount = [Math]::Min(1200, $recentItems.Count)
            for ($idx = 1; $idx -le $inspectCount; $idx++) {
                $item = $recentItems.Item($idx)
                if ($item.Attachments -and $item.Attachments.Count -gt 0) {
                    $entryId = $item.EntryID
                    if (-not $matchedEmails.ContainsKey($entryId)) {
                        $attFound = $false
                        foreach ($att in $item.Attachments) {
                            $fName = $att.FileName
                            if ($invoiceNo -and $fName -match [regex]::Escape($invoiceNo)) { $attFound = $true; break }
                            if ($blAwbNo -and $fName -match [regex]::Escape($blAwbNo)) { $attFound = $true; break }
                            foreach ($dt in $dateTokens) {
                                if ($fName -match [regex]::Escape($dt)) { $attFound = $true; break }
                            }
                        }
                        if ($attFound) {
                            $matchedEmails[$entryId] = @{
                                Item = $item
                                MatchedTerm = 'AttachmentFilename'
                            }
                        }
                    }
                }
            }
        } catch {}
    }

    # Prepare document category results
    $categories = @{
        'INVOICE'        = [System.Collections.Generic.List[hashtable]]::new()
        'PACKING_LIST'   = [System.Collections.Generic.List[hashtable]]::new()
        'BILL_OF_LADING' = [System.Collections.Generic.List[hashtable]]::new()
        'COO'            = [System.Collections.Generic.List[hashtable]]::new()
        'OTHER'          = [System.Collections.Generic.List[hashtable]]::new()
    }

    $allFoundDocs = [System.Collections.Generic.List[hashtable]]::new()

    # Process all matched emails and export valid attachments
    foreach ($entry in $matchedEmails.Values) {
        $mail = $entry.Item
        $senderName = $mail.SenderName
        $senderEmail = $mail.SenderEmailAddress
        $subject = $mail.Subject
        $receivedTime = ""
        $mailDt = $null
        try {
            $mailDt = $mail.ReceivedTime
            $receivedTime = $mailDt.ToString("yyyy-MM-dd HH:mm:ss")
        } catch {}
        $entryId = $mail.EntryID

        # Proximity score to reference date
        $isDateProximate = $false
        if ($refDate -and $mailDt) {
            $daysDiff = [Math]::Abs(($mailDt - $refDate).TotalDays)
            if ($daysDiff -le 7) { $isDateProximate = $true }
        }

        # Check if subject or sender matches company
        $emailMatchesCompany = $false
        foreach ($ct in $companyTokens) {
            if ($subject -match [regex]::Escape($ct) -or $senderName -match [regex]::Escape($ct)) {
                $emailMatchesCompany = $true; break
            }
        }

        if ($mail.Attachments -and $mail.Attachments.Count -gt 0) {
            # Check if this email also contains the target B/L and detect multi-shipment order
            $hasTargetBL = $false
            $blAttList = [System.Collections.Generic.List[string]]::new()
            foreach ($chkAtt in $mail.Attachments) {
                $chkName = $chkAtt.FileName
                if (Is-ValidDocAttachment $chkAtt) {
                    $chkCat = Get-DocTypeCategory $chkName "" "" $subject
                    if ($chkCat -eq 'BILL_OF_LADING' -or $chkName -match '(?i)\bbl\b') {
                        if (-not $blAttList.Contains($chkName)) {
                            $blAttList.Add($chkName)
                        }
                    }
                }
                if ($blAwbNo) {
                    $blParts = $blAwbNo -split '[\/\\|]'
                    foreach ($bp in $blParts) {
                        $bpTrim = $bp.Trim()
                        if ($bpTrim.Length -ge 4 -and $bpTrim -ne 'BS 01' -and $chkName -match [regex]::Escape($bpTrim)) {
                            $hasTargetBL = $true; break
                        }
                    }
                    if ($chkName -match [regex]::Escape($blAwbNo.Trim())) { $hasTargetBL = $true; break }
                }
            }
            $blAttList.Sort()

            $targetBLIndex = 0
            if ($blAwbNo -and $blAttList.Count -gt 0) {
                $blClean = $blAwbNo.Trim()
                for ($bi = 0; $bi -lt $blAttList.Count; $bi++) {
                    $bName = $blAttList[$bi]
                    if ($bName -match [regex]::Escape($blClean)) {
                        $targetBLIndex = $bi + 1
                        break
                    }
                    $blParts = $blClean -split '[\/\\|]'
                    foreach ($bp in $blParts) {
                        $bpTrim = $bp.Trim()
                        if ($bpTrim.Length -ge 4 -and $bpTrim -ne 'BS 01' -and $bName -match [regex]::Escape($bpTrim)) {
                            $targetBLIndex = $bi + 1
                            break
                        }
                    }
                    if ($targetBLIndex -gt 0) { break }
                }
            }

            foreach ($att in $mail.Attachments) {
                if (Is-ValidDocAttachment $att) {
                    $rawFileName = $att.FileName
                    $cleanBase = [System.IO.Path]::GetFileNameWithoutExtension($rawFileName) -replace '[^\w\.\-\s]', '_'
                    $ext = [System.IO.Path]::GetExtension($rawFileName)
                    $uniqueFileName = "$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())_$cleanBase$ext"
                    $savePath = Join-Path $exportDir $uniqueFileName

                    # Save attachment to disk
                    try {
                        $att.SaveAsFile($savePath)
                    } catch {
                        continue
                    }

                    $fileSize = 0
                    if (Test-Path -LiteralPath $savePath) {
                        $fileSize = (Get-Item -LiteralPath $savePath).Length
                    }

                    $docCategory = Get-DocTypeCategory $rawFileName $invoiceNo $blAwbNo $subject
                    
                    # Calculate match confidence score
                    $confidence = 70
                    $matchReason = "Ditemukan di email '$subject'"

                    # 1. Invoice Number checks
                    if ($invoiceNo) {
                        $invClean = $invoiceNo.Trim()
                        $invTrimmedZ = $invClean.TrimStart('0')
                        $noSpaceInv = $invClean -replace '\s+', ''
                        $noSpaceName = $rawFileName -replace '\s+', ''
                        $numOnly = $invClean -replace '\D+', ''

                        if ($rawFileName -match [regex]::Escape($invClean) -or $noSpaceName -match [regex]::Escape($noSpaceInv)) {
                            if ($docCategory -eq 'INVOICE') { 
                                $confidence = 100 
                                $matchReason = "Nomor Invoice persis cocok ($invoiceNo)" 
                            } elseif ($docCategory -eq 'PACKING_LIST') { 
                                $confidence = 96 
                                $matchReason = "Packing List untuk Invoice ($invoiceNo)" 
                            }
                        } elseif ($invTrimmedZ.Length -ge 4 -and $rawFileName -match [regex]::Escape($invTrimmedZ)) {
                            if ($docCategory -eq 'INVOICE') { 
                                $confidence = 98 
                                $matchReason = "Nomor Invoice cocok ($invTrimmedZ)" 
                            } elseif ($docCategory -eq 'PACKING_LIST') { 
                                $confidence = 94 
                                $matchReason = "Packing List untuk Invoice ($invTrimmedZ)" 
                            }
                        } elseif ($numOnly.Length -ge 4 -and $rawFileName -match [regex]::Escape($numOnly)) {
                            if ($docCategory -eq 'INVOICE') { 
                                $confidence = 94 
                                $matchReason = "Nomor numerik Invoice cocok ($numOnly)" 
                            } elseif ($docCategory -eq 'PACKING_LIST') { 
                                $confidence = 92 
                                $matchReason = "Packing List numerik ($numOnly)" 
                            }
                        }
                    }

                    # 2. Date token match in filename (e.g. invsg011026.pdf, pacsg011026.pdf)
                    $matchedDateToken = ""
                    foreach ($dt in $dateTokens) {
                        if ($rawFileName -match [regex]::Escape($dt)) {
                            $matchedDateToken = $dt
                            break
                        }
                    }

                    if ($matchedDateToken) {
                        if ($docCategory -eq 'INVOICE') {
                            $confidence = [Math]::Max($confidence, 98)
                            $matchReason = "Invoice tanggal dokumen cocok ($matchedDateToken)"
                        } elseif ($docCategory -eq 'PACKING_LIST') {
                            $confidence = [Math]::Max($confidence, 98)
                            $matchReason = "Packing List tanggal pengapalan cocok ($matchedDateToken)"
                        }
                    }

                    # 3. B/L checks
                    if ($blAwbNo) {
                        $blClean = $blAwbNo.Trim()
                        $blParts = $blClean -split '[\/\\|]'
                        $primaryPart = ""
                        foreach ($bp in $blParts) {
                            $bpTrim = $bp.Trim()
                            if ($bpTrim.Length -ge 4 -and $bpTrim -ne 'BS 01') { $primaryPart = $bpTrim }
                        }

                        if ($rawFileName -match [regex]::Escape($blClean)) {
                            if ($docCategory -eq 'BILL_OF_LADING') { 
                                $confidence = 100 
                                $matchReason = "Nomor B/L persis cocok pada nama berkas ($blAwbNo)" 
                            }
                        } elseif ($primaryPart -and $rawFileName -match [regex]::Escape($primaryPart)) {
                            if ($docCategory -eq 'BILL_OF_LADING') { 
                                $confidence = 99 
                                $matchReason = "Nomor B/L cocok pada nama berkas ($primaryPart)" 
                            }
                        } elseif ($subject -match [regex]::Escape($blClean)) {
                            if ($docCategory -eq 'BILL_OF_LADING') { 
                                $confidence = [Math]::Max($confidence, 88) 
                                $matchReason = "Ditemukan di email bersubjek B/L $blAwbNo" 
                            }
                        }
                    }

                    # 4. Company + Date Proximity boost
                    if ($emailMatchesCompany) {
                        if ($isDateProximate) {
                            $confidence = [Math]::Max($confidence, 95)
                            if ($docCategory -eq 'BILL_OF_LADING' -and $matchReason -notmatch 'cocok') {
                                $matchReason = "Bill of Lading pengapalan $companyName (Periode Sesuai)"
                            } elseif ($docCategory -eq 'INVOICE' -and $matchReason -notmatch 'cocok') {
                                $matchReason = "Invoice pengapalan $companyName (Periode Sesuai)"
                            } elseif ($docCategory -eq 'PACKING_LIST' -and $matchReason -notmatch 'cocok') {
                                $matchReason = "Packing List pengapalan $companyName (Periode Sesuai)"
                            }
                        } else {
                            $confidence = [Math]::Max($confidence, 85)
                        }
                    }

                    # 5. Combined CIPL and BL in same email
                    if ($hasTargetBL -and ($rawFileName -match 'summary|cipl' -or $docCategory -eq 'INVOICE')) {
                        $confidence = [Math]::Max($confidence, 98)
                        $matchReason = "CIPL/Summary Invoice terlampir bersama B/L ($blAwbNo)"
                    }

                    # 6. Multi-shipment Index Correlation (e.g. INVSG181026-1 vs INVSG181026-2)
                    if ($targetBLIndex -gt 0 -and $blAttList.Count -gt 1) {
                        if ($rawFileName -match '[-_](\d+)\.[a-zA-Z0-9]+$') {
                            $fileIdx = [int]$matches[1]
                            if ($fileIdx -eq $targetBLIndex) {
                                if ($docCategory -eq 'INVOICE' -or $docCategory -eq 'PACKING_LIST') {
                                    $confidence = 100
                                    $matchReason = "Korelasi Pengapalan: Indeks berkas (#$fileIdx) persis cocok dengan urutan B/L $blAwbNo (Pengapalan #$targetBLIndex)"
                                }
                            } else {
                                if ($docCategory -eq 'INVOICE' -or $docCategory -eq 'PACKING_LIST') {
                                    $confidence = 72
                                    $matchReason = "Pengapalan lain (#$fileIdx) dalam email multi-pengapalan"
                                }
                            }
                        }
                    }

                    # 7. Container number match in filename
                    if ($containerNo) {
                        $contClean = $containerNo.Trim() -replace '\s+', ''
                        $rawNoSpace = $rawFileName -replace '\s+', ''
                        if ($contClean.Length -ge 6 -and $rawNoSpace -match [regex]::Escape($contClean)) {
                            $confidence = 100
                            $matchReason = "Nomor Peti Kemas persis cocok ($containerNo)"
                        }
                    }

                    $docObj = @{
                        category       = $docCategory
                        fileName       = $rawFileName
                        savedFileName  = $uniqueFileName
                        fileSize       = $fileSize
                        fileSizeFormatted = "$([Math]::Round($fileSize / 1024, 1)) KB"
                        downloadUrl    = "/api/doc-searcher/attachments/$uniqueFileName"
                        confidence     = $confidence
                        matchReason    = $matchReason
                        email = @{
                            entryId      = $entryId
                            senderName   = $senderName
                            senderEmail  = $senderEmail
                            subject      = $subject
                            receivedTime = $receivedTime
                        }
                    }

                    $categories[$docCategory].Add($docObj)
                    $allFoundDocs.Add($docObj)
                }
            }
        }
    }

    # Cross-Category Intelligence:
    # 1. If PACKING_LIST is empty, but INVOICE has CIPL or high confidence, copy invoice to PACKING_LIST
    if ($categories['PACKING_LIST'].Count -eq 0 -and $categories['INVOICE'].Count -gt 0) {
        $topInv = @($categories['INVOICE'] | Sort-Object -Property { [int]$_['confidence'] }, { [int]$_['fileSize'] } -Descending)[0]
        if ($topInv.fileName -match 'summary|cipl' -or [int]$topInv.confidence -ge 95) {
            $plDoc = @{}
            foreach ($k in $topInv.Keys) { $plDoc[$k] = $topInv[$k] }
            $plDoc.category = 'PACKING_LIST'
            $plDoc.confidence = [Math]::Max(94, [int]$topInv.confidence - 2)
            $plDoc.matchReason = "CIPL / Summary gabungan Invoice & Packing List (Nomor $invoiceNo)"
            $categories['PACKING_LIST'].Add($plDoc)
        }
    }

    # 2. Multi-page Shipping Document (like Budi Jasa SB22935-4.pdf for Sanjaya):
    # If BILL_OF_LADING was found with confidence >= 95%, but INVOICE and/or PACKING_LIST are empty:
    # In maritime freight forwarding, the carrier/agent often attaches the shipper's CIPL together with the B/L in a single PDF.
    if ($categories['BILL_OF_LADING'].Count -gt 0) {
        $topBL = @($categories['BILL_OF_LADING'] | Sort-Object -Property { [int]$_['confidence'] }, { [int]$_['fileSize'] } -Descending)[0]
        if ([int]$topBL.confidence -ge 95 -and [int]$topBL.fileSize -gt 50000) {
            if ($categories['INVOICE'].Count -eq 0) {
                $invFromBL = @{}
                foreach ($k in $topBL.Keys) { $invFromBL[$k] = $topBL[$k] }
                $invFromBL.category = 'INVOICE'
                $invFromBL.confidence = 95
                $invFromBL.matchReason = "Dokumen Pengapalan Terpadu (Invoice & B/L terlampir bersama dari agen perkapalan)"
                $categories['INVOICE'].Add($invFromBL)
            }
            if ($categories['PACKING_LIST'].Count -eq 0) {
                $plFromBL = @{}
                foreach ($k in $topBL.Keys) { $plFromBL[$k] = $topBL[$k] }
                $plFromBL.category = 'PACKING_LIST'
                $plFromBL.confidence = 95
                $plFromBL.matchReason = "Dokumen Pengapalan Terpadu (Packing List & B/L terlampir bersama dari agen perkapalan)"
                $categories['PACKING_LIST'].Add($plFromBL)
            }
        }
    }

    # Compute status for each target document category
    function Get-StatusForCategory ($list, $targetNumber) {
        if ($list.Count -eq 0) {
            return @{
                status = "NOT_FOUND"
                statusBadge = "Not Found"
                statusIcon = "red"
                count = 0
                selected = $null
                candidates = @()
            }
        } elseif ($list.Count -eq 1) {
            return @{
                status = "FOUND"
                statusBadge = "Found"
                statusIcon = "green"
                count = 1
                selected = $list[0]
                candidates = $list
            }
        } else {
            $sorted = @($list | Sort-Object -Property { [int]$_['confidence'] }, { [int]$_['fileSize'] } -Descending)
            $topCandidate = $sorted[0]
            $status = if ([int]$topCandidate['confidence'] -ge 95) { "FOUND" } else { "MULTIPLE_FOUND" }
            return @{
                status = $status
                statusBadge = if ($status -eq "FOUND") { "Found" } else { "Multiple Found" }
                statusIcon = if ($status -eq "FOUND") { "green" } else { "yellow" }
                count = $list.Count
                selected = $topCandidate
                candidates = $sorted
            }
        }
    }

    $summaryResults = @{
        'INVOICE'        = Get-StatusForCategory $categories['INVOICE'] $invoiceNo
        'PACKING_LIST'   = Get-StatusForCategory $categories['PACKING_LIST'] $invoiceNo
        'BILL_OF_LADING' = Get-StatusForCategory $categories['BILL_OF_LADING'] $blAwbNo
        'COO'            = Get-StatusForCategory $categories['COO'] ""
        'OTHER'          = Get-StatusForCategory $categories['OTHER'] ""
    }

    $finalPayload = @{
        success       = $true
        mailbox       = $inbox.Name
        totalEmailsMatched = $matchedEmails.Count
        totalDocsFound = $allFoundDocs.Count
        searchTerms   = $searchTerms
        summary       = $summaryResults
        allDocuments  = $allFoundDocs
    }

    Output-JsonResult $finalPayload

} catch {
    Output-JsonError "Error saat menjalankan pencarian Outlook: $($_.Exception.Message)"
}
