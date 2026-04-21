import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from './supabase';

/**
 * 관리자 계정 이메일
 * - 현재는 사용자 1명 운영 기준이므로 여기 이메일만 바꿔 사용하면 됩니다.
 * - 추후에는 profiles.is_admin 기반으로 전환 가능
 */
const ADMIN_EMAILS = ['chan0912@everon.co.kr'];

function isAdminEmail(email = '') {
  return ADMIN_EMAILS.includes(String(email).toLowerCase());
}

function getFileType(fileName = '') {
  const original = String(fileName || '').trim();
  const lower = original.toLowerCase();

  if (
    original.includes('충전기_상태정보_리스트') ||
    original.includes('충전기 상태정보 리스트') ||
    lower.includes('상태정보')
  ) {
    return 'raw';
  }

  if (
    original.includes('충전기 교체건') ||
    original.includes('교체건') ||
    lower.includes('replacement')
  ) {
    return 'replacement';
  }

  if (
    original.includes('VOC접수건') ||
    lower.includes('voc') ||
    lower.endsWith('.csv')
  ) {
    return 'voc';
  }

  return 'etc';
}

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
  const fileType = getFileType(file.name);

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
    file_type: fileType,
    original_name: file.name,
    storage_path: filePath,
  });

  if (dbError) {
    console.error('DB 저장 실패:', dbError);
    alert(`파일은 업로드됐지만 DB 저장 실패: ${dbError.message}`);
    throw dbError;
  }

  return { user, filePath, fileType };
};

const COLORS = {
  bg: '#eef2f7',
  shell: '#f4f7fb',
  panel: '#ffffff',
  panelSoft: '#f8fbff',
  border: '#d9e2ef',
  line: '#e6edf5',
  text: '#0f172a',
  sub: '#66758f',
  blue: '#1d63e9',
  blueSoft: '#eaf2ff',
  yellow: '#f59e0b',
  yellowSoft: '#fff5e7',
  red: '#ef4444',
  redSoft: '#fff0f0',
  violet: '#7c3aed',
  violetSoft: '#f3edff',
  slate: '#50627d',
  slateSoft: '#eff3f8',
  green: '#22c55e',
  greenSoft: '#ebfbf1',
  shadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
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
    chargerId: 2,
    siteName: 5,
    siteStatus: 6,
    collectedAt: 10,
    overAbnormal: 17,
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

  const parsed = dataRows
    .map((row, idx) => {
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
      const approvalPendingByLowUsage =
        isStopped && usageCount !== null && usageCount <= 30 && !isManualOff && !isOverAbnormal;
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
    })
    .filter(Boolean);

  return { rows: parsed, faultCutoff };
}

function parseReplacementFile(rows) {
  const set = new Set();
  rows.slice(1).forEach((row) => {
    const id = normalizeId(row[1]);
    if (id) set.add(id);
  });
  return set;
}

function mapVocColumns(headerRow) {
  const headers = headerRow.map((h) => normalizeText(h));
  return {
    matchId: 13,
    siteName: 14,
    progressName: 15,
    progressOrg: 16,
    completedAt: 17,
    completedName: 18,
    completedOrg: 19,
    completedContent: 20,
    receivedAt: findHeaderIndex(headers, ['접수일', '접수일시']),
  };
}

function parseVocFile(rows) {
  const headerRow = rows[0] || [];
  const col = mapVocColumns(headerRow);

  return rows
    .slice(1)
    .map((row) => {
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
    })
    .filter((row) => row.matchId || row.matchBaseId || row.matchSiteName || row.siteName || row.isCompleted || row.isPending);
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

function IconShield({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2L21 5.2V11.3C21 16.6 17.5 20.6 12 22C6.5 20.6 3 16.6 3 11.3V5.2L12 2Z" fill="currentColor" />
    </svg>
  );
}

function IconGrid({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function IconList({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="4" height="4" rx="1" />
      <rect x="4" y="10" width="4" height="4" rx="1" />
      <rect x="4" y="16" width="4" height="4" rx="1" />
      <path d="M11 6H20" />
      <path d="M11 12H20" />
      <path d="M11 18H20" />
    </svg>
  );
}

function IconSearch({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20L16.65 16.65" />
    </svg>
  );
}

function IconVoc({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8" />
      <path d="M8.5 12C9.5 10 10.8 9 12 9C13.2 9 14.5 10 15.5 12" />
      <path d="M8.5 13.5C9.5 15.5 10.8 16.5 12 16.5C13.2 16.5 14.5 15.5 15.5 13.5" />
    </svg>
  );
}

function IconUser({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20C6.5 16.8 8.9 15 12 15C15.1 15 17.5 16.8 19 20" />
    </svg>
  );
}

function IconUpload({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V5" />
      <path d="M8 9L12 5L16 9" />
      <path d="M5 19C5 17.9 5.9 17 7 17H17C18.1 17 19 17.9 19 19" />
    </svg>
  );
}

function IconLogout({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 17L15 12L10 7" />
      <path d="M15 12H4" />
      <path d="M20 5V19" />
    </svg>
  );
}

function IconRefresh({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12A8 8 0 1 1 17.2 6" />
      <path d="M20 4V10H14" />
    </svg>
  );
}

function MetricIcon({ type, color }) {
  const common = { width: 28, height: 28, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' };

  const map = {
    charger: <svg {...common}><path d="M9 4H15V10H9Z" /><path d="M15 7H17C18.1 7 19 7.9 19 9V14" /><path d="M9 21V17" /><path d="M15 21V17" /><path d="M8 10H16V17H8Z" /><path d="M11 2V4" /></svg>,
    pending: <svg {...common}><path d="M12 22C16.4 20.9 19 17.3 19 13V7L12 4L5 7V13C5 17.3 7.6 20.9 12 22Z" /><path d="M12 9V13" /><circle cx="12" cy="16" r="1" /></svg>,
    normal: <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M8.5 12.5L11 15L16 10" /></svg>,
    fault: <svg {...common}><path d="M12 3L21 19H3L12 3Z" /><path d="M12 9V13" /><path d="M12 17H12.01" /></svg>,
    voc: <svg {...common}><path d="M8 4H14L18 8V19A1 1 0 0 1 17 20H8A2 2 0 0 1 6 18V6A2 2 0 0 1 8 4Z" /><path d="M14 4V8H18" /><circle cx="10" cy="14" r="2.5" /><path d="M16 18L12 15.8" /></svg>,
    uninbound: <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M8 16L16 8" /></svg>,
    replacement: <svg {...common}><path d="M16 3H21V8" /><path d="M8 21H3V16" /><path d="M20 4L14 10" /><path d="M4 20L10 14" /><path d="M14 4H20V10" /><path d="M4 14V20H10" /></svg>,
    off: <svg {...common}><path d="M12 3V11" /><path d="M7.5 5.8A8 8 0 1 0 16.5 5.8" /></svg>,
    date: <svg {...common}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3V7" /><path d="M16 3V7" /><path d="M4 10H20" /><path d="M12 13V16" /><path d="M12 16L14 18" /></svg>,
  };

  return <>{map[type] || null}</>;
}

function statusMeta(type) {
  switch (type) {
    case '전체 충전기':
      return { accent: COLORS.blue, soft: COLORS.blueSoft, icon: 'charger' };
    case '승인대기':
      return { accent: COLORS.yellow, soft: COLORS.yellowSoft, icon: 'pending' };
    case '정상 운영':
      return { accent: COLORS.green, soft: COLORS.greenSoft, icon: 'normal' };
    case '고장 충전기':
      return { accent: COLORS.red, soft: COLORS.redSoft, icon: 'fault' };
    case 'VOC 조치 예정':
      return { accent: COLORS.violet, soft: COLORS.violetSoft, icon: 'voc' };
    case '미인입 고장':
      return { accent: COLORS.yellow, soft: COLORS.yellowSoft, icon: 'uninbound' };
    case '교체 예정':
      return { accent: COLORS.yellow, soft: COLORS.yellowSoft, icon: 'replacement' };
    case '임의 OFF':
      return { accent: COLORS.text, soft: '#eef2f7', icon: 'off' };
    default:
      return { accent: COLORS.blue, soft: COLORS.blueSoft, icon: 'charger' };
  }
}

function StatusDot({ row }) {
  if (row.isFault) return <span style={{ color: COLORS.red, fontWeight: 800 }}>● 고장</span>;
  if (row.isApprovalPending) return <span style={{ color: COLORS.yellow, fontWeight: 800 }}>● 승인대기</span>;
  return <span style={{ color: COLORS.blue, fontWeight: 800 }}>● 정상 운영</span>;
}

function SearchStatusTag({ row }) {
  if (row.isFault) return <span style={styles.tagRed}>● {row.faultType || '고장'}</span>;
  if (row.isApprovalPending) return <span style={styles.tagYellow}>● 승인대기</span>;
  return <span style={styles.tagBlue}>● 정상 운영</span>;
}

function StatCard({ title, value, sub }) {
  const meta = statusMeta(title);
  return (
    <div
      style={{
        ...styles.card,
        border: `1px solid ${meta.accent}55`,
        boxShadow: COLORS.shadow,
      }}
    >
      <div style={styles.cardTopRow}>
        <div style={{ ...styles.cardTitle, color: meta.accent }}>{title}</div>
        <div style={{ ...styles.metricIconWrap, background: meta.soft }}>
          <MetricIcon type={meta.icon} color={meta.accent} />
        </div>
      </div>
      <div style={styles.cardValue}>{value}</div>
      <div style={styles.cardSub}>{sub}</div>
      <div style={{ ...styles.cardAccent, background: meta.accent }} />
    </div>
  );
}

function LegendItem({ name, value, color }) {
  return (
    <div style={styles.legendItem}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <div style={{ whiteSpace: 'normal', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.4 }}>{name}</div>
      </div>
      <div style={{ fontWeight: 800, flexShrink: 0, paddingLeft: 16, minWidth: 78, textAlign: 'right' }}>{value}</div>
    </div>
  );
}

function DonutChart({ dashboard }) {
  const total = dashboard.faultCount;
  const data = [
    { name: '임의 OFF', value: dashboard.manualOff, color: COLORS.text },
    { name: 'VOC 조치 예정', value: dashboard.vocPending, color: COLORS.violet },
    { name: '교체 예정', value: dashboard.replacement, color: COLORS.yellow },
    { name: '미인입 고장', value: dashboard.uninbound, color: COLORS.yellow },
  ];

  if (!total) {
    return (
      <div style={styles.donutWrap}>
        <div style={{ ...styles.donut, background: COLORS.line }}>
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

function SideNavItem({ active, icon, label, onClick }) {
  return (
    <button onClick={onClick} style={active ? styles.sideNavActive : styles.sideNavItem}>
      <span style={styles.sideNavIcon}>{icon}</span>
      <span>{label}</span>
      {active && <span style={styles.sideNavActiveBar} />}
    </button>
  );
}

export default function Dashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isApproved, setIsApproved] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [approvalChecked, setApprovalChecked] = useState(false);

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
  const [isRestoring, setIsRestoring] = useState(true);

  const [profiles, setProfiles] = useState([]);
  const [profilesLoading, setProfilesLoading] = useState(false);

  const pushLog = (text) => {
    setLogs((prev) => [text, ...prev].slice(0, 12));
  };

  const ensureProfileAndCheckApproval = async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setApprovalChecked(true);
      setIsRestoring(false);
      return null;
    }

    setCurrentUser(user);

    const email = String(user.email || '').toLowerCase();
    const adminFlagByEmail = isAdminEmail(email);

    const { error: upsertError } = await supabase.from('profiles').upsert(
      {
        id: user.id,
        email,
        approved: adminFlagByEmail ? true : false,
        is_admin: adminFlagByEmail,
      },
      { onConflict: 'id' }
    );

    if (upsertError) {
      console.error('profiles upsert 실패:', upsertError);
      pushLog('사용자 프로필 저장 실패');
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('approved, is_admin, email')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('승인 여부 조회 실패:', profileError);
      pushLog('승인 여부 조회 실패');
      setApprovalChecked(true);
      setIsRestoring(false);
      return null;
    }

    const approved = !!profile?.approved || adminFlagByEmail;
    const admin = !!profile?.is_admin || adminFlagByEmail;

    setIsApproved(approved);
    setIsAdmin(admin);
    setApprovalChecked(true);

    if (!approved) {
      alert('승인 대기 상태입니다. 관리자 승인 후 사용 가능합니다.');
      await supabase.auth.signOut();
      setIsRestoring(false);
      return null;
    }

    return user;
  };

  const fetchProfiles = async () => {
    if (!isAdmin) return;
    setProfilesLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, approved, is_admin, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('profiles 조회 실패:', error);
        pushLog('사용자 목록 조회 실패');
        return;
      }

      setProfiles(data || []);
    } finally {
      setProfilesLoading(false);
    }
  };

  const approveUser = async (profileId) => {
    const { error } = await supabase.from('profiles').update({ approved: true }).eq('id', profileId);

    if (error) {
      console.error('승인 처리 실패:', error);
      alert(`승인 처리 실패: ${error.message}`);
      return;
    }

    pushLog('사용자 승인 완료');
    fetchProfiles();
  };

  const revokeUser = async (profileId) => {
    const { error } = await supabase.from('profiles').update({ approved: false }).eq('id', profileId);

    if (error) {
      console.error('승인 해제 실패:', error);
      alert(`승인 해제 실패: ${error.message}`);
      return;
    }

    pushLog('사용자 승인 해제 완료');
    fetchProfiles();
  };

  useEffect(() => {
    const init = async () => {
      const user = await ensureProfileAndCheckApproval();
      if (!user) return;

      try {
        const { data: savedFiles, error: filesError } = await supabase
          .from('uploaded_files')
          .select('*')
          .eq('user_id', user.id)
          .in('file_type', ['raw', 'voc', 'replacement'])
          .order('created_at', { ascending: false });

        if (filesError) {
          console.error('저장 파일 조회 실패:', filesError);
          pushLog('저장된 파일 조회 실패');
          setIsRestoring(false);
          return;
        }

        if (!savedFiles || savedFiles.length === 0) {
          pushLog('저장된 파일이 없습니다.');
          setIsRestoring(false);
          return;
        }

        const latestByType = {
          raw:
            savedFiles.find((file) => file.file_type === 'raw') ||
            savedFiles.find((file) => getFileType(file.original_name) === 'raw'),
          voc:
            savedFiles.find((file) => file.file_type === 'voc') ||
            savedFiles.find((file) => getFileType(file.original_name) === 'voc'),
          replacement:
            savedFiles.find((file) => file.file_type === 'replacement') ||
            savedFiles.find((file) => getFileType(file.original_name) === 'replacement'),
        };

        const loadAndParseStoredFile = async (savedFile) => {
          if (!savedFile) return;

          const { data: downloadData, error: downloadError } = await supabase.storage
            .from('uploads')
            .download(savedFile.storage_path);

          if (downloadError) {
            console.error('파일 다운로드 실패:', downloadError);
            pushLog(`복원 실패: ${savedFile.original_name}`);
            return;
          }

          const arrayBuffer = await downloadData.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const rows = workbookToRows(workbook);

          const restoredType = savedFile.file_type || getFileType(savedFile.original_name);

          if (restoredType === 'raw') {
            setRawState(parseRawFile({ name: savedFile.original_name }, rows));
            pushLog(`자동 복원 완료: ${savedFile.original_name}`);
          } else if (restoredType === 'voc') {
            setVocRows(parseVocFile(rows));
            pushLog(`자동 복원 완료: ${savedFile.original_name}`);
          } else if (restoredType === 'replacement') {
            setReplacementSet(parseReplacementFile(rows));
            pushLog(`자동 복원 완료: ${savedFile.original_name}`);
          }
        };

        await loadAndParseStoredFile(latestByType.raw);
        await loadAndParseStoredFile(latestByType.voc);
        await loadAndParseStoredFile(latestByType.replacement);
      } catch (error) {
        console.error('자동 복원 중 오류:', error);
        pushLog('자동 복원 중 오류 발생');
      } finally {
        setIsRestoring(false);
      }
    };

    init();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchProfiles();
    }
  }, [isAdmin]);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      try {
        await handleServerUpload(file);

        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const rows = workbookToRows(workbook);

        const detectedType = getFileType(file.name);

        if (detectedType === 'raw') {
          setRawState(parseRawFile(file, rows));
          pushLog(`RAW 상태정보 반영: ${file.name}`);
        } else if (detectedType === 'replacement') {
          setReplacementSet(parseReplacementFile(rows));
          pushLog(`교체 예정 반영: ${file.name}`);
        } else if (detectedType === 'voc') {
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
        [row.siteId, row.chargerId, row.siteName, row.address, row.detailAddress].some((value) =>
          normalizeText(value).toLowerCase().includes(searchText.toLowerCase())
        );

      const matchesFault =
        faultFilter === 'all'
          ? true
          : faultFilter === 'fault'
            ? row.isFault
            : faultFilter === 'approval'
              ? row.isApprovalPending
              : row.faultType === faultFilter;

      const matchesRecurrence =
        recurrenceFilter === 'all' ? true : recurrenceFilter === 'only' ? row.occurrenceCount >= 2 : true;

      const matchesLongPending =
        longPendingFilter === 'all' ? true : longPendingFilter === 'only' ? row.isLongPending : true;

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

    return Array.from(map.values()).sort((a, b) => b.completed + b.pending - (a.completed + a.pending));
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

  const downloadDetailsExcel = () => {
    const exportRows = filteredRows.map((row) => ({
      충전소ID: row.siteId || '-',
      충전기ID: row.chargerId || '-',
      충전소명: row.siteName || '-',
      주소: row.address || '-',
      상세주소: row.detailAddress || '-',
      상태: row.isFault ? '고장' : row.isApprovalPending ? '승인대기' : '정상 운영',
      고장분류: row.faultType || '-',
      최근수집일: row.collectedAtText || '-',
      재발생여부: row.recurrenceLabel || '-',
      장기미조치: row.isLongPending ? '장기 미조치' : '-',
      과다이상: row.isVocOverAbnormal ? '과다이상' : '-',
      최근완료일: row.latestCompletedAtText || '-',
      이후내용: row.latestCompletedContent || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '상세내역');
    XLSX.writeFile(wb, `상세내역_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const downloadVocPartsExcel = () => {
    const exportRows = partUsageRows.map((row) => ({
      충전소ID: row.siteId || '-',
      충전기ID: row.chargerId || '-',
      충전소명: row.siteName || '-',
      완료일시: row.completedAtText || '-',
      사용부품: row.usedParts || '-',
      완료내용: row.fullContent || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'VOC부품교체내역');
    XLSX.writeFile(wb, `VOC부품교체내역_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const resetAll = () => {
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
  };

  const navItems = [
    { key: 'dashboard', label: '대시보드', icon: <IconGrid /> },
    { key: 'details', label: '상세내역', icon: <IconList /> },
    { key: 'search', label: '충전소 조회', icon: <IconSearch /> },
    { key: 'voc', label: 'VOC 현황', icon: <IconVoc /> },
  ];

  if (isAdmin) {
    navItems.push({ key: 'admin', label: '사용자 관리', icon: <IconUser /> });
  }

  if (!approvalChecked) {
    return (
      <div style={styles.pageCenter}>
        <div style={styles.simpleAlert}>사용자 승인 여부를 확인하는 중입니다...</div>
      </div>
    );
  }

  if (!isApproved) {
    return (
      <div style={styles.pageCenter}>
        <div style={styles.simpleAlert}>승인 대기 상태입니다. 관리자 승인 후 다시 로그인해주세요.</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.appShell}>
        <aside style={styles.sidebar}>
          <div>
            <div style={styles.brandBlock}>
              <div style={styles.brandShieldWrap}>
                <div style={styles.brandShield}><IconShield size={26} /></div>
              </div>
              <div>
                <div style={styles.brandTitle}><span style={{ color: COLORS.blue }}>EverOn</span></div>
                <div style={styles.brandTitleSub}>Care Hub</div>
              </div>
            </div>

            <div style={styles.sideNavWrap}>
              {navItems.map((item) => (
                <SideNavItem
                  key={item.key}
                  active={tab === item.key}
                  icon={item.icon}
                  label={item.label}
                  onClick={() => setTab(item.key)}
                />
              ))}
            </div>
          </div>

          <div style={styles.sidebarBottom}>
            <button style={styles.sidebarLogoutButton} onClick={() => supabase.auth.signOut()}>
              <IconLogout size={16} />
              <span>로그아웃</span>
            </button>

            <div style={styles.userMiniCard}>
              <div style={styles.userMiniIcon}><IconUser size={16} /></div>
              <div>
                <div style={styles.userMiniEmail}>{currentUser?.email || '-'}</div>
                <div style={styles.userMiniRole}>{isAdmin ? '관리자' : '사용자'}</div>
              </div>
            </div>
          </div>
        </aside>

        <main style={styles.mainArea}>
          <div style={styles.headerBox}>
            <div>
              <h1 style={styles.pageTitle}>
                <span style={{ color: COLORS.blue }}>EverOn</span> Care Hub
              </h1>
              <div style={styles.pageDesc}>운영 현황, 현재 상태, 조치 진행 상황을 전체적으로 확인합니다.</div>
              <div style={styles.loginInfo}>
                로그인 계정: <strong>{currentUser?.email || '-'}</strong>
                {isAdmin ? ' / 관리자' : ''}
              </div>
            </div>
            <div style={styles.headerActions}>
              <label style={styles.primaryButton}>
                <span style={styles.buttonInner}><IconUpload /> 파일 업로드</span>
                <input type="file" accept=".xlsx,.xls,.csv" multiple onChange={handleFiles} style={{ display: 'none' }} />
              </label>
              <button style={styles.outlineButton} onClick={() => supabase.auth.signOut()}>
                <span style={styles.buttonInner}><IconLogout /> 로그아웃</span>
              </button>
              <button style={styles.outlineButton} onClick={resetAll}>
                <span style={styles.buttonInner}><IconRefresh /> 초기화</span>
              </button>
            </div>
          </div>

          {isRestoring && <div style={styles.alertBox}>저장된 파일을 불러오는 중입니다...</div>}
          {!mergedRows.length && !isRestoring && (
            <div style={styles.alertBox}>먼저 충전기_상태정보_리스트 파일을 업로드해주세요.</div>
          )}

          <div style={styles.mobileTabRow}>
            {navItems.map((item) => (
              <button key={item.key} style={tab === item.key ? styles.tabActive : styles.tab} onClick={() => setTab(item.key)}>
                {item.label}
              </button>
            ))}
          </div>

          {tab === 'dashboard' && (
            <>
              <div style={styles.cardGrid}>
                <StatCard title="전체 충전기" value={`${dashboard.total.toLocaleString()}기`} sub="RAW C열 충전기 ID 기준" />
                <StatCard
                  title="승인대기"
                  value={`${dashboard.approvalPending.toLocaleString()}기`}
                  sub="수집일 공백 또는 수집이 멈춘 상태 중 누적사용량 30 이하"
                />
                <StatCard title="정상 운영" value={`${dashboard.normalOperation.toLocaleString()}기`} sub="전체 충전기 - 승인대기" />
                <StatCard title="고장 충전기" value={`${dashboard.faultCount.toLocaleString()}기`} sub={`고장률 ${dashboard.faultRate}%`} />
                <StatCard
                  title="VOC 조치 예정"
                  value={`${dashboard.vocPending.toLocaleString()}기`}
                  sub={`재발생 ${dashboard.vocRecurring.toLocaleString()}기 / 장기 미조치 ${dashboard.vocLongPending.toLocaleString()}기 / 과다이상 ${dashboard.vocOverAbnormal.toLocaleString()}기`}
                />
                <StatCard
                  title="미인입 고장"
                  value={`${dashboard.uninbound.toLocaleString()}기`}
                  sub="임의 OFF / VOC 조치 예정 / 교체 예정 제외"
                />
              </div>

              <div style={styles.middleGrid}>
                <StatCard title="교체 예정" value={`${dashboard.replacement.toLocaleString()}기`} sub="교체건 파일 매칭 기준" />
                <StatCard title="임의 OFF" value={`${dashboard.manualOff.toLocaleString()}기`} sub="충전기 중 충전상태 기준" />
                <div style={{ ...styles.panel, overflow: 'visible' }}>
                  <div style={styles.sectionTitle}>고장 분류</div>
                  <DonutChart dashboard={dashboard} />
                </div>
              </div>

              <div style={styles.topGrid}>
                <div style={styles.panel}>
                  <div style={styles.sectionTitle}>판정 기준</div>
                  <div style={styles.infoLargeBox}>
                    <div style={styles.infoLargeIconWrap}>
                      <MetricIcon type="date" color={COLORS.slate} />
                    </div>
                    <div style={styles.infoLargeText}>
                      기준 파일일시: <strong>{rawState?.faultCutoff ? formatDate(rawState.faultCutoff) : '-'}</strong>
                    </div>
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

              <div style={styles.topGrid}>
                <div style={{ ...styles.panel, maxHeight: 220, overflowY: 'auto' }}>
                  <div style={styles.sectionTitle}>산정 기준</div>
                  <ul style={styles.guideList}>
                    <li>RAW 상태정보 파일은 4행 헤더, 5행부터 데이터를 읽습니다.</li>
                    <li>전체 충전기 수는 RAW C열 충전기 ID 기준입니다.</li>
                    <li>승인대기는 수집일 공백 또는 수집이 멈춘 상태 중 누적사용량 30 이하입니다.</li>
                    <li>고장 산정은 파일명 기준 시각인 07:00 이전 수집값 또는 과다이상 기준입니다.</li>
                    <li>VOC 처리중은 완료자명과 완료자 소속이 모두 공백인 기준입니다.</li>
                    <li>장기 미조치는 VOC 조치 예정 중 판정 기준일 대비 14일 이상 경과 건입니다.</li>
                  </ul>
                </div>
                <div style={{ ...styles.panel, maxHeight: 220, overflowY: 'auto' }}>
                  <div style={styles.sectionTitle}>최근 반영 로그</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {logs.length === 0 ? (
                      <div style={{ color: COLORS.sub }}>아직 업로드된 파일이 없습니다.</div>
                    ) : (
                      logs.map((log, idx) => (
                        <div key={`${log}-${idx}`} style={styles.logItem}>
                          {log}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {tab === 'details' && (
            <div style={styles.panel}>
              <div style={styles.sectionTitleRow}>
                <div style={styles.sectionTitleNoMargin}>상세내역</div>
                <button style={styles.secondaryButton} onClick={downloadDetailsExcel}>
                  결과 엑셀 다운로드
                </button>
              </div>

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
                <div style={styles.countBox}>
                  결과 조회 <strong>{filteredRows.length.toLocaleString()}건</strong>
                </div>
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
                      <div style={{ fontWeight: 800, marginBottom: 8 }}>최근 조치 이력</div>
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
                <select
                  style={{ ...styles.select, marginBottom: 16, maxWidth: 220 }}
                  value={orgFilter}
                  onChange={(e) => setOrgFilter(e.target.value)}
                >
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
                <div style={styles.sectionTitleRow}>
                  <div style={styles.sectionTitleNoMargin}>부품 교체 내역</div>
                  <button style={styles.secondaryButton} onClick={downloadVocPartsExcel}>
                    리스트 엑셀 다운로드
                  </button>
                </div>
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

          {tab === 'admin' && isAdmin && (
            <div style={styles.vocLayout}>
              <div style={styles.panel}>
                <div style={styles.sectionTitleRow}>
                  <div style={styles.sectionTitleNoMargin}>사용자 승인 관리</div>
                  <button style={styles.secondaryButton} onClick={fetchProfiles}>
                    새로고침
                  </button>
                </div>

                <div style={{ color: COLORS.sub, fontSize: 13, marginBottom: 16 }}>
                  회원가입한 사용자는 승인 전까지 로그인 후 사용이 제한됩니다.
                </div>

                <div style={styles.summaryGrid2}>
                  <div style={styles.summaryBox}>승인 완료 <strong>{profiles.filter((p) => p.approved).length}명</strong></div>
                  <div style={styles.summaryBox}>승인 대기 <strong>{profiles.filter((p) => !p.approved).length}명</strong></div>
                </div>
              </div>

              <div style={styles.panel}>
                <div style={styles.sectionTitle}>사용자 목록</div>
                {profilesLoading ? (
                  <div style={{ color: COLORS.sub }}>사용자 목록을 불러오는 중입니다...</div>
                ) : (
                  <div style={styles.tableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={{ width: '30%' }}>이메일</th>
                          <th style={{ width: '15%' }}>승인여부</th>
                          <th style={{ width: '15%' }}>관리자</th>
                          <th style={{ width: '20%' }}>생성일시</th>
                          <th style={{ width: '20%' }}>관리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profiles.map((profile) => (
                          <tr key={profile.id}>
                            <td>{profile.email || '-'}</td>
                            <td>{profile.approved ? '승인 완료' : '승인 대기'}</td>
                            <td>{profile.is_admin ? '관리자' : '-'}</td>
                            <td>{profile.created_at ? formatDate(new Date(profile.created_at)) : '-'}</td>
                            <td>
                              <div style={styles.actionButtonWrap}>
                                {!profile.approved ? (
                                  <button style={styles.approveButton} onClick={() => approveUser(profile.id)}>
                                    승인
                                  </button>
                                ) : (
                                  <button
                                    style={styles.revokeButton}
                                    onClick={() => revokeUser(profile.id)}
                                    disabled={profile.email === currentUser?.email}
                                    title={profile.email === currentUser?.email ? '본인 계정은 승인 해제 불가' : ''}
                                  >
                                    승인 해제
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {profiles.length === 0 && (
                          <tr>
                            <td colSpan="5">등록된 사용자가 없습니다.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    width: '100%',
    background: 'linear-gradient(180deg, #eef2f7 0%, #e9eef5 100%)',
    padding: 16,
    color: COLORS.text,
    fontFamily: 'Arial, sans-serif',
    boxSizing: 'border-box',
  },
  pageCenter: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: COLORS.bg,
    padding: 24,
    fontFamily: 'Arial, sans-serif',
  },
  simpleAlert: {
    background: COLORS.panel,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 18,
    padding: 20,
    boxShadow: COLORS.shadow,
    fontWeight: 700,
  },
  appShell: {
    width: '100%',
    minHeight: 'calc(100vh - 32px)',
    margin: '0',
    display: 'grid',
    gridTemplateColumns: '220px minmax(0, 1fr)',
    background: 'rgba(255,255,255,0.42)',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 28,
    overflow: 'hidden',
    boxShadow: '0 16px 50px rgba(15, 23, 42, 0.08)',
    backdropFilter: 'blur(12px)',
  },
  sidebar: {
    background: '#f8fbff',
    borderRight: `1px solid ${COLORS.border}`,
    padding: 22,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: '100%',
  },
  brandBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 26,
  },
  brandShieldWrap: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
  brandShield: {
    width: 38,
    height: 38,
    borderRadius: 12,
    background: COLORS.blueSoft,
    color: COLORS.blue,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: { fontSize: 20, fontWeight: 800, lineHeight: 1.05 },
  brandTitleSub: { fontSize: 20, fontWeight: 800, lineHeight: 1.05 },
  sideNavWrap: { display: 'grid', gap: 10 },
  sideNavItem: {
    position: 'relative',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    border: `1px solid transparent`,
    background: 'transparent',
    color: COLORS.slate,
    padding: '14px 14px',
    borderRadius: 14,
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'left',
  },
  sideNavActive: {
    position: 'relative',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    border: `1px solid ${COLORS.blueSoft}`,
    background: COLORS.blueSoft,
    color: COLORS.blue,
    padding: '14px 14px',
    borderRadius: 14,
    fontWeight: 800,
    cursor: 'pointer',
    textAlign: 'left',
    boxShadow: 'inset 0 0 0 1px rgba(29, 99, 233, 0.04)',
  },
  sideNavIcon: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22 },
  sideNavActiveBar: {
    position: 'absolute',
    right: 0,
    top: 10,
    bottom: 10,
    width: 4,
    borderRadius: 999,
    background: COLORS.blue,
  },
  sidebarBottom: { display: 'grid', gap: 14 },
  sidebarLogoutButton: {
    width: '100%',
    background: COLORS.panel,
    color: COLORS.slate,
    border: `1px solid ${COLORS.border}`,
    padding: '12px 16px',
    borderRadius: 14,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    boxShadow: '0 4px 16px rgba(15,23,42,0.04)',
  },
  userMiniCard: {
    background: COLORS.blueSoft,
    border: `1px solid #dbe9ff`,
    borderRadius: 16,
    padding: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  userMiniIcon: {
    width: 28,
    height: 28,
    borderRadius: 999,
    background: '#d8e7ff',
    color: COLORS.blue,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  userMiniEmail: { fontSize: 12, color: COLORS.slate, wordBreak: 'break-all', lineHeight: 1.35 },
  userMiniRole: { fontSize: 13, color: COLORS.slate, marginTop: 4, fontWeight: 700 },
  mainArea: {
    padding: 30,
    minWidth: 0,
    width: '100%',
    boxSizing: 'border-box',
  },
  headerBox: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    flexWrap: 'wrap',
    paddingBottom: 18,
    marginBottom: 18,
  },
  pageTitle: { margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em' },
  pageDesc: { marginTop: 10, color: COLORS.sub, fontSize: 14 },
  loginInfo: { marginTop: 22, color: COLORS.sub, fontSize: 13 },
  headerActions: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  buttonInner: { display: 'inline-flex', alignItems: 'center', gap: 8 },
  primaryButton: {
    background: COLORS.blue,
    color: '#fff',
    padding: '14px 18px',
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 800,
    boxShadow: '0 10px 24px rgba(29, 99, 233, 0.24)',
  },
  outlineButton: {
    background: COLORS.panel,
    color: COLORS.slate,
    border: `1px solid ${COLORS.border}`,
    padding: '14px 18px',
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 700,
    boxShadow: '0 4px 16px rgba(15,23,42,0.04)',
  },
  secondaryButton: {
    background: COLORS.panel,
    color: COLORS.text,
    border: `1px solid ${COLORS.border}`,
    padding: '10px 14px',
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  approveButton: {
    background: COLORS.green,
    color: '#fff',
    border: 'none',
    padding: '8px 12px',
    borderRadius: 10,
    cursor: 'pointer',
    fontWeight: 700,
  },
  revokeButton: {
    background: '#fff',
    color: COLORS.red,
    border: `1px solid ${COLORS.red}`,
    padding: '8px 12px',
    borderRadius: 10,
    cursor: 'pointer',
    fontWeight: 700,
  },
  mobileTabRow: { display: 'none' },
  alertBox: {
    background: '#eff6ff',
    color: '#1d4ed8',
    border: '1px solid #bfdbfe',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    fontWeight: 700,
  },
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 18, marginBottom: 18 },
  middleGrid: {
    display: 'grid',
    gridTemplateColumns: '240px 240px minmax(980px, 1fr)',
    gap: 18,
    marginBottom: 18,
    alignItems: 'stretch',
  },
  topGrid: { display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(320px, 1fr)', gap: 18, marginBottom: 18 },
  panel: {
    background: COLORS.panel,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 22,
    padding: 22,
    boxShadow: COLORS.shadow,
    minWidth: 0,
  },
  card: {
    position: 'relative',
    background: COLORS.panel,
    borderRadius: 22,
    padding: 22,
    minHeight: 140,
    overflow: 'hidden',
  },
  cardTopRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  cardTitle: { fontSize: 14, fontWeight: 800, marginBottom: 4 },
  cardValue: { fontSize: 30, fontWeight: 800, marginBottom: 12, letterSpacing: '-0.02em' },
  cardSub: { fontSize: 13, color: COLORS.sub, lineHeight: 1.55, maxWidth: '82%' },
  metricIconWrap: {
    width: 62,
    height: 62,
    borderRadius: 999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardAccent: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 4,
  },
  sectionTitle: { fontSize: 17, fontWeight: 800, marginBottom: 16 },
  sectionTitleNoMargin: { fontSize: 17, fontWeight: 800 },
  sectionTitleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' },
  donutLayout: {
    display: 'grid',
    gridTemplateColumns: '320px minmax(440px, 1fr)',
    gap: 24,
    alignItems: 'center',
    minWidth: 0,
  },
  donutWrap: { display: 'flex', justifyContent: 'center', alignItems: 'center' },
  donut: { width: 240, height: 240, borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center' },
  donutInner: {
    width: 132,
    height: 132,
    borderRadius: '50%',
    background: '#fff',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column',
    boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.06)',
  },
  donutLabel: { fontSize: 13, color: COLORS.sub },
  donutValue: { fontSize: 22, fontWeight: 800, marginTop: 4 },
  legendItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    background: '#f8fbff',
    border: `1px solid ${COLORS.line}`,
    borderRadius: 12,
    padding: '13px 16px',
    minWidth: 0,
    width: '100%',
    boxSizing: 'border-box',
  },
  infoLargeBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    background: '#f8fbff',
    border: `1px solid ${COLORS.line}`,
    borderRadius: 16,
    padding: 22,
    minHeight: 84,
  },
  infoLargeIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 14,
    background: '#eef3fb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoLargeText: { color: COLORS.slate, fontSize: 16 },
  summaryGrid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  summaryBox: {
    background: '#f8fbff',
    border: `1px solid ${COLORS.line}`,
    borderRadius: 16,
    padding: 16,
    fontSize: 14,
    color: COLORS.slate,
    lineHeight: 1.5,
  },
  guideList: { margin: 0, paddingLeft: 18, lineHeight: 1.9, color: COLORS.sub, fontSize: 14 },
  logItem: {
    background: '#f8fbff',
    border: `1px solid ${COLORS.line}`,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: COLORS.slate,
  },
  filterRowWide: { display: 'grid', gridTemplateColumns: '1.4fr 1fr 0.9fr 1fr 0.9fr', gap: 12, marginBottom: 16 },
  input: {
    width: '100%',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 12,
    padding: '12px 16px',
    fontSize: 14,
    boxSizing: 'border-box',
    background: '#fff',
    outline: 'none',
  },
  inputNarrow: {
    width: '100%',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 12,
    padding: '12px 16px',
    fontSize: 14,
    boxSizing: 'border-box',
    background: '#fff',
    outline: 'none',
  },
  select: {
    width: '100%',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 12,
    padding: '12px 16px',
    fontSize: 14,
    background: '#fff',
    outline: 'none',
  },
  countBox: {
    background: '#f8fbff',
    border: `1px solid ${COLORS.line}`,
    borderRadius: 12,
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
  },
  tableWrap: { overflowX: 'auto', border: `1px solid ${COLORS.border}`, borderRadius: 16 },
  table: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 14 },
  searchGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  searchCard: {
    border: `1px solid ${COLORS.border}`,
    borderRadius: 20,
    background: '#fff',
    padding: 18,
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)',
  },
  searchHeader: { display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  searchTitle: { fontSize: 20, fontWeight: 800 },
  searchSub: { marginTop: 6, color: COLORS.sub, fontSize: 14 },
  searchLine: { marginBottom: 8, color: COLORS.sub, fontSize: 14, lineHeight: 1.5 },
  historyLine: {
    fontSize: 13,
    color: COLORS.sub,
    background: '#f8fbff',
    border: `1px solid ${COLORS.line}`,
    borderRadius: 10,
    padding: '8px 10px',
  },
  noHistory: {
    fontSize: 13,
    color: COLORS.sub,
    background: '#f8fbff',
    border: `1px solid ${COLORS.line}`,
    borderRadius: 10,
    padding: '8px 10px',
  },
  tagBlue: {
    background: '#eff6ff',
    color: COLORS.blue,
    borderRadius: 999,
    padding: '8px 12px',
    fontSize: 13,
    fontWeight: 700,
    height: 'fit-content',
    whiteSpace: 'nowrap',
    border: '1px solid #dbeafe',
  },
  tagYellow: {
    background: '#fffbeb',
    color: COLORS.yellow,
    borderRadius: 999,
    padding: '8px 12px',
    fontSize: 13,
    fontWeight: 700,
    height: 'fit-content',
    whiteSpace: 'nowrap',
    border: '1px solid #fde68a',
  },
  tagRed: {
    background: '#fef2f2',
    color: COLORS.red,
    borderRadius: 999,
    padding: '8px 12px',
    fontSize: 13,
    fontWeight: 700,
    height: 'fit-content',
    whiteSpace: 'nowrap',
    border: '1px solid #fecaca',
  },
  vocLayout: { display: 'grid', gap: 16 },
  dateFilterRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  partSummaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  actionButtonWrap: { display: 'flex', gap: 8, justifyContent: 'center' },
};

