import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from './supabase';

const handleServerUpload = async (file) => {
  if (!file) return;

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    alert('로그인 정보를 확인할 수 없습니다.');
    throw userError || new Error('로그인 사용자 없음');
  }

  const safeFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const filePath = `${user.id}/${Date.now()}-${safeFileName}`;

  const { error: uploadError } = await supabase.storage
    .from('uploads')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    console.error('업로드 실패:', uploadError);
    alert(`업로드 실패: ${uploadError.message}`);
    throw uploadError;
  }

  const { error: dbError } = await supabase.from('uploaded_files').insert({
    user_id: user.id,
    original_name: file.name,
    storage_path: filePath,
  });

  if (dbError) {
    console.error('DB 저장 실패:', dbError);
    alert(`파일은 업로드됐지만 DB 저장 실패: ${dbError.message}`);
    throw dbError;
  }

  return { user, filePath };
};

const COLORS = {
  bg: '#f8fafc',
  panel: '#ffffff',
  border: '#e2e8f0',
  text: '#0f172a',
  sub: '#64748b',
  blue: '#2563eb',
  yellow: '#f59e0b',
  red: '#dc2626',
  violet: '#7c3aed',
  slate: '#475569',
};

const PART_PATTERNS = {
  '안드로이드 보드': /안드로이드[-_\s]?보드/i,
  '메인보드': /메인[-_\s]?보드/i,
  LCD: /LCD/i,
  충전기: /충전기\s?교체/i,
  '피닉스 케이블': /피닉스[-_\s]?케이블/i,
};

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function isValidChargerReplacement(text) {
  const normalized = normalizeText(text);
  const hasChargerReplace = /충전기\s?교체/i.test(normalized);
  const hasExcludeWord = /교체\s?필요/i.test(normalized);
  return hasChargerReplace && !hasExcludeWord;
}

function normalizeId(value) {
  return normalizeText(value).replace(/[^0-9-]/g, '');
}

function baseId13(value) {
  const id = normalizeId(value);
  return id ? id.slice(0, 13) : '';
}

function normalizeSiteName(value) {
  return normalizeText(value).replace(/\s+/g, '');
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(String(value).replace(/,/g, '').trim());
  return Number.isNaN(num) ? null : num;
}

function parseDateValue(value) {
  if (!value && value !== 0) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  if (typeof value === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const parsed = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const text = String(value).trim();
  if (!text) return null;

  const normalized = text.replace(/\./g, '-').replace(/\//g, '-');
  const d = new Date(normalized);
  if (!Number.isNaN(d.getTime())) return d;

  const m = text.match(/(\d{4})[-.]?(\d{2})[-.]?(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const [, y, mo, da, hh, mm, ss = '00'] = m;
    const parsed = new Date(`${y}-${mo}-${da}T${hh}:${mm}:${ss}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function formatDate(date) {
  if (!date) return '-';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function extractCutoffFromFilename(fileName) {
  const name = fileName || '';
  const matches = name.match(/(20\d{2})(\d{2})(\d{2})|(\d{2})(\d{2})(\d{2})/g);
  if (!matches || matches.length === 0) return null;
  const last = matches[matches.length - 1];

  if (last.length === 8) {
    const y = Number(last.slice(0, 4));
    const m = Number(last.slice(4, 6));
    const d = Number(last.slice(6, 8));
    return new Date(y, m - 1, d, 7, 0, 0);
  }
  if (last.length === 6) {
    const y = 2000 + Number(last.slice(0, 2));
    const m = Number(last.slice(2, 4));
    const d = Number(last.slice(4, 6));
    return new Date(y, m - 1, d, 7, 0, 0);
  }
  return null;
}

function workbookToRows(workbook) {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: '',
  });
}

function findHeaderIndex(headers, candidates) {
  return headers.findIndex((h) => candidates.some((c) => h.includes(c)));
}

function mapRawColumns(headerRow) {
  const headers = headerRow.map((h) => normalizeText(h));
  return {
    chargerId: 2,         // C
    siteName: 5,          // F
    siteStatus: 6,        // G
    collectedAt: 10,      // K
    overAbnormal: 17,     // R
    usageCount: findHeaderIndex(headers, ['누적 사용량', '누적사용량']),
    address: findHeaderIndex(headers, ['주소']),
    detailAddress: findHeaderIndex(headers, ['상세주소']),
    siteId: findHeaderIndex(headers, ['충전소ID', '충전소 Id', '충전소 id', '사이트ID', 'site_id']),
  };
}

function parseRawFile(file, rows) {
  const headerRow = rows[3] || [];
  const dataRows = rows.slice(4);
  const col = mapRawColumns(headerRow);
  const faultCutoff = extractCutoffFromFilename(file.name);

  const parsed = dataRows.map((row, idx) => {
    const chargerId = normalizeId(row[col.chargerId]);
    if (!chargerId) return null;

    const siteName = normalizeText(row[col.siteName]);
    const siteStatus = normalizeText(row[col.siteStatus]);
    const collectedAt = parseDateValue(row[col.collectedAt]);
    const usageCount = col.usageCount >= 0 ? toNumber(row[col.usageCount]) : null;
    const address = col.address >= 0 ? normalizeText(row[col.address]) : '';
    const detailAddress = col.detailAddress >= 0 ? normalizeText(row[col.detailAddress]) : '';
    const siteId = col.siteId >= 0 ? normalizeText(row[col.siteId]) : '';
    const hasCollectedAt = !!collectedAt;

    const isManualOff = normalizeText(siteStatus) === '임의 OFF';
    const isManualOffFault = isManualOff && !!faultCutoff && !!collectedAt && collectedAt < faultCutoff;

    const rawOverAbnormal = normalizeText(row[col.overAbnormal]);
    const isOverAbnormal = rawOverAbnormal !== '' && rawOverAbnormal !== '-' && rawOverAbnormal.toUpperCase() !== 'X';

    const approvalPendingByBlank = !!chargerId && !hasCollectedAt && !isManualOff && !isOverAbnormal;
    const isStopped = !!faultCutoff && hasCollectedAt && collectedAt < faultCutoff;
    const approvalPendingByLowUsage = isStopped && usageCount !== null && usageCount <= 30 && !isManualOff && !isOverAbnormal;
    const isApprovalPending = approvalPendingByBlank || approvalPendingByLowUsage;

    const isNormalOperation = !isApprovalPending;
    const isFaultByCollected = !!faultCutoff && isNormalOperation && !!collectedAt && collectedAt < faultCutoff;
    const isFault = isManualOffFault || isFaultByCollected || isOverAbnormal;

    return {
      rowIndex: idx + 5,
      chargerId,
      chargerBaseId: baseId13(chargerId),
      siteId,
      siteName,
      siteStatus,
      collectedAt,
      collectedAtText: formatDate(collectedAt),
      usageCount,
      address,
      detailAddress,
      isApprovalPending,
      isNormalOperation,
      isFault,
      isFaultByCollected,
      isManualOff,
      isManualOffFault,
      isOverAbnormal,
    };
  }).filter(Boolean);

  return { rows: parsed, faultCutoff };
}

function parseReplacementFile(rows) {
  const set = new Set();
  rows.slice(1).forEach((row) => {
    const id = normalizeId(row[1]); // B열
    if (id) set.add(id);
  });
  return set;
}

function mapVocColumns(headerRow) {
  const headers = headerRow.map((h) => normalizeText(h));
  return {
    matchId: 13,          // N
    siteName: 14,         // O
    progressName: 15,     // P
    progressOrg: 16,      // Q
    completedAt: 17,      // R
    completedName: 18,    // S
    completedOrg: 19,     // T
    completedContent: 20, // U
    receivedAt: findHeaderIndex(headers, ['접수일', '접수일시']),
  };
}

function parseVocFile(rows) {
  const headerRow = rows[0] || [];
  const col = mapVocColumns(headerRow);

  return rows.slice(1).map((row) => {
    const matchId = normalizeId(row[col.matchId]);
    const siteName = normalizeText(row[col.siteName]);
    const completedName = normalizeText(row[col.completedName]);
    const completedOrg = normalizeText(row[col.completedOrg]);
    const progressName = normalizeText(row[col.progressName]);
    const progressOrg = normalizeText(row[col.progressOrg]);
    const completedContent = normalizeText(row[col.completedContent]);
    const completedAt = parseDateValue(row[col.completedAt]);
    const receivedAt = col.receivedAt >= 0 ? parseDateValue(row[col.receivedAt]) : null;

    const isCompleted = !!completedName && !!completedOrg;
    const isPending = !completedName && !completedOrg;

    let pendingDisplayOrg = '';
    let pendingDisplayName = '';

    if (isPending) {
      if (progressOrg === 'EV세상') {
        pendingDisplayOrg = 'EV세상';
        pendingDisplayName = progressName || '(미기재)';
      } else if (!progressOrg && progressName === '배정 중') {
        pendingDisplayOrg = 'EV세상';
        pendingDisplayName = 'EV세상 배정 중';
      }
    }

    return {
      matchId,
      matchBaseId: baseId13(matchId),
      matchSiteName: normalizeSiteName(siteName),
      siteName,
      completedName,
      completedOrg,
      progressName,
      progressOrg,
      pendingDisplayOrg,
      pendingDisplayName,
      completedContent,
      completedAt,
      receivedAt,
      isCompleted,
      isPending,
    };
  }).filter((row) => row.matchId || row.matchBaseId || row.matchSiteName || row.siteName || row.isCompleted || row.isPending);
}

function classifyRows(rawRows, replacementSet, vocRows, faultCutoff) {
  const pendingByExactId = new Map();
  const pendingByBaseId = new Map();
  const pendingBySite = new Map();

  const completedByExactId = new Map();
  const completedByBaseId = new Map();
  const completedBySite = new Map();

  const pushMap = (map, key, value) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(value);
  };

  for (const v of vocRows) {
    if (v.isPending) {
      pushMap(pendingByExactId, v.matchId, v);
      pushMap(pendingByBaseId, v.matchBaseId, v);
      pushMap(pendingBySite, v.matchSiteName, v);
    }
    if (v.isCompleted) {
      pushMap(completedByExactId, v.matchId, v);
      pushMap(completedByBaseId, v.matchBaseId, v);
      pushMap(completedBySite, v.matchSiteName, v);
    }
  }

  return rawRows.map((row) => {
    const pendingExact = pendingByExactId.get(row.chargerId) || [];
    const pendingBase = pendingByBaseId.get(row.chargerBaseId) || [];
    const pendingSite = pendingBySite.get(normalizeSiteName(row.siteName)) || [];
    const vocPendingMatches = pendingExact.length ? pendingExact : pendingBase.length ? pendingBase : pendingSite;

    const completedExact = completedByExactId.get(row.chargerId) || [];
    const completedBase = completedByBaseId.get(row.chargerBaseId) || [];
    const completedSite = completedBySite.get(normalizeSiteName(row.siteName)) || [];
    const completedMatches = completedExact.length ? completedExact : completedBase.length ? completedBase : completedSite;

    const sortedHistory = [...completedMatches].sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0));
    const latestCompleted = sortedHistory[0];
    const recentHistory = sortedHistory.slice(0, 3).map((item) => ({
      completedAtText: formatDate(item.completedAt || null),
      completedContent: item.completedContent || '',
    }));

    const isReplacementCandidate = replacementSet.has(row.chargerId) && row.isFault;

    let faultType = '';
    if (row.isFault) {
      if (row.isManualOffFault) faultType = '임의 OFF';
      else if (isReplacementCandidate) faultType = '교체 예정';
      else if (vocPendingMatches.length > 0) faultType = 'VOC 조치 예정';
      else faultType = '미인입 고장';
    }

    const occurrenceCount = completedMatches.length;
    let recurrenceLabel = '-';
    if (faultType === 'VOC 조치 예정') {
      if (occurrenceCount === 2) recurrenceLabel = '2회 재발생';
      else if (occurrenceCount === 3) recurrenceLabel = '3회 재발생';
      else if (occurrenceCount >= 4) recurrenceLabel = '4회 이상';
    }

    let isLongPending = false;
    if (faultType === 'VOC 조치 예정' && !!faultCutoff && !!row.collectedAt) {
      const diffMs = faultCutoff.getTime() - row.collectedAt.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      isLongPending = diffDays >= 14;
    }

    const isVocOverAbnormal = faultType === 'VOC 조치 예정' && row.isOverAbnormal;

    return {
      ...row,
      faultType,
      latestCompletedAtText: formatDate(latestCompleted?.completedAt || null),
      latestCompletedContent: latestCompleted?.completedContent || '',
      recurrenceLabel,
      occurrenceCount,
      isLongPending,
      isVocOverAbnormal,
      recentHistory,
    };
  });
}

function StatusDot({ row }) {
  if (row.isFault) return <span style={{ color: COLORS.red, fontWeight: 700 }}>● 고장</span>;
  if (row.isApprovalPending) return <span style={{ color: COLORS.yellow, fontWeight: 700 }}>● 승인대기</span>;
  return <span style={{ color: COLORS.blue, fontWeight: 700 }}>● 정상 운영</span>;
}

function SearchStatusTag({ row }) {
  if (row.isFault) return <span style={styles.tagRed}>● {row.faultType || '고장'}</span>;
  if (row.isApprovalPending) return <span style={styles.tagYellow}>● 승인대기</span>;
  return <span style={styles.tagBlue}>● 정상 운영</span>;
}

function StatCard({ title, value, sub, color }) {
  return (
    <div style={{ ...styles.card, borderTop: `4px solid ${color}` }}>
      <div style={styles.cardTitle}>{title}</div>
      <div style={styles.cardValue}>{value}</div>
      <div style={styles.cardSub}>{sub}</div>
    </div>
  );
}

function LegendItem({ name, value, color }) {
  return (
    <div style={styles.legendItem}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
        <div>{name}</div>
      </div>
      <div style={{ fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function DonutChart({ dashboard }) {
  const total = dashboard.faultCount;
  const data = [
    { name: '임의 OFF', value: dashboard.manualOff, color: COLORS.red },
    { name: 'VOC 조치 예정', value: dashboard.vocPending, color: COLORS.violet },
    { name: '교체 예정', value: dashboard.replacement, color: COLORS.blue },
    { name: '미인입 고장', value: dashboard.uninbound, color: COLORS.slate },
  ];

  if (!total) {
    return (
      <div style={styles.donutWrap}>
        <div style={{ ...styles.donut, background: '#e2e8f0' }}>
          <div style={styles.donutInner}>
            <div style={styles.donutLabel}>총 고장</div>
            <div style={styles.donutValue}>0기</div>
          </div>
        </div>
      </div>
    );
  }

  let current = 0;
  const stops = data.map((item) => {
    const start = (current / total) * 360;
    current += item.value;
    const end = (current / total) * 360;
    return `${item.color} ${start}deg ${end}deg`;
  });

  return (
    <div style={styles.donutLayout}>
      <div style={styles.donutWrap}>
        <div style={{ ...styles.donut, background: `conic-gradient(${stops.join(', ')})` }}>
          <div style={styles.donutInner}>
            <div style={styles.donutLabel}>총 고장</div>
            <div style={styles.donutValue}>{total.toLocaleString()}기</div>
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {data.map((item) => (
          <LegendItem key={item.name} name={item.name} value={`${item.value.toLocaleString()}기`} color={item.color} />
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [rawState, setRawState] = useState(null);
  const [replacementSet, setReplacementSet] = useState(new Set());
  const [vocRows, setVocRows] = useState([]);
  const [logs, setLogs] = useState([]);
  const [tab, setTab] = useState('dashboard');
  const [searchText, setSearchText] = useState('');
  const [faultFilter, setFaultFilter] = useState('all');
  const [recurrenceFilter, setRecurrenceFilter] = useState('all');
  const [longPendingFilter, setLongPendingFilter] = useState('all');
  const [orgFilter, setOrgFilter] = useState('all');
  const [vocPartStartDate, setVocPartStartDate] = useState('');
  const [vocPartEndDate, setVocPartEndDate] = useState('');

  const pushLog = (text) => {
    setLogs((prev) => [text, ...prev].slice(0, 8));
  };

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      try {
        await handleServerUpload(file);

        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const rows = workbookToRows(workbook);

        if (file.name.includes('충전기_상태정보_리스트')) {
          setRawState(parseRawFile(file, rows));
          pushLog(`RAW 상태정보 반영: ${file.name}`);
        } else if (file.name.includes('충전기 교체건')) {
          setReplacementSet(parseReplacementFile(rows));
          pushLog(`교체 예정 반영: ${file.name}`);
        } else if (file.name.includes('VOC접수건') || file.name.toLowerCase().endsWith('.csv')) {
          setVocRows(parseVocFile(rows));
          pushLog(`VOC 파일 반영: ${file.name}`);
        } else {
          pushLog(`분류되지 않은 파일: ${file.name}`);
        }
      } catch (error) {
        console.error('파일 처리 실패:', error);
        pushLog(`파일 처리 실패: ${file.name}`);
      }
    }
    e.target.value = '';
  };

  const mergedRows = useMemo(() => {
    if (!rawState?.rows) return [];
    return classifyRows(rawState.rows, replacementSet, vocRows, rawState.faultCutoff);
  }, [rawState, replacementSet, vocRows]);

  const dashboard = useMemo(() => {
    const total = mergedRows.length;
    const approvalPending = mergedRows.filter((r) => r.isApprovalPending).length;
    const normalOperation = mergedRows.filter((r) => r.isNormalOperation).length;
    const faultRows = mergedRows.filter((r) => r.isFault);
    const faultCount = faultRows.length;
    const manualOff = faultRows.filter((r) => r.faultType === '임의 OFF').length;
    const vocPendingRows = faultRows.filter((r) => r.faultType === 'VOC 조치 예정');
    const vocPending = vocPendingRows.length;
    const replacement = faultRows.filter((r) => r.faultType === '교체 예정').length;
    const uninbound = faultRows.filter((r) => r.faultType === '미인입 고장').length;
    const faultRate = normalOperation > 0 ? ((faultCount / normalOperation) * 100).toFixed(1) : '0.0';

    const vocRecurring = vocPendingRows.filter((r) => r.occurrenceCount >= 2).length;
    const vocLongPending = vocPendingRows.filter((r) => r.isLongPending).length;
    const vocOverAbnormal = vocPendingRows.filter((r) => r.isVocOverAbnormal).length;

    const evCompleted = vocRows.filter((v) => v.isCompleted && v.completedOrg === 'EV세상').length;
    const evPending = vocRows.filter((v) => v.isPending && v.pendingDisplayOrg === 'EV세상').length;

    return {
      total,
      approvalPending,
      normalOperation,
      faultCount,
      faultRate,
      manualOff,
      vocPending,
      replacement,
      uninbound,
      vocRecurring,
      vocLongPending,
      vocOverAbnormal,
      evCompleted,
      evPending,
    };
  }, [mergedRows, vocRows]);

  const filteredRows = useMemo(() => {
    return mergedRows.filter((row) => {
      const matchesSearch =
        !searchText ||
        [row.siteId, row.chargerId, row.siteName, row.address, row.detailAddress]
          .some((value) => normalizeText(value).toLowerCase().includes(searchText.toLowerCase()));

      const matchesFault =
        faultFilter === 'all'
          ? true
          : faultFilter === 'fault'
            ? row.isFault
            : faultFilter === 'approval'
              ? row.isApprovalPending
              : row.faultType === faultFilter;

      const matchesRecurrence =
        recurrenceFilter === 'all'
          ? true
          : recurrenceFilter === 'only'
            ? row.occurrenceCount >= 2
            : true;

      const matchesLongPending =
        longPendingFilter === 'all'
          ? true
          : longPendingFilter === 'only'
            ? row.isLongPending
            : true;

      return matchesSearch && matchesFault && matchesRecurrence && matchesLongPending;
    });
  }, [mergedRows, searchText, faultFilter, recurrenceFilter, longPendingFilter]);

  const vocStats = useMemo(() => {
    const map = new Map();

    for (const row of vocRows) {
      if (row.isCompleted) {
        const org = row.completedOrg;
        const name = row.completedName;
        if (orgFilter !== 'all' && org !== orgFilter) continue;
        const key = `${org}__${name}`;
        if (!map.has(key)) map.set(key, { org, name, completed: 0, pending: 0 });
        map.get(key).completed += 1;
      }

      if (row.isPending) {
        const org = row.pendingDisplayOrg;
        const name = row.pendingDisplayName;
        if (!org || !name) continue;
        if (orgFilter !== 'all' && org !== orgFilter) continue;
        const key = `${org}__${name}`;
        if (!map.has(key)) map.set(key, { org, name, completed: 0, pending: 0 });
        map.get(key).pending += 1;
      }
    }

    return Array.from(map.values()).sort((a, b) => (b.completed + b.pending) - (a.completed + a.pending));
  }, [vocRows, orgFilter]);

  const vocDateFilteredRows = useMemo(() => {
    const start = vocPartStartDate ? new Date(`${vocPartStartDate}T00:00:00`) : null;
    const end = vocPartEndDate ? new Date(`${vocPartEndDate}T23:59:59`) : null;

    return vocRows.filter((v) => {
      if (!v.isCompleted || v.completedOrg !== 'EV세상' || !v.completedAt) return false;
      if (start && v.completedAt < start) return false;
      if (end && v.completedAt > end) return false;
      return true;
    });
  }, [vocRows, vocPartStartDate, vocPartEndDate]);

  const partUsageRows = useMemo(() => {
    return vocDateFilteredRows
      .filter((v) => v.completedContent.includes('부품교체'))
      .map((v) => {
        const detectedParts = Object.entries(PART_PATTERNS)
          .filter(([name, regex]) => {
            if (name === '충전기') {
              return isValidChargerReplacement(v.completedContent);
            }
            return regex.test(v.completedContent);
          })
          .map(([name]) => name);

        if (detectedParts.length === 0) return null;

        return {
          siteId: v.matchBaseId,
          chargerId: v.matchId || `${v.matchBaseId}-01`,
          siteName: v.siteName || '-',
          completedAtText: formatDate(v.completedAt),
          usedParts: detectedParts.join(', '),
          fullContent: v.completedContent,
        };
      })
      .filter(Boolean);
  }, [vocDateFilteredRows]);

  const partUsageSummary = useMemo(() => {
    const counts = {};
    Object.keys(PART_PATTERNS).forEach((name) => {
      counts[name] = 0;
    });

    partUsageRows.forEach((row) => {
      row.usedParts.split(', ').forEach((part) => {
        counts[part] = (counts[part] || 0) + 1;
      });
    });

    return Object.entries(counts)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [partUsageRows]);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.headerBox}>
          <div>
            <h1 style={styles.pageTitle}>충전기 관리 대시보드</h1>
            <div style={styles.pageDesc}>운영 현황, 현재 상태, 조치 진행 상황을 전체적으로 확인합니다.</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <label style={styles.uploadButton}>
              파일 업로드
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                multiple
                onChange={handleFiles}
                style={{ display: 'none' }}
              />
            </label>
            <button style={styles.logoutButton} onClick={() => supabase.auth.signOut()}>
              로그아웃
            </button>
            <button
              style={styles.resetButton}
              onClick={() => {
                setRawState(null);
                setReplacementSet(new Set());
                setVocRows([]);
                setLogs([]);
                setSearchText('');
                setFaultFilter('all');
                setRecurrenceFilter('all');
                setLongPendingFilter('all');
                setOrgFilter('all');
                setVocPartStartDate('');
                setVocPartEndDate('');
              }}
            >
              초기화
            </button>
          </div>
        </div>

        <div style={styles.topGrid}>
          <div style={styles.panel}>
            <div style={styles.sectionTitle}>산정 기준</div>
            <ul style={styles.guideList}>
              <li>RAW 상태정보 파일은 4행 헤더, 5행부터 데이터를 읽습니다.</li>
              <li>전체 충전기 수는 RAW C열 충전기 ID 기준입니다.</li>
              <li>승인대기는 수집일 공백 또는 수집이 멈춘 상태 중 누적사용량 30 이하</li>
              <li>고장 산정은 파일명 기준 시각인 07:00 이전 수집값 또는 과다이상 기준입니다.</li>
              <li>VOC 처리중은 완료자명과 완료자 소속이 모두 공백인 기준입니다.</li>
              <li>장기 미조치는 VOC 조치 예정 중 판정 기준일 대비 14일 이상 경과 건입니다.</li>
            </ul>
          </div>
          <div style={styles.panel}>
            <div style={styles.sectionTitle}>최근 반영 로그</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {logs.length === 0 ? (
                <div style={{ color: COLORS.sub }}>아직 업로드된 파일이 없습니다.</div>
              ) : (
                logs.map((log, idx) => <div key={`${log}-${idx}`} style={styles.logItem}>{log}</div>)
              )}
            </div>
          </div>
        </div>

        {!mergedRows.length && (
          <div style={styles.alertBox}>먼저 충전기_상태정보_리스트 파일을 업로드해주세요.</div>
        )}

        <div style={styles.tabRow}>
          <button style={tab === 'dashboard' ? styles.tabActive : styles.tab} onClick={() => setTab('dashboard')}>대시보드</button>
          <button style={tab === 'details' ? styles.tabActive : styles.tab} onClick={() => setTab('details')}>상세내역</button>
          <button style={tab === 'search' ? styles.tabActive : styles.tab} onClick={() => setTab('search')}>충전소 조회</button>
          <button style={tab === 'voc' ? styles.tabActive : styles.tab} onClick={() => setTab('voc')}>VOC 현황</button>
        </div>

        {tab === 'dashboard' && (
          <>
            <div style={styles.cardGrid}>
              <StatCard title="전체 충전기" value={`${dashboard.total.toLocaleString()}기`} sub="RAW C열 충전기 ID 기준" color={COLORS.blue} />
              <StatCard title="승인대기" value={`${dashboard.approvalPending.toLocaleString()}기`} sub="수집일 공백 또는 수집이 멈춘 상태 중 누적사용량 30 이하" color={COLORS.yellow} />
              <StatCard title="정상 운영" value={`${dashboard.normalOperation.toLocaleString()}기`} sub="전체 충전기 - 승인대기" color={COLORS.blue} />
              <StatCard title="고장 충전기" value={`${dashboard.faultCount.toLocaleString()}기`} sub={`고장률 ${dashboard.faultRate}%`} color={COLORS.red} />
              <StatCard
                title="VOC 조치 예정"
                value={`${dashboard.vocPending.toLocaleString()}기`}
                sub={`재발생 ${dashboard.vocRecurring.toLocaleString()}기 / 장기 미조치 ${dashboard.vocLongPending.toLocaleString()}기 / 과다이상 ${dashboard.vocOverAbnormal.toLocaleString()}기`}
                color={COLORS.violet}
              />
              <StatCard title="미인입 고장" value={`${dashboard.uninbound.toLocaleString()}기`} sub="임의 OFF / VOC 조치 예정 / 교체 예정 제외" color={COLORS.slate} />
            </div>

            <div style={styles.middleGrid}>
              <StatCard title="교체 예정" value={`${dashboard.replacement.toLocaleString()}기`} sub="교체건 파일 매칭 기준" color={COLORS.blue} />
              <StatCard title="임의 OFF" value={`${dashboard.manualOff.toLocaleString()}기`} sub="충전기 중 충전상태 기준" color={COLORS.red} />
              <div style={{ ...styles.panel, gridColumn: 'span 2' }}>
                <div style={styles.sectionTitle}>고장 분류</div>
                <DonutChart dashboard={dashboard} />
              </div>
            </div>

            <div style={styles.topGrid}>
              <div style={styles.panel}>
                <div style={styles.sectionTitle}>판정 기준</div>
                <div style={styles.infoBox}>
                  기준 파일일시: <strong>{rawState?.faultCutoff ? formatDate(rawState.faultCutoff) : '-'}</strong>
                </div>
              </div>
              <div style={styles.panel}>
                <div style={styles.sectionTitle}>VOC 완료 요약</div>
                <div style={styles.summaryGrid2}>
                  <div style={styles.summaryBox}>EV세상 진행중 <strong>{dashboard.evPending.toLocaleString()}건</strong></div>
                  <div style={styles.summaryBox}>EV세상 완료 <strong>{dashboard.evCompleted.toLocaleString()}건</strong></div>
                </div>
              </div>
            </div>
          </>
        )}

        {tab === 'details' && (
          <div style={styles.panel}>
            <div style={styles.sectionTitle}>상세내역</div>
            <div style={styles.filterRowWide}>
              <input
                style={styles.inputNarrow}
                placeholder="충전소 ID / 충전기 ID / 충전소명 / 주소"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              <select style={styles.select} value={faultFilter} onChange={(e) => setFaultFilter(e.target.value)}>
                <option value="all">전체</option>
                <option value="fault">고장전체</option>
                <option value="approval">승인대기</option>
                <option value="임의 OFF">임의 OFF</option>
                <option value="VOC 조치 예정">VOC 조치 예정</option>
                <option value="교체 예정">교체 예정</option>
                <option value="미인입 고장">미인입 고장</option>
              </select>
              <select style={styles.select} value={recurrenceFilter} onChange={(e) => setRecurrenceFilter(e.target.value)}>
                <option value="all">재발생 전체</option>
                <option value="only">재발생만 보기</option>
              </select>
              <select style={styles.select} value={longPendingFilter} onChange={(e) => setLongPendingFilter(e.target.value)}>
                <option value="all">장기 미조치 전체</option>
                <option value="only">장기 미조치만 보기</option>
              </select>
              <div style={styles.countBox}>결과 조회 <strong>{filteredRows.length.toLocaleString()}건</strong></div>
            </div>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ width: '8%' }}>충전소 ID</th>
                    <th style={{ width: '10%' }}>충전기 ID</th>
                    <th style={{ width: '12%' }}>충전소명</th>
                    <th style={{ width: '11%' }}>주소</th>
                    <th style={{ width: '9%' }}>상세주소</th>
                    <th style={{ width: '8%' }}>상태</th>
                    <th style={{ width: '10%' }}>고장분류</th>
                    <th style={{ width: '10%' }}>최근수집일</th>
                    <th style={{ width: '10%' }}>재발생 여부</th>
                    <th style={{ width: '10%' }}>장기 미조치</th>
                    <th style={{ width: '10%' }}>과다이상</th>
                    <th style={{ width: '12%' }}>이후 내용</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.slice(0, 1000).map((row) => (
                    <tr key={`${row.chargerId}-${row.rowIndex}`}>
                      <td>{row.siteId || '-'}</td>
                      <td>{row.chargerId}</td>
                      <td>{row.siteName || '-'}</td>
                      <td>{row.address || '-'}</td>
                      <td>{row.detailAddress || '-'}</td>
                      <td><StatusDot row={row} /></td>
                      <td>{row.faultType || '-'}</td>
                      <td>{row.collectedAtText}</td>
                      <td>{row.recurrenceLabel}</td>
                      <td>{row.isLongPending ? '장기 미조치' : '-'}</td>
                      <td>{row.isVocOverAbnormal ? '과다이상' : '-'}</td>
                      <td>{row.latestCompletedContent || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'search' && (
          <div style={styles.panel}>
            <div style={styles.sectionTitle}>충전소 조회</div>
            <input
              style={{ ...styles.input, marginBottom: 16 }}
              placeholder="충전소명, 충전소 ID, 충전기 ID를 입력하세요"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <div style={styles.searchGrid}>
              {filteredRows.slice(0, 20).map((row) => (
                <div key={`${row.chargerId}-${row.rowIndex}-search`} style={styles.searchCard}>
                  <div style={styles.searchHeader}>
                    <div>
                      <div style={styles.searchTitle}>{row.siteName || '충전소명 미기재'}</div>
                      <div style={styles.searchSub}>충전소 ID {row.siteId || '-'} · 충전기 ID {row.chargerId}</div>
                    </div>
                    <SearchStatusTag row={row} />
                  </div>
                  <div style={styles.searchLine}>주소: {row.address || '-'} {row.detailAddress || ''}</div>
                  <div style={styles.searchLine}>최근 수집일: {row.collectedAtText}</div>
                  <div style={styles.searchLine}>충전소 상태: {row.siteStatus || '-'}</div>
                  <div style={styles.searchLine}>재발생 여부: {row.recurrenceLabel}</div>
                  <div style={styles.searchLine}>장기 미조치: {row.isLongPending ? '장기 미조치' : '-'}</div>
                  <div style={styles.searchLine}>과다이상: {row.isVocOverAbnormal ? '과다이상' : '-'}</div>
                  <div style={styles.searchLine}>최근 완료일: {row.latestCompletedAtText}</div>
                  <div style={styles.searchLine}>최근 완료내용: {row.latestCompletedContent || '-'}</div>

                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>최근 조치 이력</div>
                    {row.recentHistory && row.recentHistory.length > 0 ? (
                      <div style={{ display: 'grid', gap: 6 }}>
                        {row.recentHistory.map((item, idx) => (
                          <div key={`${row.chargerId}-history-${idx}`} style={styles.historyLine}>
                            {item.completedAtText} / {item.completedContent || '-'}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={styles.noHistory}>최근 완료 이력 없음</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'voc' && (
          <div style={styles.vocLayout}>
            <div style={styles.panel}>
              <div style={styles.sectionTitle}>VOC 현황</div>
              <div style={styles.summaryGrid2}>
                <div style={styles.summaryBox}>EV세상 진행중 <strong>{dashboard.evPending.toLocaleString()}건</strong></div>
                <div style={styles.summaryBox}>EV세상 완료 <strong>{dashboard.evCompleted.toLocaleString()}건</strong></div>
              </div>
            </div>

            <div style={styles.panel}>
              <div style={styles.sectionTitle}>건수 현황</div>
              <select style={{ ...styles.select, marginBottom: 16, maxWidth: 220 }} value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)}>
                <option value="all">전체</option>
                <option value="상담사">상담사</option>
                <option value="EV세상">EV세상</option>
              </select>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th>소속</th>
                      <th>이름</th>
                      <th>완료건</th>
                      <th>진행중건</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vocStats.map((row) => (
                      <tr key={`${row.org}-${row.name}`}>
                        <td>{row.org}</td>
                        <td>{row.name}</td>
                        <td>{row.completed.toLocaleString()}건</td>
                        <td>{row.pending.toLocaleString()}건</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={styles.panel}>
              <div style={styles.sectionTitle}>부품 교체 기간 조회</div>
              <div style={styles.dateFilterRow}>
                <input type="date" style={styles.input} value={vocPartStartDate} onChange={(e) => setVocPartStartDate(e.target.value)} />
                <input type="date" style={styles.input} value={vocPartEndDate} onChange={(e) => setVocPartEndDate(e.target.value)} />
              </div>
              <div style={{ color: COLORS.sub, fontSize: 13, marginTop: 8 }}>
                완료일시 기준 (VOC 엑셀 R열)으로 필터합니다.
              </div>
            </div>

            <div style={styles.panel}>
              <div style={styles.sectionTitle}>부품 사용 요약</div>
              {partUsageSummary.length === 0 ? (
                <div style={{ color: COLORS.sub }}>선택한 기간의 부품 교체 내역이 없습니다.</div>
              ) : (
                <div style={styles.partSummaryGrid}>
                  {partUsageSummary.map(([part, count]) => (
                    <div key={part} style={styles.summaryBox}>
                      {part} <strong>{count.toLocaleString()}건</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={styles.panel}>
              <div style={styles.sectionTitle}>부품 교체 내역</div>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th>충전소 ID</th>
                      <th>충전기 ID</th>
                      <th>충전소명</th>
                      <th>완료일시</th>
                      <th>사용 부품</th>
                      <th>완료내용</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partUsageRows.map((row, idx) => (
                      <tr key={`${row.chargerId}-${idx}`}>
                        <td>{row.siteId || '-'}</td>
                        <td>{row.chargerId || '-'}</td>
                        <td>{row.siteName || '-'}</td>
                        <td>{row.completedAtText}</td>
                        <td>{row.usedParts}</td>
                        <td>{row.fullContent}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {partUsageRows.length === 0 && (
                <div style={{ color: COLORS.sub, fontSize: 13, marginTop: 8 }}>선택한 기간의 부품 교체 내역이 없습니다.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: COLORS.bg, padding: 24, color: COLORS.text, fontFamily: 'Arial, sans-serif' },
  container: { maxWidth: 1400, margin: '0 auto' },
  headerBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 20, padding: 24, marginBottom: 20 },
  pageTitle: { margin: 0, fontSize: 32, fontWeight: 800 },
  pageDesc: { marginTop: 8, color: COLORS.sub, fontSize: 14 },
  uploadButton: { background: COLORS.text, color: '#fff', padding: '12px 18px', borderRadius: 12, cursor: 'pointer', fontWeight: 700 },
  logoutButton: { background: '#fff', color: COLORS.text, border: `1px solid ${COLORS.border}`, padding: '12px 18px', borderRadius: 12, cursor: 'pointer', fontWeight: 700 },
  resetButton: { background: '#fff', color: COLORS.text, border: `1px solid ${COLORS.border}`, padding: '12px 18px', borderRadius: 12, cursor: 'pointer', fontWeight: 700 },
  topGrid: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 20 },
  panel: { background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 20, padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 700, marginBottom: 14 },
  guideList: { margin: 0, paddingLeft: 18, lineHeight: 1.8, color: COLORS.sub },
  logItem: { background: '#f8fafc', borderRadius: 12, padding: 12, fontSize: 14 },
  alertBox: { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 16, padding: 16, marginBottom: 20, fontWeight: 700 },
  tabRow: { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 },
  tab: { background: '#fff', border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 999, padding: '10px 16px', cursor: 'pointer', fontWeight: 700 },
  tabActive: { background: COLORS.text, border: `1px solid ${COLORS.text}`, color: '#fff', borderRadius: 999, padding: '10px 16px', cursor: 'pointer', fontWeight: 700 },
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, marginBottom: 16 },
  middleGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, marginBottom: 20 },
  card: { background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 20, minHeight: 130 },
  cardTitle: { color: COLORS.sub, fontSize: 14, marginBottom: 10 },
  cardValue: { fontSize: 30, fontWeight: 800, marginBottom: 10 },
  cardSub: { fontSize: 13, color: COLORS.sub, lineHeight: 1.5 },
  donutLayout: { display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'center' },
  donutWrap: { display: 'flex', justifyContent: 'center', alignItems: 'center' },
  donut: { width: 240, height: 240, borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center' },
  donutInner: { width: 136, height: 136, borderRadius: '50%', background: '#fff', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' },
  donutLabel: { fontSize: 13, color: COLORS.sub },
  donutValue: { fontSize: 24, fontWeight: 800 },
  legendItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderRadius: 12, padding: '10px 12px' },
  infoBox: { background: '#f8fafc', borderRadius: 14, padding: 16, lineHeight: 1.8, color: COLORS.sub },
  summaryGrid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  summaryBox: { background: '#f8fafc', borderRadius: 14, padding: 16, fontSize: 14 },
  filterRowWide: { display: 'grid', gridTemplateColumns: '1.4fr 1fr 0.9fr 1fr 0.9fr', gap: 12, marginBottom: 16 },
  input: { width: '100%', border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: '12px 14px', fontSize: 14, boxSizing: 'border-box' },
  inputNarrow: { width: '100%', border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: '12px 14px', fontSize: 14, boxSizing: 'border-box' },
  select: { width: '100%', border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: '12px 14px', fontSize: 14, background: '#fff' },
  countBox: { background: '#f8fafc', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center' },
  tableWrap: { overflowX: 'auto', border: `1px solid ${COLORS.border}`, borderRadius: 14 },
  table: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 14 },
  searchGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  searchCard: { border: `1px solid ${COLORS.border}`, borderRadius: 18, background: '#fff', padding: 18 },
  searchHeader: { display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  searchTitle: { fontSize: 20, fontWeight: 800 },
  searchSub: { marginTop: 6, color: COLORS.sub, fontSize: 14 },
  searchLine: { marginBottom: 8, color: COLORS.sub, fontSize: 14 },
  historyLine: { fontSize: 13, color: COLORS.sub, background: '#f8fafc', borderRadius: 10, padding: '8px 10px' },
  noHistory: { fontSize: 13, color: COLORS.sub, background: '#f8fafc', borderRadius: 10, padding: '8px 10px' },
  tagBlue: { background: '#eff6ff', color: COLORS.blue, borderRadius: 999, padding: '8px 12px', fontSize: 13, fontWeight: 700, height: 'fit-content', whiteSpace: 'nowrap' },
  tagYellow: { background: '#fffbeb', color: COLORS.yellow, borderRadius: 999, padding: '8px 12px', fontSize: 13, fontWeight: 700, height: 'fit-content', whiteSpace: 'nowrap' },
  tagRed: { background: '#fef2f2', color: COLORS.red, borderRadius: 999, padding: '8px 12px', fontSize: 13, fontWeight: 700, height: 'fit-content', whiteSpace: 'nowrap' },
  vocLayout: { display: 'grid', gap: 16 },
  dateFilterRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  partSummaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
};