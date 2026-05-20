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
  orange: '#f97316',
  orangeSoft: '#fff2e8',
  darkGray: '#111827',
  darkGraySoft: '#e5e7eb',
  lightGray: '#cbd5e1',
  lightGraySoft: '#f1f5f9',
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


const MODEL_TYPE_MAP = {
  'EVL-1C07027A01': '에버온_구형대',
  'EVL-1C07027A01_미사용': '에버온_구형대',
  'EVL-1107027A01': '에버온_신형대',
  'EVL-1107020C01': '에버온_신형소C01',
  'EVL-1107020F01': '에버온_신형소F01',
  'EVL-10073N': '에버온_73N+',
  'EVL-1103000901': '에버온_3kW',
  'EVL-3J1002A01': '에버온_10kW',
  'EVL-3J1002B01': '에버온_10kW',
  'UK-NC7W-ST7-CH': '알박_구형',
  'UK-NC7W-TC/E-AB': '알박_구형',
  'UK-NC7W-TC/E-CH': '알박_구형',
  'UK-NC7W-TC/E-LE': '알박_구형',
  'UK-NC7W-TC/E-SC': '알박_구형',
  'UK-NC7W-TC/E-ST5': '알박_구형',
  'UK-NC7S01-002': '알박_신형',
  'UK-QC50ST': '알박_급속',
  'SC7K-F-WT-G2': '시그넷_완속',
  'FC100K-B2-PS-G5': '시그넷_급속',
  'FC200K-B2-PS-G2': '시그넷_급속',
  'CPT11C1-ETW': '이카플러그_완속',
  'CPT22C2-ETW': '이카플러그_완속',
  'CPW102AS': '이카플러그_완속',
  'CPW102B': '이카플러그_완속',
  'S0L140AA02A021': '스필_완속_양팔형',
  'S0L1401A02A021': '스필_완속_양팔형',
  'S0F500DC02A031': '스필_완속',
  'S0L0701A01A021': '스필_완속',
  'S0W0701A011011': '스필_완속',
  'S0F500BDC1A031': '스필_급속',
  'S0W0701A01A011': '스필_완속',
  'SVI0L07VBCCB2107005': '스필_완속',
  'SOL0701A01A021': '스필_완속',
  'SOL1401A02A021': '스필_완속',
  'SOL140AA02A021': '스필_완속',
  'SOW0701A011011': '스필_완속',
  'SOW0701A01A011': '스필_완속',
  'SOF101DC02A031': '스필_급속',
  'SOF500BDC1A031': '스필_급속',
  'SOF500DC02A031': '스필_급속',
  'SOF500DD02A031': '스필_급속',
  'SOF101DD02A031': '스필_급속',
  'SVI-0F': '스필_급속',
  'SVI-0F_OCPP': '스필_급속',
  'S0F101DD02A031': '스필_급속',
  'S0F500DD02A031': '스필_급속',
  'S0F101DC02A031': '스필_급속',
  'EVS_21S_L': 'PNE_완속',
  'MAXERO-007SC-1AT8R': 'PNE_완속',
  'MAXERO-200QC': 'PNE_급속',
  'DP150C2-2C': 'PNE_급속',
  'EVQ-11S-LHW': 'PNE_급속',
  'EVQ-2FS-100B': 'PNE_급속',
  'EVQ-1AS-100B': 'PNE_급속',
  'EVQ-31S-LHP': 'PNE_급속',
  'EVQ-31S-LHW_LEGACY': 'PNE_급속',
  'EVQ-31S-LHW_OCPP': 'PNE_급속',
  'JC-6511JA-PP-BC': '중앙제어_완속',
  'JC-6111JA-PP-BC': '중앙제어_완속',
  'JC-6933-TM': '중앙제어_급속',
  'AM-FCD-200-02': '애플망고_급속',
  'AM-FCD-200-02_OCPP': '애플망고_급속',
  'CFC-0510BR1': '코스텔_급속',
  'CEC-0510BR1': '코스텔_급속',
  'SFC-D101D-330': '그린파워_급속',
  'SFC-S050S-300': '그린파워_급속',
};

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}


function normalizeModelName(value) {
  return normalizeText(value).toUpperCase();
}

function getChargerType(modelName) {
  const normalized = normalizeModelName(modelName);
  if (!normalized) return '기타';

  const exactKey = Object.keys(MODEL_TYPE_MAP).find((key) => normalizeModelName(key) === normalized);
  if (exactKey) return MODEL_TYPE_MAP[exactKey];

  const partialKey = Object.keys(MODEL_TYPE_MAP)
    .sort((a, b) => b.length - a.length)
    .find((key) => normalized.includes(normalizeModelName(key)) || normalizeModelName(key).includes(normalized));

  return partialKey ? MODEL_TYPE_MAP[partialKey] : '기타';
}

function isFastChargerType(chargerType) {
  return /_급속$/.test(normalizeText(chargerType));
}

function getChargerSpeedGroup(row) {
  const type = row?.chargerType || getChargerType(row?.modelName);
  return isFastChargerType(type) ? 'fast' : 'slow';
}

function getChargerSpeedLabel(speed) {
  if (speed === 'all') return '전체';
  return speed === 'fast' ? '급속' : '완속';
}

function getManufacturerGroupFromType(chargerType) {
  const type = normalizeText(chargerType);
  if (!type || type === '-') return '기타';

  const maker = type.split('_')[0]?.trim();
  return maker || '기타';
}

function getManufacturerGroup(row) {
  const type = row?.chargerType || getChargerType(row?.modelName);
  return getManufacturerGroupFromType(type);
}

function isValidChargerReplacement(text) {
  const normalized = normalizeText(text);
  const hasChargerReplace = /충전기\s?교체/i.test(normalized);
  const hasExcludeWord = /교체\s?필요/i.test(normalized);
  return hasChargerReplace && !hasExcludeWord;
}

function isPartReplacementContent(value) {
  const text = normalizeText(value);
  if (!text) return false;

  if (text.includes('부품교체')) return true;

  return Object.entries(PART_PATTERNS).some(([name, regex]) => {
    if (name === '충전기') {
      return isValidChargerReplacement(text);
    }
    return regex.test(text);
  });
}

function calculateVocHistoryStats(matches = []) {
  const events = matches
    .filter((item) => item && (item.receivedAt || item.completedAt || item.isCompleted || item.completedContent))
    .map((item, index) => {
      const receivedMs = item.receivedAt?.getTime?.() ?? item.completedAt?.getTime?.() ?? Number.MAX_SAFE_INTEGER - index;
      const completedMs = item.completedAt?.getTime?.() ?? null;
      return {
        ...item,
        _sortIndex: index,
        _receivedMs: receivedMs,
        _completedMs: completedMs,
        _isPartReplacement: item.isCompleted && isPartReplacementContent(item.completedContent),
      };
    })
    .sort((a, b) => {
      const diff = a._receivedMs - b._receivedMs;
      return diff !== 0 ? diff : a._sortIndex - b._sortIndex;
    });

  const cycles = [];
  let currentCycle = null;
  let partReplaceCount = 0;

  const createCycle = (event) => ({
    inboundCount: 1,
    completedRows: event.isCompleted ? 1 : 0,
    completionMs: event._completedMs,
  });

  for (const event of events) {
    if (event._isPartReplacement) partReplaceCount += 1;

    if (!currentCycle) {
      currentCycle = createCycle(event);
      continue;
    }

    const hasClosedCycle = currentCycle.completionMs !== null && event._receivedMs > currentCycle.completionMs;

    if (hasClosedCycle) {
      cycles.push(currentCycle);
      currentCycle = createCycle(event);
    } else {
      currentCycle.inboundCount += 1;
      if (event.isCompleted) currentCycle.completedRows += 1;
      if (event._completedMs !== null) {
        currentCycle.completionMs = currentCycle.completionMs === null
          ? event._completedMs
          : Math.max(currentCycle.completionMs, event._completedMs);
      }
    }
  }

  if (currentCycle) cycles.push(currentCycle);

  const recurrenceCount = cycles.filter((cycle) => cycle.completedRows > 0).length;
  const reinboundCount = cycles.reduce((max, cycle) => Math.max(max, cycle.inboundCount || 0), 0);

  return {
    recurrenceCount,
    reinboundCount,
    partReplaceCount,
  };
}

function normalizeId(value) {
  return normalizeText(value).replace(/[^0-9-]/g, '');
}

function baseId13(value) {
  const id = normalizeId(value);
  return id ? id.slice(0, 13) : '';
}

function findChargerIdInRow(row) {
  for (const cell of row || []) {
    const text = normalizeText(cell);
    if (!text) continue;
    const match = text.match(/\d{13}(?:-\d{1,2})?/);
    if (match) return normalizeId(match[0]);
  }
  return '';
}

function normalizeSiteName(value) {
  return normalizeText(value).replace(/\s+/g, '');
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(String(value).replace(/,/g, '').trim());
  return Number.isNaN(num) ? null : num;
}

// VOC 엑셀 S열은 0부터 시작하는 배열 기준 18번 인덱스입니다.
// 정렬 기준은 반드시 이 S열의 누적충전량을 우선으로 사용합니다.
const VOC_CUMULATIVE_CHARGE_INDEX = 18;

function parseLooseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const text = String(value)
    .replace(/,/g, '')
    .replace(/kwh/gi, '')
    .replace(/㎾h/gi, '')
    .replace(/kw/gi, '')
    .trim();

  if (!text) return null;

  // 숫자, 문자 혼합값 모두 대응: 예) 12,345 / 12345kWh / 누적 12345.6
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;

  const num = Number(match[0]);
  return Number.isFinite(num) ? num : null;
}

function getVocCumulativeCharge(row, primaryIndex) {
  // 사용자가 지정한 기준: VOC접수건 엑셀 S열(배열 인덱스 18)
  // 기존처럼 T~W열까지 훑으면 완료자명/완료내용 날짜 숫자를 잘못 잡아 엉뚱한 순서가 될 수 있어 제거했습니다.
  const sColumnValue = parseLooseNumber(row[VOC_CUMULATIVE_CHARGE_INDEX]);
  if (sColumnValue !== null) return sColumnValue;

  // 혹시 파일 양식이 바뀌어 헤더에서 누적충전량 위치가 별도로 잡힌 경우만 보조 사용합니다.
  if (primaryIndex >= 0 && primaryIndex !== VOC_CUMULATIVE_CHARGE_INDEX) {
    const headerMatchedValue = parseLooseNumber(row[primaryIndex]);
    if (headerMatchedValue !== null) return headerMatchedValue;
  }

  return null;
}

function formatCumulativeCharge(value) {
  const num = parseLooseNumber(value);
  if (num === null) return '-';
  return num.toLocaleString();
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

function formatDateInputValue(date) {
  if (!date || Number.isNaN(date.getTime?.())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getRecentWeekDateRange() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  return {
    start: formatDateInputValue(start),
    end: formatDateInputValue(end),
  };
}

function formatShortDate(date) {
  if (!date || Number.isNaN(date.getTime?.())) return '-';
  const y = String(date.getFullYear()).slice(-2);
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function compactModelLabel(value) {
  const text = normalizeText(value);
  if (!text || text === '-') return '-';
  return text.replace(/^에버온_/, '').replace(/_/g, ' ');
}


function shortAddress(value) {
  const text = normalizeText(value);
  if (!text) return '-';
  return text.slice(0, 2);
}

function getSidoName(value) {
  const text = normalizeText(value);
  if (!text || text === '-') return '지역 미기재';

  const compact = text.replace(/\s+/g, '');
  const rules = [
    [/서울/, '서울'],
    [/경기/, '경기'],
    [/인천/, '인천'],
    [/대전/, '대전'],
    [/세종/, '세종'],
    [/충청북도|충북/, '충북'],
    [/충청남도|충남/, '충남'],
    [/부산/, '부산'],
    [/대구/, '대구'],
    [/울산/, '울산'],
    [/경상북도|경북/, '경북'],
    [/경상남도|경남/, '경남'],
    [/광주/, '광주'],
    [/전북특별자치도|전라북도|전북/, '전북'],
    [/전라남도|전남/, '전남'],
    [/강원특별자치도|강원도|강원/, '강원'],
    [/제주특별자치도|제주도|제주/, '제주'],
  ];

  const found = rules.find(([regex]) => regex.test(compact));
  if (found) return found[1];

  return text.slice(0, 2) || '지역 미기재';
}

function getRegionGroup(value) {
  const sido = getSidoName(value);
  if (['서울', '경기', '인천'].includes(sido)) return '수도권';
  if (['대전', '세종', '충북', '충남'].includes(sido)) return '충청권';
  if (['부산', '대구', '울산', '경북', '경남'].includes(sido)) return '경상권';
  if (['광주', '전북', '전남'].includes(sido)) return '전라권';
  if (sido === '강원') return '강원권';
  if (sido === '제주') return '제주권';
  return '지역 미기재';
}

function extractPartNamesFromContent(value) {
  const text = normalizeText(value);
  if (!text) return [];

  return Object.entries(PART_PATTERNS)
    .filter(([name, regex]) => {
      if (name === '충전기') return isValidChargerReplacement(text);
      return regex.test(text);
    })
    .map(([name]) => name);
}

function summarizeAfterContent(value) {
  const text = normalizeText(value);
  if (!text) return '-';

  // 예: 260417 김현수 / 20260417 김현수 형태만 간단히 표시
  const headerMatch = text.match(/((?:\d{6}|\d{8})\s+[^\s\[]+)/);
  const header = headerMatch ? headerMatch[1] : '';

  const parts = extractPartNamesFromContent(text);

  let result = '';
  if (/정상\s?충전|정상\s?동작|정상처리|정상\s?확인/i.test(text)) {
    result = '정상충전 확인';
  } else if (/교체/i.test(text)) {
    result = '부품 교체';
  }

  const summary = [
    header ? `📌 ${header}` : '',
    parts.length ? `🔧 ${parts.join(', ')}` : '',
    result ? `✅ ${result}` : '',
  ].filter(Boolean);

  if (summary.length > 0) return summary.join('\n');

  return text.length > 80 ? `${text.slice(0, 80)}...` : text;
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
    siteId: findHeaderIndex(headers, ['충전소ID', '충전소 Id', '충전소 id', '사이트ID', 'site_id']) >= 0
      ? findHeaderIndex(headers, ['충전소ID', '충전소 Id', '충전소 id', '사이트ID', 'site_id'])
      : 0,
    modelName: findHeaderIndex(headers, ['모델명', '모델 명', 'model']) >= 0
      ? findHeaderIndex(headers, ['모델명', '모델 명', 'model'])
      : 29, // 상태정보 리스트 AD열
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
      const modelName = col.modelName >= 0 ? normalizeText(row[col.modelName]) : '';
      const chargerType = getChargerType(modelName);
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
        modelName,
        chargerType,
        isApprovalPending,
        isNormalOperation,
        isFault,
        isStopped,
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
  const withFallback = (candidates, fallback) => {
    const idx = findHeaderIndex(headers, candidates);
    return idx >= 0 ? idx : fallback;
  };

  return {
    matchId: withFallback(['충전기ID', '충전기 ID', '충전기번호', '충전기 번호', '매칭ID', 'matchId'], 13),
    siteName: withFallback(['충전소명', '현장명', '사이트명'], 14),
    progressName: withFallback(['진행 담당자', '진행담당자', '담당자명'], 15),
    progressOrg: withFallback(['진행 담당자 소속', '진행담당자 소속', '진행 소속'], 16),
    completedAt: withFallback(['완료일시', '완료 일시'], 17),
    completedName: withFallback(['완료자명', '완료자 명', '완료 담당자'], 18),
    completedOrg: withFallback(['완료자 소속', '완료 소속'], 19),
    completedContent: withFallback(['완료내용', '완료 내용', '조치내용', '조치 내용'], 20),
    receivedAt: findHeaderIndex(headers, ['접수일', '접수일시']),
    cumulativeCharge: findHeaderIndex(headers, ['누적충전량', '누적 충전량', '누적 충전량(kWh)', '누적충전', '충전량']),
  };
}

function parseVocFile(rows) {
  const headerRow = rows[0] || [];
  const col = mapVocColumns(headerRow);
  if (col.receivedAt < 0) col.receivedAt = 1; // VOC B열 접수일시 fallback
  if (col.cumulativeCharge < 0) col.cumulativeCharge = VOC_CUMULATIVE_CHARGE_INDEX; // VOC S열 누적충전량 fallback

  return rows
    .slice(1)
    .map((row) => {
      const matchId = normalizeId(row[col.matchId]) || findChargerIdInRow(row);
      const siteName = normalizeText(row[col.siteName]);
      const completedName = normalizeText(row[col.completedName]);
      const completedOrg = normalizeText(row[col.completedOrg]);
      const progressName = normalizeText(row[col.progressName]);
      const progressOrg = normalizeText(row[col.progressOrg]);
      const completedContent = normalizeText(row[col.completedContent]);
      const completedAt = parseDateValue(row[col.completedAt]);
      const receivedAt = col.receivedAt >= 0 ? parseDateValue(row[col.receivedAt]) : null;
      const cumulativeCharge = getVocCumulativeCharge(row, col.cumulativeCharge);

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
        cumulativeCharge,
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

  const allVocByExactId = new Map();
  const allVocByBaseId = new Map();
  const allVocBySite = new Map();

  const cumulativeByExactId = new Map();
  const cumulativeByBaseId = new Map();
  const cumulativeBySite = new Map();

  const pushMap = (map, key, value) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(value);
  };

  const setMaxNumber = (map, key, value) => {
    if (!key || value === null || value === undefined) return;
    const prev = map.get(key);
    if (prev === undefined || value > prev) map.set(key, value);
  };

  for (const v of vocRows) {
    pushMap(allVocByExactId, v.matchId, v);
    pushMap(allVocByBaseId, v.matchBaseId, v);
    pushMap(allVocBySite, v.matchSiteName, v);

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

    setMaxNumber(cumulativeByExactId, v.matchId, v.cumulativeCharge);
    setMaxNumber(cumulativeByBaseId, v.matchBaseId, v.cumulativeCharge);
    setMaxNumber(cumulativeBySite, v.matchSiteName, v.cumulativeCharge);
  }

  const classifiedRows = rawRows.map((row) => {
    const normalizedSiteName = normalizeSiteName(row.siteName);

    const pendingExact = pendingByExactId.get(row.chargerId) || [];
    const pendingBase = pendingByBaseId.get(row.chargerBaseId) || [];
    const pendingSite = pendingBySite.get(normalizedSiteName) || [];
    const vocPendingMatches = pendingExact.length ? pendingExact : pendingBase.length ? pendingBase : pendingSite;

    const completedExact = completedByExactId.get(row.chargerId) || [];
    const completedBase = completedByBaseId.get(row.chargerBaseId) || [];
    const completedSite = completedBySite.get(normalizedSiteName) || [];
    const completedMatches = completedExact.length ? completedExact : completedBase.length ? completedBase : completedSite;

    const allExact = allVocByExactId.get(row.chargerId) || [];
    const allBase = allVocByBaseId.get(row.chargerBaseId) || [];
    const allSite = allVocBySite.get(normalizedSiteName) || [];
    const allVocMatches = allExact.length ? allExact : allBase.length ? allBase : allSite;

    const historyStats = calculateVocHistoryStats(allVocMatches);

    const cumulativeCharge =
      cumulativeByExactId.get(row.chargerId) ??
      cumulativeByBaseId.get(row.chargerBaseId) ??
      cumulativeBySite.get(normalizedSiteName) ??
      row.usageCount ??
      null;

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

    const occurrenceCount = faultType === 'VOC 조치 예정' ? historyStats.recurrenceCount : 0;
    const reinboundCount = faultType === 'VOC 조치 예정' ? historyStats.reinboundCount : 0;
    const partReplaceCount = faultType === 'VOC 조치 예정' ? historyStats.partReplaceCount : 0;

    let recurrenceLabel = '-';
    if (faultType === 'VOC 조치 예정') {
      if (partReplaceCount >= 3) {
        recurrenceLabel = `부품교체 ${partReplaceCount}회`;
      } else if (reinboundCount >= 3) {
        recurrenceLabel = `재인입 ${reinboundCount}회`;
      } else if (occurrenceCount === 2) {
        recurrenceLabel = '2회 재발생';
      } else if (occurrenceCount === 3) {
        recurrenceLabel = '3회 재발생';
      } else if (occurrenceCount >= 4) {
        recurrenceLabel = '4회 이상';
      }
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
      reinboundCount,
      partReplaceCount,
      isLongPending,
      isVocOverAbnormal,
      cumulativeCharge,
      recentHistory,
    };
  });

  const siteGroupMap = new Map();

  classifiedRows.forEach((row) => {
    const siteKey = normalizeSiteName(row.siteName) || row.siteId || '충전소 미기재';
    if (!siteGroupMap.has(siteKey)) siteGroupMap.set(siteKey, []);
    siteGroupMap.get(siteKey).push(row);
  });

  const approvalOverrideSiteSet = new Set();

  siteGroupMap.forEach((siteRows, siteKey) => {
    if (!siteRows.length) return;

    const isAllFault = siteRows.every((row) => row.isFault);
    const isAllUninbound = siteRows.every((row) => row.faultType === '미인입 고장');
    const isTargetMaker = siteRows.every((row) => {
      const type = normalizeText(row.chargerType || getChargerType(row.modelName));
      return type.startsWith('알박') || type.startsWith('이카플러그');
    });

    // 추가 승인대기 기준:
    // 같은 충전소의 전체 충전기가 모두 수집중단 상태이고,
    // 각 충전기의 누적사용량이 각각 100 이하이면 승인대기로 분류합니다.
    // 단, 임의 OFF / 과다이상은 기존 우선순위 보호를 위해 제외합니다.
    const isAllStoppedAndEachLowUsage = siteRows.every((row) => (
      row.isStopped &&
      row.usageCount !== null &&
      row.usageCount !== undefined &&
      row.usageCount <= 100 &&
      !row.isManualOff &&
      !row.isOverAbnormal
    ));

    if ((isAllFault && isAllUninbound && isTargetMaker) || isAllStoppedAndEachLowUsage) {
      approvalOverrideSiteSet.add(siteKey);
    }
  });

  return classifiedRows.map((row) => {
    const siteKey = normalizeSiteName(row.siteName) || row.siteId || '충전소 미기재';

    if (!approvalOverrideSiteSet.has(siteKey)) return row;

    return {
      ...row,
      faultType: '',
      isFault: false,
      isFaultByCollected: false,
      isManualOffFault: false,
      isApprovalPending: true,
      isNormalOperation: false,
      recurrenceLabel: '-',
      occurrenceCount: 0,
      reinboundCount: 0,
      partReplaceCount: 0,
      isLongPending: false,
      isVocOverAbnormal: false,
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
      return { accent: COLORS.violet, soft: COLORS.violetSoft, icon: 'fault' };
    case 'VOC 조치 예정':
      return { accent: COLORS.red, soft: COLORS.redSoft, icon: 'voc' };
    case '미인입 고장':
      return { accent: COLORS.lightGray, soft: COLORS.lightGraySoft, icon: 'uninbound' };
    case '교체 예정':
    case '교체 진행중':
      return { accent: COLORS.orange, soft: COLORS.orangeSoft, icon: 'replacement' };
    case '임의 OFF':
      return { accent: COLORS.darkGray, soft: COLORS.darkGraySoft, icon: 'off' };
    default:
      return { accent: COLORS.blue, soft: COLORS.blueSoft, icon: 'charger' };
  }
}

function StatusDot({ row }) {
  if (row.isFault) return <span style={{ ...styles.statusNowrap, color: COLORS.red }}>● 고장</span>;
  if (row.isApprovalPending) return <span style={{ ...styles.statusNowrap, color: COLORS.yellow }}>● 승인대기</span>;
  return <span style={{ ...styles.statusNowrap, color: COLORS.blue }}>● 정상 운영</span>;
}

function displayFaultTypeName(type) {
  if (type === '교체 예정') return '교체 진행중';
  return type || '고장';
}

function isActiveFaultRow(row) {
  return !!row?.isFault;
}

function SearchStatusTag({ row }) {
  if (row.isFault) return <span style={styles.tagRed}>● {displayFaultTypeName(row.faultType)}</span>;
  if (row.isApprovalPending) return <span style={styles.tagYellow}>● 승인대기</span>;
  return <span style={styles.tagBlue}>● 정상 운영</span>;
}

function getCardGradient(title) {
  switch (title) {
    case '고장 충전기':
      return 'linear-gradient(135deg, #ffffff 0%, #faf5ff 54%, #f3e8ff 100%)';
    case 'VOC 조치 예정':
      return 'linear-gradient(135deg, #ffffff 0%, #fff1f2 56%, #fee2e2 100%)';
    case '미인입 고장':
      return 'linear-gradient(135deg, #ffffff 0%, #f8fafc 56%, #e5e7eb 100%)';
    case '임의 OFF':
      return 'linear-gradient(135deg, #ffffff 0%, #f3f4f6 54%, #d1d5db 100%)';
    case '교체 진행중':
    case '교체 예정':
      return 'linear-gradient(135deg, #ffffff 0%, #fff7ed 54%, #fed7aa 100%)';
    default:
      return COLORS.panel;
  }
}

function StatCard({ title, value, sub, onClick, compact = false }) {
  const meta = statusMeta(title);
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) onClick();
      }}
      style={{
        ...styles.card,
        ...(compact ? styles.compactCard : {}),
        background: getCardGradient(title),
        border: `1px solid ${meta.accent}55`,
        boxShadow: COLORS.shadow,
        cursor: onClick ? 'pointer' : 'default',
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

function HeroStatusCard({ title, value, sub, onClick }) {
  const meta = statusMeta(title);
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) onClick();
      }}
      style={{
        ...styles.heroStatusCard,
        border: `1px solid ${meta.accent}55`,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={styles.heroStatusBody}>
        <div>
          <div style={{ ...styles.heroStatusTitle, color: meta.accent }}>{title}</div>
          <div style={styles.heroStatusValue}>{value}</div>
          <div style={styles.heroStatusSub}>{sub}</div>
        </div>
        <div style={{ ...styles.heroMetricIconWrap, background: meta.soft }}>
          <MetricIcon type={meta.icon} color={meta.accent} />
        </div>
      </div>
      <div style={{ ...styles.cardAccent, background: meta.accent }} />
    </div>
  );
}

function TopMiniMetric({ title, value, sub, onClick }) {
  const meta = statusMeta(title);
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) onClick();
      }}
      style={{
        ...styles.topMiniMetric,
        borderLeft: `4px solid ${meta.accent}`,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={styles.topMiniTextArea}>
        <div style={{ ...styles.topMiniTitle, color: meta.accent }}>{title}</div>
        <div style={styles.topMiniSub}>{sub}</div>
      </div>
      <div style={styles.topMiniValue}>{value}</div>
    </div>
  );
}


function OperatingOverviewCard({ dashboard, onTotalClick }) {
  const total = dashboard.total || 0;
  const approvalRate = total > 0 ? Math.round((dashboard.approvalPending / total) * 1000) / 10 : 0;
  const normalRate = total > 0 ? Math.round((dashboard.normalOperation / total) * 1000) / 10 : 0;

  return (
    <div style={styles.operatingOverviewCard}>
      <div style={styles.operatingOverviewHeader}>
        <div>
          <div style={styles.operatingEyebrow}>전체 운영 상태</div>
        </div>
      </div>

      <div style={styles.operatingConnectedGrid}>
        <div
          style={{ ...styles.operatingSegment, ...styles.operatingSegmentTotal, cursor: 'pointer' }}
          onClick={onTotalClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onTotalClick();
          }}
        >
          <div style={styles.operatingSegmentIconTopRight}>
            <MetricIcon type="charger" color={COLORS.blue} />
          </div>
          <div style={{ ...styles.operatingSegmentTitle, color: COLORS.blue }}>전체 충전기</div>
          <div style={styles.operatingSegmentValue}>{dashboard.total.toLocaleString()}기</div>
        </div>

        <div style={{ ...styles.operatingSegment, ...styles.operatingSegmentApproval }}>
          <div style={{ ...styles.operatingSegmentTitle, color: COLORS.yellow }}>승인대기</div>
          <div style={styles.operatingSegmentValue}>{dashboard.approvalPending.toLocaleString()}기</div>
          <div style={styles.operatingSegmentSub}>전체 대비 {approvalRate}%</div>
        </div>

        <div style={{ ...styles.operatingSegment, ...styles.operatingSegmentNormal }}>
          <div style={{ ...styles.operatingSegmentTitle, color: COLORS.green }}>정상 운영</div>
          <div style={styles.operatingSegmentValue}>{dashboard.normalOperation.toLocaleString()}기</div>
          <div style={styles.operatingSegmentSub}>전체 대비 {normalRate}%</div>
        </div>
      </div>

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
      <div style={{ fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function DonutChart({ dashboard }) {
  const total = dashboard.faultCount;
  const data = [
    { name: '임의 OFF', value: dashboard.manualOff, color: COLORS.darkGray },
    { name: 'VOC 조치 예정', value: dashboard.vocPending, color: COLORS.red },
    { name: '미인입 고장', value: dashboard.uninbound, color: COLORS.lightGray },
    { name: '교체 진행중', value: dashboard.replacement, color: COLORS.orange },
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
      <div style={styles.donutLegendStack}>
        {data.map((item) => {
          const percent = total > 0 ? Math.round((item.value / total) * 1000) / 10 : 0;
          return (
            <LegendItem
              key={item.name}
              name={item.name}
              value={`${item.value.toLocaleString()}기 (${percent}%)`}
              color={item.color}
            />
          );
        })}
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
  const [detailModelFilter, setDetailModelFilter] = useState('all');
  const [recurrenceFilter, setRecurrenceFilter] = useState('all');
  const [longPendingFilter, setLongPendingFilter] = useState('all');
  const [sortFilter, setSortFilter] = useState('default');
  const [orgFilter, setOrgFilter] = useState('EV세상');
  const [vocPartStartDate, setVocPartStartDate] = useState(() => getRecentWeekDateRange().start);
  const [vocPartEndDate, setVocPartEndDate] = useState(() => getRecentWeekDateRange().end);
  const [vocPartCompareMode, setVocPartCompareMode] = useState('samePeriod');
  const [vocPerformanceStartDate, setVocPerformanceStartDate] = useState('');
  const [vocPerformanceEndDate, setVocPerformanceEndDate] = useState('');
  const [vocPerformanceSortFilter, setVocPerformanceSortFilter] = useState('rateDesc');
  const [isRestoring, setIsRestoring] = useState(true);
  const [summaryModalType, setSummaryModalType] = useState(null);

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

    const { data: existingProfile, error: existingProfileError } = await supabase
      .from('profiles')
      .select('id, approved, is_admin, email')
      .eq('id', user.id)
      .maybeSingle();

    if (existingProfileError) {
      console.error('기존 profiles 조회 실패:', existingProfileError);
      pushLog('기존 사용자 프로필 조회 실패');
    }

    if (!existingProfile) {
      const { error: insertError } = await supabase.from('profiles').insert({
        id: user.id,
        email,
        approved: adminFlagByEmail ? true : false,
        is_admin: adminFlagByEmail,
      });

      if (insertError) {
        console.error('profiles insert 실패:', insertError);
        pushLog('사용자 프로필 저장 실패');
      }
    } else if ((existingProfile.email || '').toLowerCase() !== email) {
      const updatePayload = { email };
      if (adminFlagByEmail && !existingProfile.is_admin) {
        updatePayload.is_admin = true;
      }
      if (adminFlagByEmail && !existingProfile.approved) {
        updatePayload.approved = true;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', user.id);

      if (updateError) {
        console.error('profiles email 동기화 실패:', updateError);
        pushLog('사용자 이메일 동기화 실패');
      }
    } else if (adminFlagByEmail && (!existingProfile.is_admin || !existingProfile.approved)) {
      const { error: adminSyncError } = await supabase
        .from('profiles')
        .update({ is_admin: true, approved: true })
        .eq('id', user.id);

      if (adminSyncError) {
        console.error('관리자 권한 동기화 실패:', adminSyncError);
        pushLog('관리자 권한 동기화 실패');
      }
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

  const toggleAdminRole = async (profileId, nextIsAdmin, targetEmail) => {
    if (targetEmail === currentUser?.email && !nextIsAdmin) {
      alert('본인 계정은 관리자 권한을 해제할 수 없습니다.');
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ is_admin: nextIsAdmin })
      .eq('id', profileId);

    if (error) {
      console.error('관리자 권한 변경 실패:', error);
      alert(`관리자 권한 변경 실패: ${error.message}`);
      return;
    }

    pushLog(nextIsAdmin ? '관리자 권한 부여 완료' : '일반 사용자 전환 완료');
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
    const vocReinbound = vocPendingRows.filter((r) => r.reinboundCount >= 3).length;
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
      vocReinbound,
      vocLongPending,
      vocOverAbnormal,
      evCompleted,
      evPending,
    };
  }, [mergedRows, vocRows]);

  const getRowsForSummaryType = (type) => {
    if (type === 'total') return mergedRows;
    if (type === 'fault') return mergedRows.filter((row) => isActiveFaultRow(row));
    if (type === 'normal') return mergedRows.filter((row) => row.isNormalOperation);
    if (type === 'manualOff') return mergedRows.filter((row) => row.faultType === '임의 OFF');
    if (type === 'vocPending') return mergedRows.filter((row) => row.faultType === 'VOC 조치 예정');
    if (type === 'uninbound') return mergedRows.filter((row) => row.faultType === '미인입 고장');
    if (type === 'replacement') return mergedRows.filter((row) => row.faultType === '교체 예정');
    return [];
  };

  const summaryModalData = useMemo(() => {
    if (!summaryModalType) return null;

    const rows = getRowsForSummaryType(summaryModalType);
    const typeLabelMap = {
      total: '전체 충전기',
      fault: '고장 충전기',
      normal: '정상 운영',
      vocPending: 'VOC 조치 예정',
      uninbound: '미인입 고장',
      replacement: '교체 진행중',
      manualOff: '임의 OFF',
    };

    const goFilterMap = {
      total: 'all',
      fault: 'fault',
      normal: 'normal',
      vocPending: 'VOC 조치 예정',
      uninbound: '미인입 고장',
      replacement: '교체 예정',
      manualOff: '임의 OFF',
    };

    const countBy = (items, getKey) => {
      const map = new Map();
      items.forEach((item) => {
        const key = getKey(item) || '기타';
        map.set(key, (map.get(key) || 0) + 1);
      });
      return Array.from(map.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    };

    const modelCounts = countBy(rows, (row) => row.chargerType || getChargerType(row.modelName));

    const installedModelMap = new Map();
    const installedSiteMap = new Map();
    const faultSiteMap = new Map();

    mergedRows.forEach((row) => {
      const modelKey = row.chargerType || getChargerType(row.modelName) || '기타';
      const siteKey = row.siteId || row.siteName || '충전소ID 미기재';

      installedModelMap.set(modelKey, (installedModelMap.get(modelKey) || 0) + 1);
      installedSiteMap.set(siteKey, (installedSiteMap.get(siteKey) || 0) + 1);

      if (row.isFault) {
        faultSiteMap.set(siteKey, (faultSiteMap.get(siteKey) || 0) + 1);
      }
    });

    const siteMap = new Map();

    rows.forEach((row) => {
      const siteKey = row.siteId || row.siteName || '충전소ID 미기재';
      if (!siteMap.has(siteKey)) {
        siteMap.set(siteKey, {
          siteKey,
          siteId: row.siteId || '-',
          siteName: row.siteName || '-',
          address: shortAddress(row.address),
          regionGroup: getRegionGroup(row.address),
          chargerCount: 0,
          installedTotal: installedSiteMap.get(siteKey) || 0,
          faultTotal: faultSiteMap.get(siteKey) || 0,
          latestCollectedAt: null,
          latestCollectedAtText: '-',
          modelMap: new Map(),
        });
      }
      const siteItem = siteMap.get(siteKey);
      const modelKey = row.chargerType || getChargerType(row.modelName) || '기타';
      siteItem.chargerCount += 1;
      siteItem.modelMap.set(modelKey, (siteItem.modelMap.get(modelKey) || 0) + 1);
      if (row.collectedAt && (!siteItem.latestCollectedAt || row.collectedAt > siteItem.latestCollectedAt)) {
        siteItem.latestCollectedAt = row.collectedAt;
        siteItem.latestCollectedAtText = formatShortDate(row.collectedAt);
      }
    });

    const siteRows = Array.from(siteMap.values())
      .map((site) => {
        const modelEntries = Array.from(site.modelMap.entries())
          .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
        const topModel = modelEntries[0]?.[0] || '-';
        const extraModelCount = Math.max(modelEntries.length - 1, 0);
        return {
          ...site,
          mainModel: extraModelCount > 0 ? `${compactModelLabel(topModel)} 외 ${extraModelCount}` : compactModelLabel(topModel),
          installedRate: site.installedTotal > 0 ? Math.round((site.chargerCount / site.installedTotal) * 1000) / 10 : 0,
          faultRate: site.faultTotal > 0 ? Math.round((site.chargerCount / site.faultTotal) * 1000) / 10 : 0,
        };
      })
      .sort((a, b) => b.installedTotal - a.installedTotal || b.chargerCount - a.chargerCount || String(a.siteName).localeCompare(String(b.siteName)));

    const regionMap = new Map();
    siteRows.forEach((site) => {
      const regionKey = site.regionGroup || '지역 미기재';
      if (!regionMap.has(regionKey)) {
        regionMap.set(regionKey, {
          region: regionKey,
          chargerCount: 0,
          siteCount: 0,
          shareRate: 0,
        });
      }
      const regionItem = regionMap.get(regionKey);
      regionItem.chargerCount += site.chargerCount || 0;
      regionItem.siteCount += 1;
    });

    const regionRows = Array.from(regionMap.values())
      .map((region) => ({
        ...region,
        shareRate: rows.length > 0 ? Math.round((region.chargerCount / rows.length) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.chargerCount - a.chargerCount || b.siteCount - a.siteCount || String(a.region).localeCompare(String(b.region)));

    const faultTotalCount = mergedRows.filter((row) => isActiveFaultRow(row)).length;

    return {
      type: summaryModalType,
      title: typeLabelMap[summaryModalType] || '요약',
      rows,
      totalCount: rows.length,
      uniqueSiteCount: siteRows.length,
      modelCounts,
      siteRows,
      regionRows,
      installedModelMap,
      faultTotalCount,
      goFilter: goFilterMap[summaryModalType] || 'all',
    };
  }, [summaryModalType, mergedRows]);

  const openSummaryModal = (type) => {
    setSummaryModalType(type);
  };

  const closeSummaryModal = () => {
    setSummaryModalType(null);
  };

  const goSummaryDetails = () => {
    if (!summaryModalData) return;
    setFaultFilter(summaryModalData.goFilter);
    setDetailModelFilter('all');
    setTab('details');
    closeSummaryModal();
  };

  const detailModelOptions = useMemo(() => {
    const modelMap = new Map();

    mergedRows.forEach((row) => {
      const matchesSearch =
        !searchText ||
        [row.chargerId, row.siteName, row.address].some((value) =>
          normalizeText(value).toLowerCase().includes(searchText.toLowerCase())
        );

      const matchesFault =
        faultFilter === 'all'
          ? true
          : faultFilter === 'fault'
            ? isActiveFaultRow(row)
            : faultFilter === 'approval'
              ? row.isApprovalPending
              : faultFilter === 'normal'
                ? row.isNormalOperation
                : row.faultType === faultFilter;

      const matchesRecurrence =
        recurrenceFilter === 'all'
          ? true
          : recurrenceFilter === 'recurrence'
            ? row.occurrenceCount >= 2 && row.partReplaceCount < 3 && row.reinboundCount < 3
            : recurrenceFilter === 'part3'
              ? row.partReplaceCount >= 3
              : recurrenceFilter === 'reinbound3'
                ? row.reinboundCount >= 3
                : true;

      const matchesLongPending =
        longPendingFilter === 'all' ? true : longPendingFilter === 'only' ? row.isLongPending : true;

      if (!matchesSearch || !matchesFault || !matchesRecurrence || !matchesLongPending) return;

      const modelKey = row.chargerType || getChargerType(row.modelName) || '기타';
      modelMap.set(modelKey, (modelMap.get(modelKey) || 0) + 1);
    });

    return Array.from(modelMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || String(a.name).localeCompare(String(b.name)));
  }, [mergedRows, searchText, faultFilter, recurrenceFilter, longPendingFilter]);

  const filteredRows = useMemo(() => {
    return mergedRows.filter((row) => {
      const matchesSearch =
        !searchText ||
        [row.chargerId, row.siteName, row.address].some((value) =>
          normalizeText(value).toLowerCase().includes(searchText.toLowerCase())
        );

      const matchesFault =
        faultFilter === 'all'
          ? true
          : faultFilter === 'fault'
            ? isActiveFaultRow(row)
            : faultFilter === 'approval'
              ? row.isApprovalPending
              : faultFilter === 'normal'
                ? row.isNormalOperation
                : row.faultType === faultFilter;

      const matchesRecurrence =
        recurrenceFilter === 'all'
          ? true
          : recurrenceFilter === 'recurrence'
            ? row.occurrenceCount >= 2 && row.partReplaceCount < 3 && row.reinboundCount < 3
            : recurrenceFilter === 'part3'
              ? row.partReplaceCount >= 3
              : recurrenceFilter === 'reinbound3'
                ? row.reinboundCount >= 3
                : true;

      const matchesLongPending =
        longPendingFilter === 'all' ? true : longPendingFilter === 'only' ? row.isLongPending : true;

      const rowModelKey = row.chargerType || getChargerType(row.modelName) || '기타';
      const matchesModel = detailModelFilter === 'all' ? true : rowModelKey === detailModelFilter;

      return matchesSearch && matchesFault && matchesModel && matchesRecurrence && matchesLongPending;
    });
  }, [mergedRows, searchText, faultFilter, detailModelFilter, recurrenceFilter, longPendingFilter]);

  const sortedFilteredRows = useMemo(() => {
    const rows = filteredRows.map((row, index) => ({ row, index }));

    if (sortFilter === 'recurrenceDesc') {
      rows.sort((a, b) => {
        const aCount = Number(a.row.occurrenceCount || 0);
        const bCount = Number(b.row.occurrenceCount || 0);
        const diff = bCount - aCount;
        return diff !== 0 ? diff : a.index - b.index;
      });
    } else if (sortFilter === 'cumulativeChargeDesc') {
      rows.sort((a, b) => {
        const av = parseLooseNumber(a.row.cumulativeCharge);
        const bv = parseLooseNumber(b.row.cumulativeCharge);

        // 둘 다 값이 없으면 기존 표시 순서 유지
        if (av === null && bv === null) return a.index - b.index;
        // 값이 없는 행은 항상 아래로
        if (av === null) return 1;
        if (bv === null) return -1;

        const diff = bv - av;
        return diff !== 0 ? diff : a.index - b.index;
      });
    }

    return rows.map((item) => item.row);
  }, [filteredRows, sortFilter]);

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

  const vocPerformanceRange = useMemo(() => {
    const start = vocPerformanceStartDate ? new Date(`${vocPerformanceStartDate}T00:00:00`) : null;
    const end = vocPerformanceEndDate ? new Date(`${vocPerformanceEndDate}T23:59:59`) : null;
    return { start, end };
  }, [vocPerformanceStartDate, vocPerformanceEndDate]);

  const isInVocPerformanceRange = (date) => {
    if (!date) return false;
    if (vocPerformanceRange.start && date < vocPerformanceRange.start) return false;
    if (vocPerformanceRange.end && date > vocPerformanceRange.end) return false;
    return true;
  };

  const vocPerformanceStats = useMemo(() => {
    const map = new Map();
    const ensure = (org, name) => {
      const safeOrg = org || '미지정';
      const safeName = name || '(미기재)';
      const key = `${safeOrg}__${safeName}`;
      if (!map.has(key)) {
        map.set(key, { org: safeOrg, name: safeName, received: 0, completed: 0, pending: 0 });
      }
      return map.get(key);
    };

    for (const row of vocRows) {
      const completedOrg = row.completedOrg || '';
      const completedName = row.completedName || '';
      const pendingOrg = row.pendingDisplayOrg || row.progressOrg || '';
      const pendingName = row.pendingDisplayName || row.progressName || '';
      const displayOrg = row.isCompleted ? completedOrg : pendingOrg;
      const displayName = row.isCompleted ? completedName : pendingName;

      if (row.receivedAt && isInVocPerformanceRange(row.receivedAt)) {
        if (orgFilter === 'all' || displayOrg === orgFilter) {
          ensure(displayOrg, displayName).received += 1;
        }
      }

      if (row.isCompleted && row.completedAt && isInVocPerformanceRange(row.completedAt)) {
        if (orgFilter === 'all' || completedOrg === orgFilter) {
          ensure(completedOrg, completedName).completed += 1;
        }
      }

      if (row.isPending && row.receivedAt && isInVocPerformanceRange(row.receivedAt)) {
        if (orgFilter === 'all' || pendingOrg === orgFilter) {
          ensure(pendingOrg, pendingName).pending += 1;
        }
      }
    }

    return Array.from(map.values())
      .map((row) => {
        const denominator = row.completed + row.pending;
        const completionRate = denominator > 0 ? Math.round((row.completed / denominator) * 1000) / 10 : 0;
        return { ...row, completionRate };
      })
      .filter((row) => row.received > 0 || row.completed > 0 || row.pending > 0)
      .sort((a, b) => {
        if (vocPerformanceSortFilter === 'rateDesc') {
          const diff = (b.completionRate || 0) - (a.completionRate || 0);
          if (diff !== 0) return diff;
          const completedDiff = (b.completed || 0) - (a.completed || 0);
          return completedDiff !== 0 ? completedDiff : (b.received || 0) - (a.received || 0);
        }

        if (vocPerformanceSortFilter === 'receivedDesc') {
          const diff = (b.received || 0) - (a.received || 0);
          return diff !== 0 ? diff : (b.completed || 0) - (a.completed || 0);
        }

        if (vocPerformanceSortFilter === 'pendingDesc') {
          const diff = (b.pending || 0) - (a.pending || 0);
          return diff !== 0 ? diff : (b.completed || 0) - (a.completed || 0);
        }

        const diff = (b.completed || 0) - (a.completed || 0);
        return diff !== 0 ? diff : (b.received || 0) - (a.received || 0);
      });
  }, [vocRows, orgFilter, vocPerformanceRange, vocPerformanceSortFilter]);

  const vocPerformanceSummary = useMemo(() => {
    const totalReceived = vocPerformanceStats.reduce((sum, row) => sum + row.received, 0);
    const totalCompleted = vocPerformanceStats.reduce((sum, row) => sum + row.completed, 0);
    const totalPending = vocPerformanceStats.reduce((sum, row) => sum + row.pending, 0);
    const denominator = totalCompleted + totalPending;
    const completionRate = denominator > 0 ? Math.round((totalCompleted / denominator) * 1000) / 10 : 0;
    return { totalReceived, totalCompleted, totalPending, completionRate };
  }, [vocPerformanceStats]);

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
        const detectedParts = extractPartNamesFromContent(v.completedContent);

        if (detectedParts.length === 0) return null;

        return {
          siteId: v.matchBaseId,
          chargerId: v.matchId || `${v.matchBaseId}-01`,
          siteName: v.siteName || '-',
          completedAtText: formatDate(v.completedAt),
          usedParts: detectedParts.join(', '),
          summaryContent: summarizeAfterContent(v.completedContent),
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

  const vocPartCompareRange = useMemo(() => {
    if (!vocPartStartDate || !vocPartEndDate) return { start: null, end: null, label: '비교기간 미선택' };

    const selectedStart = new Date(`${vocPartStartDate}T00:00:00`);
    const selectedEnd = new Date(`${vocPartEndDate}T23:59:59`);

    if (Number.isNaN(selectedStart.getTime()) || Number.isNaN(selectedEnd.getTime())) {
      return { start: null, end: null, label: '비교기간 미선택' };
    }

    let compareStart = new Date(selectedStart);
    let compareEnd = new Date(selectedEnd);

    if (vocPartCompareMode === 'previousWeek') {
      compareStart.setDate(compareStart.getDate() - 7);
      compareEnd.setDate(compareEnd.getDate() - 7);
    } else if (vocPartCompareMode === 'previousMonth') {
      compareStart.setMonth(compareStart.getMonth() - 1);
      compareEnd.setMonth(compareEnd.getMonth() - 1);
    } else {
      const periodMs = selectedEnd.getTime() - selectedStart.getTime() + 1;
      compareEnd = new Date(selectedStart.getTime() - 1);
      compareStart = new Date(compareEnd.getTime() - periodMs + 1);
    }

    return {
      start: compareStart,
      end: compareEnd,
      label: `${formatDate(compareStart).slice(0, 10)} ~ ${formatDate(compareEnd).slice(0, 10)}`,
    };
  }, [vocPartStartDate, vocPartEndDate, vocPartCompareMode]);

  const vocPartComparisonStats = useMemo(() => {
    if (!vocPartCompareRange.start || !vocPartCompareRange.end) return [];

    const currentCounts = {};
    const compareCounts = {};
    Object.keys(PART_PATTERNS).forEach((name) => {
      currentCounts[name] = 0;
      compareCounts[name] = 0;
    });

    partUsageRows.forEach((row) => {
      row.usedParts.split(', ').forEach((part) => {
        currentCounts[part] = (currentCounts[part] || 0) + 1;
      });
    });

    vocRows.forEach((v) => {
      if (!v.isCompleted || v.completedOrg !== 'EV세상' || !v.completedAt) return;
      if (v.completedAt < vocPartCompareRange.start || v.completedAt > vocPartCompareRange.end) return;
      if (!v.completedContent.includes('부품교체')) return;

      extractPartNamesFromContent(v.completedContent).forEach((part) => {
        compareCounts[part] = (compareCounts[part] || 0) + 1;
      });
    });

    return Object.keys(PART_PATTERNS)
      .map((part) => {
        const current = currentCounts[part] || 0;
        const compare = compareCounts[part] || 0;
        const diff = current - compare;
        const rate = compare > 0 ? Math.round((diff / compare) * 1000) / 10 : current > 0 ? 100 : 0;
        return { part, current, compare, diff, rate };
      })
      .filter((row) => row.current > 0 || row.compare > 0)
      .sort((a, b) => {
        const diff = Math.abs(b.diff) - Math.abs(a.diff);
        return diff !== 0 ? diff : b.current - a.current;
      });
  }, [vocRows, partUsageRows, vocPartCompareRange]);

  const downloadDetailsExcel = () => {
    const exportRows = sortedFilteredRows.map((row) => ({
      충전소ID: row.siteId || '-',
      충전기ID: row.chargerId || '-',
      충전소명: row.siteName || '-',
      주소: row.address || '-',
      상세주소: row.detailAddress || '-',
      상태: row.isFault ? displayFaultTypeName(row.faultType) : row.isApprovalPending ? '승인대기' : '정상 운영',
      고장분류: row.faultType || '-',
      최근수집일: row.collectedAtText || '-',
      재발생여부: row.recurrenceLabel || '-',
      재발생횟수: row.occurrenceCount || 0,
      재인입횟수: row.reinboundCount || 0,
      부품교체횟수: row.partReplaceCount || 0,
      누적충전량: formatCumulativeCharge(row.cumulativeCharge),
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
    setSortFilter('default');
    setOrgFilter('EV세상');
    const recentWeekRange = getRecentWeekDateRange();
    setVocPartStartDate(recentWeekRange.start);
    setVocPartEndDate(recentWeekRange.end);
    setVocPartCompareMode('samePeriod');
    setVocPerformanceStartDate('');
    setVocPerformanceEndDate('');
    setVocPerformanceSortFilter('rateDesc');
    setSummaryModalType(null);
  };

  const navItems = [
    { key: 'dashboard', label: '대시보드', icon: <IconGrid /> },
    { key: 'details', label: '상세내역', icon: <IconList /> },
    { key: 'search', label: '충전소 조회', icon: <IconSearch /> },
    { key: 'voc', label: '출동 현황', icon: <IconVoc /> },
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
      <style>{`
        table th { background: #f8fbff; color: #50627d; font-weight: 900; text-align: left; padding: 12px 12px; border-bottom: 1px solid #e6edf5; white-space: nowrap; }
        table td { padding: 12px 12px; border-bottom: 1px solid #eef2f7; color: #0f172a; vertical-align: middle; line-height: 1.45; }
        table tbody tr:hover { background: #f8fbff; }
        table.detail-scroll-table th { position: sticky; top: 0; z-index: 2; box-shadow: 0 1px 0 #e6edf5; }
      `}</style>
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
              {isAdmin && (
                <label style={styles.primaryButton}>
                  <span style={styles.buttonInner}><IconUpload /> 파일 업로드</span>
                  <input type="file" accept=".xlsx,.xls,.csv" multiple onChange={handleFiles} style={{ display: 'none' }} />
                </label>
              )}
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
              <OperatingOverviewCard dashboard={dashboard} onTotalClick={() => openSummaryModal('total')} />

              <div style={styles.faultDashboardGrid}>
                <StatCard
                  compact
                  title="고장 충전기"
                  value={`${dashboard.faultCount.toLocaleString()}기`}
                  sub={<span style={{ fontSize: 17, fontWeight: 900, color: COLORS.text }}>고장률 {dashboard.faultRate}%</span>}
                  onClick={() => openSummaryModal('fault')}
                />
                <div style={{ ...styles.panel, ...styles.faultChartPanel }}>
                  <div style={{ ...styles.sectionTitle, marginBottom: 6 }}>현재 고장 분류</div>
                  <DonutChart dashboard={dashboard} />
                </div>
              </div>

              <div style={styles.subCardGrid}>
                <StatCard
                  title="VOC 조치 예정"
                  value={`${dashboard.vocPending.toLocaleString()}기`}
                  sub={`재발생 ${dashboard.vocRecurring.toLocaleString()}기 / 재인입 ${dashboard.vocReinbound.toLocaleString()}기`}
                  onClick={() => openSummaryModal('vocPending')}
                />
                <StatCard
                  title="미인입 고장"
                  value={`${dashboard.uninbound.toLocaleString()}기`}
                  sub="임의 OFF / VOC 조치 예정 / 교체 진행중 제외"
                  onClick={() => openSummaryModal('uninbound')}
                />
                <StatCard title="임의 OFF" value={`${dashboard.manualOff.toLocaleString()}기`} sub="충전기 중 충전상태 기준" onClick={() => openSummaryModal('manualOff')} />
                <StatCard title="교체 진행중" value={`${dashboard.replacement.toLocaleString()}기`} sub="교체건 파일 매칭 기준" onClick={() => openSummaryModal('replacement')} />
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
                    <li>고장 산정은 파일명 기준 시각인 07:00 이전 수집값, 과다이상, 교체 진행중을 포함합니다.</li>
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
                <div style={styles.detailActionRow}>
                  <div style={styles.countBox}>
                    결과 조회 <strong>{sortedFilteredRows.length.toLocaleString()}건</strong>
                  </div>
                  <button style={styles.secondaryButton} onClick={downloadDetailsExcel}>
                    결과 엑셀 다운로드
                  </button>
                </div>
              </div>

              <div style={styles.filterRowWide}>
                <input
                  style={styles.inputNarrow}
                  placeholder="충전기 ID / 충전소명 / 주소"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
                <select style={styles.select} value={faultFilter} onChange={(e) => setFaultFilter(e.target.value)}>
                  <option value="all">전체</option>
                  <option value="fault">고장전체</option>
                  <option value="approval">승인대기</option>
                  <option value="normal">정상 운영</option>
                  <option value="임의 OFF">임의 OFF</option>
                  <option value="VOC 조치 예정">VOC 조치 예정</option>
                  <option value="교체 예정">교체 진행중</option>
                  <option value="미인입 고장">미인입 고장</option>
                </select>
                <select
                  style={styles.selectWide}
                  value={detailModelFilter}
                  onChange={(e) => setDetailModelFilter(e.target.value)}
                >
                  <option value="all">모델 전체</option>
                  {detailModelOptions.map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.name} ({item.count.toLocaleString()}기)
                    </option>
                  ))}
                </select>
                <select style={styles.select} value={recurrenceFilter} onChange={(e) => setRecurrenceFilter(e.target.value)}>
                  <option value="all">전체보기</option>
                  <option value="recurrence">재발생만 보기</option>
                  <option value="part3">부품교체 3회 이상 보기</option>
                  <option value="reinbound3">재인입 3회 이상 보기</option>
                </select>
                <select style={styles.select} value={longPendingFilter} onChange={(e) => setLongPendingFilter(e.target.value)}>
                  <option value="all">전체보기</option>
                  <option value="only">장기 미조치만 보기</option>
                </select>
                <select style={styles.select} value={sortFilter} onChange={(e) => setSortFilter(e.target.value)}>
                  <option value="default">정렬기준</option>
                  <option value="recurrenceDesc">재발생 높은순</option>
                  <option value="cumulativeChargeDesc">누적 충전량 높은순</option>
                </select>
              </div>

              <div style={styles.detailTableWrap}>
                <table className="detail-scroll-table" style={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ width: '12%' }}>충전기 ID</th>
                      <th style={{ width: '13%' }}>충전소명</th>
                      <th style={{ width: '6%' }}>주소</th>
                      <th style={{ width: '11%' }}>상태</th>
                      <th style={{ width: '13%' }}>고장분류</th>
                      <th style={{ width: '10%' }}>최근수집일</th>
                      <th style={{ width: '10%' }}>재발생 여부</th>
                      <th style={{ width: '9%' }}>누적충전량</th>
                      <th style={{ width: '10%' }}>장기 미조치</th>
                      <th style={{ width: '23%' }}>이후 내용</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedFilteredRows.slice(0, 1000).map((row) => (
                      <tr key={`${row.chargerId}-${row.rowIndex}`}>
                        <td>{row.chargerId}</td>
                        <td>{row.siteName || '-'}</td>
                        <td>{shortAddress(row.address)}</td>
                        <td style={styles.statusCell}><StatusDot row={row} /></td>
                        <td>{row.faultType || '-'}</td>
                        <td>{row.collectedAtText}</td>
                        <td style={styles.nowrapCell}>{row.recurrenceLabel}</td>
                        <td style={styles.nowrapCell}>{formatCumulativeCharge(row.cumulativeCharge)}</td>
                        <td style={styles.nowrapCell}>{row.isLongPending ? '장기 미조치' : '-'}</td>
                        <td title={row.latestCompletedContent || '-'}>{summarizeAfterContent(row.latestCompletedContent)}</td>
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
                {sortedFilteredRows.slice(0, 20).map((row) => (
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
                    <div style={styles.searchLine}>재인입 횟수: {row.reinboundCount || 0}회</div>
                    <div style={styles.searchLine}>부품교체 횟수: {row.partReplaceCount || 0}회</div>
                    <div style={styles.searchLine}>누적충전량: {formatCumulativeCharge(row.cumulativeCharge)}</div>
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
              <div style={styles.vocHeroPanel}>
                <div style={styles.vocHeroTop}>
                  <div>
                    <div style={styles.vocEyebrow}>VOC PERFORMANCE</div>
                    <div style={styles.vocHeroTitle}>기간별 VOC 처리 현황</div>
                    <div style={styles.vocHeroSub}>접수일시(B열)와 완료일시(R열)를 기준으로 인원별 실적을 확인합니다.</div>
                  </div>
                  <div style={styles.vocControlBox}>
                    <select style={styles.vocSortSelect} value={vocPerformanceSortFilter} onChange={(e) => setVocPerformanceSortFilter(e.target.value)}>
                      <option value="rateDesc">정렬기준: 완료율 높은 순</option>
                      <option value="receivedDesc">접수 많은 순</option>
                      <option value="completedDesc">완료 많은 순</option>
                      <option value="pendingDesc">진행 중 많은 순</option>
                      <option value="rateDesc">완료율 높은 순</option>
                    </select>
                    <div style={styles.vocDateBox}>
                      <input type="date" style={styles.vocDateInput} value={vocPerformanceStartDate} onChange={(e) => setVocPerformanceStartDate(e.target.value)} />
                      <span style={styles.vocDateDivider}>~</span>
                      <input type="date" style={styles.vocDateInput} value={vocPerformanceEndDate} onChange={(e) => setVocPerformanceEndDate(e.target.value)} />
                    </div>
                  </div>
                </div>

                <div style={styles.vocKpiGrid}>
                  <VocKpiCard label="총 접수" value={`${vocPerformanceSummary.totalReceived.toLocaleString()}건`} hint="B열 접수일시 기준" color={COLORS.blue} bg={COLORS.blueSoft} />
                  <VocKpiCard label="완료" value={`${vocPerformanceSummary.totalCompleted.toLocaleString()}건`} hint="R열 완료일시 기준" color={COLORS.green} bg={COLORS.greenSoft} />
                  <VocKpiCard label="진행중" value={`${vocPerformanceSummary.totalPending.toLocaleString()}건`} hint="접수 기간 내 완료일시 공백" color={COLORS.orange} bg={COLORS.orangeSoft} />
                  <VocKpiCard label="완료율" value={`${vocPerformanceSummary.completionRate}%`} hint="완료 / (완료 + 진행중)" color={COLORS.violet} bg={COLORS.violetSoft} />
                </div>
              </div>

              <div style={styles.panel}>
                <div style={styles.sectionTitleRow}>
                  <div>
                    <div style={styles.sectionTitleNoMargin}>인원별 VOC 처리 현황</div>
                    <div style={styles.sectionSubText}>기간을 선택하지 않으면 전체 VOC 데이터 기준으로 표시합니다.</div>
                  </div>
                  <div style={styles.fixedOrgBadge}>EV세상 기준</div>
                </div>
                <div style={styles.tableWrapModern}>
                  <table style={styles.tableModern}>
                    <thead>
                      <tr>
                        <th>순위</th>
                        <th>소속</th>
                        <th>이름</th>
                        <th>총 접수</th>
                        <th>완료</th>
                        <th>진행중</th>
                        <th>완료율</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vocPerformanceStats.map((row, idx) => (
                        <tr key={`${row.org}-${row.name}-period`}>
                          <td><span style={idx < 3 ? styles.rankBadgeTop : styles.rankBadge}>{idx + 1}</span></td>
                          <td><span style={styles.orgBadge}>{row.org}</span></td>
                          <td style={{ fontWeight: 800 }}>{idx === 0 ? '🥇 ' : idx === 1 ? '🥈 ' : idx === 2 ? '🥉 ' : ''}{row.name}</td>
                          <td>{row.received.toLocaleString()}건</td>
                          <td><span style={styles.completeBadge}>{row.completed.toLocaleString()}건</span></td>
                          <td><span style={styles.pendingBadge}>{row.pending.toLocaleString()}건</span></td>
                          <td>
                            <div style={styles.rateCell}>
                              <div style={styles.rateTrack}><div style={{ ...styles.rateFill, width: `${Math.min(row.completionRate, 100)}%` }} /></div>
                              <strong>{row.completionRate}%</strong>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {vocPerformanceStats.length === 0 && (
                        <tr>
                          <td colSpan="7" style={{ color: COLORS.sub, textAlign: 'center', padding: 24 }}>선택한 기간의 VOC 처리 데이터가 없습니다.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={styles.panel}>
                <div style={styles.sectionTitle}>기존 VOC 요약</div>
                <div style={styles.summaryGrid2}>
                  <div style={styles.summaryBox}>EV세상 진행중 <strong>{dashboard.evPending.toLocaleString()}건</strong></div>
                  <div style={styles.summaryBox}>EV세상 완료 <strong>{dashboard.evCompleted.toLocaleString()}건</strong></div>
                </div>
              </div>

              <div style={styles.panel}>
                <div style={styles.sectionTitle}>부품 교체 기간 조회</div>
                <div style={styles.dateFilterRow3}>
                  <input type="date" style={styles.input} value={vocPartStartDate} onChange={(e) => setVocPartStartDate(e.target.value)} />
                  <input type="date" style={styles.input} value={vocPartEndDate} onChange={(e) => setVocPartEndDate(e.target.value)} />
                  <select style={styles.select} value={vocPartCompareMode} onChange={(e) => setVocPartCompareMode(e.target.value)}>
                    <option value="samePeriod">비교: 동일 기간 대비</option>
                    <option value="previousWeek">비교: 전주 대비</option>
                    <option value="previousMonth">비교: 전월 대비</option>
                  </select>
                </div>
                <div style={{ color: COLORS.sub, fontSize: 13, marginTop: 8 }}>
                  완료일시 기준 (VOC 엑셀 R열)으로 필터합니다. 비교기간: {vocPartCompareRange.label}
                </div>
              </div>

              <div style={styles.panel}>
                <div style={styles.sectionTitleRow}>
                  <div>
                    <div style={styles.sectionTitleNoMargin}>부품 사용 비교 요약</div>
                    <div style={styles.sectionSubText}>선택기간 사용량과 비교기간 사용량을 부품별로 비교합니다.</div>
                  </div>
                </div>
                {vocPartComparisonStats.length === 0 ? (
                  <div style={{ color: COLORS.sub }}>기간을 선택하면 부품별 증감 현황이 표시됩니다.</div>
                ) : (
                  <div style={styles.partCompareGrid}>
                    {vocPartComparisonStats.map((item) => (
                      <div key={item.part} style={styles.partCompareCard}>
                        <div style={styles.partCompareTitle}>{item.part}</div>
                        <div style={styles.partCompareMain}>{item.current.toLocaleString()}건</div>
                        <div style={styles.partCompareSub}>비교기간 {item.compare.toLocaleString()}건</div>
                        <div style={{ ...styles.partCompareDiff, color: item.diff > 0 ? COLORS.red : item.diff < 0 ? COLORS.blue : COLORS.slate }}>
                          {item.diff > 0 ? '▲' : item.diff < 0 ? '▼' : '━'} {item.diff > 0 ? '+' : ''}{item.diff.toLocaleString()}건 ({item.rate}%)
                        </div>
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
                          <td style={styles.compactContentCell} title={row.fullContent || '-'}>{row.summaryContent || '-'}</td>
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

                <div style={styles.summaryGrid4}>
                  <div style={styles.summaryBox}>전체 사용자 <strong>{profiles.length}명</strong></div>
                  <div style={styles.summaryBox}>승인 완료 <strong>{profiles.filter((p) => p.approved).length}명</strong></div>
                  <div style={styles.summaryBox}>승인 대기 <strong>{profiles.filter((p) => !p.approved).length}명</strong></div>
                  <div style={styles.summaryBox}>관리자 <strong>{profiles.filter((p) => p.is_admin).length}명</strong></div>
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
                            <td>{profile.is_admin ? '관리자' : '일반 사용자'}</td>
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

                                {profile.is_admin ? (
                                  <button
                                    style={styles.roleButtonMuted}
                                    onClick={() => toggleAdminRole(profile.id, false, profile.email)}
                                    disabled={profile.email === currentUser?.email}
                                    title={profile.email === currentUser?.email ? '본인 계정은 관리자 해제 불가' : ''}
                                  >
                                    일반 전환
                                  </button>
                                ) : (
                                  <button
                                    style={styles.roleButton}
                                    onClick={() => toggleAdminRole(profile.id, true, profile.email)}
                                  >
                                    관리자 부여
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

      {summaryModalData && (
        <SummaryModal
          data={summaryModalData}
          onClose={closeSummaryModal}
          onGoDetails={goSummaryDetails}
        />
      )}
    </div>
  );
}


function SummaryModal({ data, onClose, onGoDetails }) {
  const isTotalSummary = data.type === 'total';
  const isNormal = data.type === 'normal';
  const isFaultLike = ['fault', 'vocPending', 'uninbound', 'replacement', 'manualOff'].includes(data.type);
  const isManualOffSummary = data.type === 'manualOff';
  const isFaultSummary = data.type === 'fault';
  const hasRichAnalysis = ['total', 'fault', 'vocPending', 'uninbound', 'replacement'].includes(data.type);
  const hasSpeedSummary = hasRichAnalysis || isManualOffSummary;
  const [analysisView, setAnalysisView] = useState('model');
  const [modelSortType, setModelSortType] = useState('faultRate');
  const [regionSortType, setRegionSortType] = useState('count');
  const [siteSortType, setSiteSortType] = useState('targetCount');
  const [chargerSpeedFilter, setChargerSpeedFilter] = useState(isFaultSummary ? 'slow' : 'all');

  useEffect(() => {
    setChargerSpeedFilter('all');
    setAnalysisView('model');
  }, [data.type]);

  const filteredSummaryRows = useMemo(() => {
    const rows = data.rows || [];
    if (!hasSpeedSummary || chargerSpeedFilter === 'all') return rows;
    return rows.filter((row) => getChargerSpeedGroup(row) === chargerSpeedFilter);
  }, [data.rows, hasSpeedSummary, chargerSpeedFilter]);

  const countBy = (items, getKey) => {
    const map = new Map();
    items.forEach((item) => {
      const key = getKey(item) || '기타';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  };

  const buildRegionRows = (items) => {
    const map = new Map();
    items.forEach((row) => {
      const regionKey = getRegionGroup(row.address);
      if (!map.has(regionKey)) {
        map.set(regionKey, {
          region: regionKey,
          chargerCount: 0,
          siteSet: new Set(),
          siteCount: 0,
          shareRate: 0,
        });
      }
      const regionItem = map.get(regionKey);
      regionItem.chargerCount += 1;
      regionItem.siteSet.add(row.siteId || row.siteName || '충전소ID 미기재');
    });

    return Array.from(map.values())
      .map((region) => ({
        region: region.region,
        chargerCount: region.chargerCount,
        siteCount: region.siteSet.size,
        shareRate: items.length > 0 ? Math.round((region.chargerCount / items.length) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.chargerCount - a.chargerCount || b.siteCount - a.siteCount || String(a.region).localeCompare(String(b.region)));
  };

  const buildSiteRows = (items) => {
    const map = new Map();
    items.forEach((row) => {
      const siteKey = row.siteId || row.siteName || '충전소ID 미기재';
      if (!map.has(siteKey)) {
        map.set(siteKey, {
          siteKey,
          siteId: row.siteId || '-',
          siteName: row.siteName || '-',
          address: shortAddress(row.address),
          regionGroup: getRegionGroup(row.address),
          chargerCount: 0,
          latestCollectedAt: null,
          latestCollectedAtText: '-',
          modelMap: new Map(),
        });
      }

      const siteItem = map.get(siteKey);
      const modelKey = row.chargerType || getChargerType(row.modelName) || '기타';
      siteItem.chargerCount += 1;
      siteItem.modelMap.set(modelKey, (siteItem.modelMap.get(modelKey) || 0) + 1);
      if (row.collectedAt && (!siteItem.latestCollectedAt || row.collectedAt > siteItem.latestCollectedAt)) {
        siteItem.latestCollectedAt = row.collectedAt;
        siteItem.latestCollectedAtText = formatShortDate(row.collectedAt);
      }
    });

    return Array.from(map.values())
      .map((site) => {
        const modelEntries = Array.from(site.modelMap.entries())
          .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
        const topModel = modelEntries[0]?.[0] || '-';
        const extraModelCount = Math.max(modelEntries.length - 1, 0);
        return {
          ...site,
          mainModel: extraModelCount > 0 ? `${compactModelLabel(topModel)} 외 ${extraModelCount}` : compactModelLabel(topModel),
        };
      })
      .sort((a, b) => b.chargerCount - a.chargerCount || String(a.siteName).localeCompare(String(b.siteName)));
  };

  const buildManufacturerRows = (items) => {
    const map = new Map();
    items.forEach((row) => {
      const manufacturerKey = getManufacturerGroup(row);
      if (!map.has(manufacturerKey)) {
        map.set(manufacturerKey, {
          manufacturer: manufacturerKey,
          chargerCount: 0,
          siteSet: new Set(),
          siteCount: 0,
          shareRate: 0,
        });
      }
      const manufacturerItem = map.get(manufacturerKey);
      manufacturerItem.chargerCount += 1;
      manufacturerItem.siteSet.add(row.siteId || row.siteName || '충전소ID 미기재');
    });

    return Array.from(map.values())
      .map((manufacturer) => ({
        manufacturer: manufacturer.manufacturer,
        chargerCount: manufacturer.chargerCount,
        siteCount: manufacturer.siteSet.size,
        shareRate: items.length > 0 ? Math.round((manufacturer.chargerCount / items.length) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.chargerCount - a.chargerCount || b.siteCount - a.siteCount || String(a.manufacturer).localeCompare(String(b.manufacturer)));
  };

  const modelRows = useMemo(() => {
    if (!hasSpeedSummary) return data.modelCounts || [];
    return countBy(filteredSummaryRows, (row) => row.chargerType || getChargerType(row.modelName));
  }, [data.modelCounts, filteredSummaryRows, hasSpeedSummary]);

  const totalCount = hasSpeedSummary ? filteredSummaryRows.length : data.totalCount;
  const uniqueSiteCount = hasSpeedSummary
    ? new Set(filteredSummaryRows.map((row) => row.siteId || row.siteName || '충전소ID 미기재')).size
    : data.uniqueSiteCount;
  const speedTotalLabel = hasSpeedSummary ? getChargerSpeedLabel(chargerSpeedFilter) : '';
  const summaryTargetLabel = hasSpeedSummary
    ? (chargerSpeedFilter === 'all' ? data.title : `${speedTotalLabel} ${data.title}`)
    : '충전기';

  const regionRows = useMemo(
    () => ((hasRichAnalysis || isManualOffSummary) ? buildRegionRows(filteredSummaryRows) : (data.regionRows || [])),
    [hasRichAnalysis, isManualOffSummary, filteredSummaryRows, data.regionRows]
  );
  const manufacturerRows = useMemo(
    () => (hasRichAnalysis ? buildManufacturerRows(filteredSummaryRows) : []),
    [hasRichAnalysis, filteredSummaryRows]
  );
  const siteRows = useMemo(
    () => (isManualOffSummary ? buildSiteRows(filteredSummaryRows) : (data.siteRows || [])),
    [isManualOffSummary, filteredSummaryRows, data.siteRows]
  );
  const maxModelCount = Math.max(...modelRows.map((item) => item.count || 0), 1);
  const maxRegionCount = Math.max(...regionRows.map((item) => item.chargerCount || 0), 1);
  const maxManufacturerCount = Math.max(...manufacturerRows.map((item) => item.chargerCount || 0), 1);
  const maxSiteCount = Math.max(...siteRows.map((item) => item.chargerCount || 0), 1);

  const getInstalledTotal = (modelName) => data.installedModelMap?.get?.(modelName) || 0;

  const sortedModelRows = useMemo(() => {
    const withMetrics = modelRows.map((item, index) => {
      const count = item.count || 0;
      const installedTotal = getInstalledTotal(item.name);
      const installedRate = installedTotal > 0 ? Math.round((count / installedTotal) * 1000) / 10 : 0;
      const faultRate = totalCount > 0
        ? Math.round((count / totalCount) * 1000) / 10
        : 0;

      return {
        ...item,
        _originalIndex: index,
        _installedTotal: installedTotal,
        _installedRate: installedRate,
        _faultRate: faultRate,
      };
    });

    if (isNormal || isTotalSummary) return withMetrics;

    return withMetrics.sort((a, b) => {
      if (modelSortType === 'installedRate') {
        const diff = (b._installedRate || 0) - (a._installedRate || 0);
        return diff !== 0 ? diff : (b.count || 0) - (a.count || 0);
      }

      if (modelSortType === 'count') {
        return (b.count || 0) - (a.count || 0) || String(a.name).localeCompare(String(b.name));
      }

      const diff = (b._faultRate || 0) - (a._faultRate || 0);
      return diff !== 0 ? diff : (b.count || 0) - (a.count || 0);
    });
  }, [modelRows, totalCount, data.installedModelMap, modelSortType, isNormal, isTotalSummary]);

  const sortedRegionRows = useMemo(() => {
    const withMetrics = regionRows.map((item, index) => ({
      ...item,
      _originalIndex: index,
    }));

    return withMetrics.sort((a, b) => {
      if (regionSortType === 'siteCount') {
        return (b.siteCount || 0) - (a.siteCount || 0) || (b.chargerCount || 0) - (a.chargerCount || 0);
      }

      if (regionSortType === 'shareRate') {
        return (b.shareRate || 0) - (a.shareRate || 0) || (b.chargerCount || 0) - (a.chargerCount || 0);
      }

      return (b.chargerCount || 0) - (a.chargerCount || 0) || (b.siteCount || 0) - (a.siteCount || 0);
    });
  }, [regionRows, regionSortType]);

  const sortedManufacturerRows = useMemo(() => {
    const withMetrics = manufacturerRows.map((item, index) => ({
      ...item,
      _originalIndex: index,
    }));

    return withMetrics.sort((a, b) => {
      if (regionSortType === 'siteCount') {
        return (b.siteCount || 0) - (a.siteCount || 0) || (b.chargerCount || 0) - (a.chargerCount || 0);
      }

      if (regionSortType === 'shareRate') {
        return (b.shareRate || 0) - (a.shareRate || 0) || (b.chargerCount || 0) - (a.chargerCount || 0);
      }

      return (b.chargerCount || 0) - (a.chargerCount || 0) || (b.siteCount || 0) - (a.siteCount || 0);
    });
  }, [manufacturerRows, regionSortType]);

  const sortedSiteRows = useMemo(() => {
    const withMetrics = siteRows.map((item, index) => ({
      ...item,
      _originalIndex: index,
      _latestCollectedTime: item.latestCollectedAt instanceof Date && !Number.isNaN(item.latestCollectedAt.getTime())
        ? item.latestCollectedAt.getTime()
        : 0,
    }));

    return withMetrics.sort((a, b) => {
      if (siteSortType === 'latestCollectedOld') {
        return (a._latestCollectedTime || 0) - (b._latestCollectedTime || 0) || (b.chargerCount || 0) - (a.chargerCount || 0);
      }

      if (siteSortType === 'latestCollectedNew') {
        return (b._latestCollectedTime || 0) - (a._latestCollectedTime || 0) || (b.chargerCount || 0) - (a.chargerCount || 0);
      }

      return (b.chargerCount || 0) - (a.chargerCount || 0) || String(a.siteName).localeCompare(String(b.siteName));
    });
  }, [siteRows, siteSortType]);

  const isRegionView = (isManualOffSummary || hasRichAnalysis) && analysisView === 'region';
  const isManufacturerView = hasRichAnalysis && analysisView === 'manufacturer';
  const isSiteView = isManualOffSummary && analysisView === 'site';
  const headerBadge = isRegionView
    ? '권역 / 수량 / 충전소 / 비중'
    : (isManufacturerView
      ? '제조사 / 수량 / 충전소 / 비중'
      : (isSiteView
        ? '모델 / 수량 / 마지막 수집'
        : ((isNormal || isTotalSummary) ? '수량 / 비중' : '수량 / 동일 기종 설치 대비 / 고장대비')));
  const description = isRegionView
    ? (hasRichAnalysis
      ? `${summaryTargetLabel}의 권역별 분포와 비중을 확인합니다.`
      : '권역별 임의 OFF 분포와 집중도를 먼저 확인합니다.')
    : (isManufacturerView
      ? `${summaryTargetLabel}의 제조사별 설치 분포와 비중을 확인합니다.`
      : (isSiteView
        ? '충전소별 대상 수량과 마지막 수집일을 확인합니다.'
        : (isFaultSummary
          ? `${summaryTargetLabel}의 모델별 수량, 설치대비 비율, 고장대비 비율을 확인합니다.`
          : (isTotalSummary
            ? `${summaryTargetLabel}의 모델별 구성 비중을 확인합니다.`
            : (isNormal
              ? '정상 운영 충전기의 모델별 구성 비중입니다.'
              : '모델별 수량, 설치대비 비율, 고장대비 비율을 확인합니다.')))));

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modelModalBox} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.modalEyebrow}>{isRegionView ? 'REGION SUMMARY' : (isManufacturerView ? 'MAKER SUMMARY' : (isSiteView ? 'SITE SUMMARY' : 'MODEL SUMMARY'))}</div>
            <div style={styles.modalTitle}>{data.title} 요약</div>
            <div style={styles.modalSubText}>{description}</div>
          </div>
          <button style={styles.modalCloseButton} onClick={onClose}>×</button>
        </div>

        <div style={styles.modalKpiGrid}>
          <div style={styles.modalKpiCard}>
            <div style={styles.modalKpiLabel}><span style={styles.modalKpiEmoji}>🔌</span>{hasSpeedSummary ? summaryTargetLabel : '총 충전기'}</div>
            <div style={styles.modalKpiValue}>{totalCount.toLocaleString()}기</div>
          </div>
          <div style={styles.modalKpiCard}>
            <div style={styles.modalKpiLabel}><span style={styles.modalKpiEmoji}>🏢</span>충전소 수량</div>
            <div style={styles.modalKpiValue}>{uniqueSiteCount.toLocaleString()}개소</div>
          </div>
          <div style={styles.modalKpiCard}>
            <div style={styles.modalKpiLabel}><span style={styles.modalKpiEmoji}>🍃</span>모델 분류</div>
            <div style={styles.modalKpiValue}>{modelRows.length.toLocaleString()}종</div>
          </div>
        </div>

        <div style={styles.modelAnalysisBox}>
          <div style={styles.modelAnalysisHeader}>
            <div>
              {(isManualOffSummary || hasRichAnalysis) && (
                <div style={styles.analysisTabRow}>
                  <button
                    type="button"
                    style={analysisView === 'model' ? styles.analysisTabActive : styles.analysisTab}
                    onClick={() => setAnalysisView('model')}
                  >
                    모델별
                  </button>
                  <button
                    type="button"
                    style={analysisView === 'region' ? styles.analysisTabActive : styles.analysisTab}
                    onClick={() => setAnalysisView('region')}
                  >
                    권역별
                  </button>
                  {hasRichAnalysis && (
                    <button
                      type="button"
                      style={analysisView === 'manufacturer' ? styles.analysisTabActive : styles.analysisTab}
                      onClick={() => setAnalysisView('manufacturer')}
                    >
                      제조사별
                    </button>
                  )}
                  {isManualOffSummary && (
                    <button
                      type="button"
                      style={analysisView === 'site' ? styles.analysisTabActive : styles.analysisTab}
                      onClick={() => setAnalysisView('site')}
                    >
                      충전소별
                    </button>
                  )}
                </div>
              )}
              {hasSpeedSummary && (
                <div style={styles.analysisTabRow}>
                  <button
                    type="button"
                    style={chargerSpeedFilter === 'all' ? styles.analysisTabActive : styles.analysisTab}
                    onClick={() => setChargerSpeedFilter('all')}
                  >
                    전체
                  </button>
                  <button
                    type="button"
                    style={chargerSpeedFilter === 'slow' ? styles.analysisTabActive : styles.analysisTab}
                    onClick={() => setChargerSpeedFilter('slow')}
                  >
                    완속
                  </button>
                  <button
                    type="button"
                    style={chargerSpeedFilter === 'fast' ? styles.analysisTabActive : styles.analysisTab}
                    onClick={() => setChargerSpeedFilter('fast')}
                  >
                    급속
                  </button>
                </div>
              )}
              <div style={styles.modelAnalysisTitle}>{isRegionView ? '권역별 분석' : (isManufacturerView ? '제조사별 분석' : (isSiteView ? '충전소별 분석' : (hasSpeedSummary ? `${summaryTargetLabel} 모델별 분석` : '모델별 분석')))}</div>
              <div style={styles.modelAnalysisDesc}>
                {isRegionView
                  ? (hasRichAnalysis ? '권역별 수량과 충전소 분포를 표와 막대 그래프로 확인합니다.' : '임의 OFF가 집중된 권역을 표와 막대 그래프로 먼저 확인합니다.')
                  : (isManufacturerView
                    ? '모델분류명에서 언더바(_) 앞 문자를 기준으로 제조사를 묶어 확인합니다.'
                    : (isSiteView
                      ? '대상 수량이 많은 충전소와 마지막 수집일을 간단히 확인합니다.'
                      : (hasRichAnalysis
                        ? '기본값은 전체이며, 완속/급속을 선택해 모델별, 권역별, 제조사별 분포를 확인할 수 있습니다.'
                        : (isManualOffSummary
                          ? '기본값은 전체이며, 완속/급속을 선택해 임의 OFF 분포를 확인할 수 있습니다.'
                          : (isNormal
                          ? '모델별 수량과 정상 운영 전체 대비 비중입니다.'
                          : '설치대비는 해당 모델 전체 설치 수량 대비 현재 카드 대상 수량 비율입니다.')))))}
              </div>
            </div>
            <div style={styles.modelAnalysisHeaderRight}>
              {(isRegionView || isManufacturerView) ? (
                <div style={styles.modelSortButtonRow}>
                  <span style={styles.modelSortLabel}>정렬기준</span>
                  <button
                    type="button"
                    style={regionSortType === 'count' ? styles.modelSortButtonActive : styles.modelSortButton}
                    onClick={() => setRegionSortType('count')}
                  >
                    수량순
                  </button>
                  <button
                    type="button"
                    style={regionSortType === 'siteCount' ? styles.modelSortButtonActive : styles.modelSortButton}
                    onClick={() => setRegionSortType('siteCount')}
                  >
                    충전소순
                  </button>
                  <button
                    type="button"
                    style={regionSortType === 'shareRate' ? styles.modelSortButtonActive : styles.modelSortButton}
                    onClick={() => setRegionSortType('shareRate')}
                  >
                    비중순
                  </button>
                </div>
              ) : isSiteView ? (
                <div style={styles.modelSortButtonRow}>
                  <span style={styles.modelSortLabel}>정렬기준</span>
                  <button
                    type="button"
                    style={siteSortType === 'targetCount' ? styles.modelSortButtonActive : styles.modelSortButton}
                    onClick={() => setSiteSortType('targetCount')}
                  >
                    수량순
                  </button>
                  <button
                    type="button"
                    style={siteSortType === 'latestCollectedOld' ? styles.modelSortButtonActive : styles.modelSortButton}
                    onClick={() => setSiteSortType('latestCollectedOld')}
                  >
                    미수집 오래된순
                  </button>
                  <button
                    type="button"
                    style={siteSortType === 'latestCollectedNew' ? styles.modelSortButtonActive : styles.modelSortButton}
                    onClick={() => setSiteSortType('latestCollectedNew')}
                  >
                    최근 수집순
                  </button>
                </div>
              ) : (
                !(isNormal || isTotalSummary) && (
                  <div style={styles.modelSortButtonRow}>
                    <span style={styles.modelSortLabel}>정렬기준</span>
                    <button
                      type="button"
                      style={modelSortType === 'count' ? styles.modelSortButtonActive : styles.modelSortButton}
                      onClick={() => setModelSortType('count')}
                    >
                      수량순
                    </button>
                    <button
                      type="button"
                      style={modelSortType === 'installedRate' ? styles.modelSortButtonActive : styles.modelSortButton}
                      onClick={() => setModelSortType('installedRate')}
                    >
                      동일 기종 설치 대비
                    </button>
                    <button
                      type="button"
                      style={modelSortType === 'faultRate' ? styles.modelSortButtonActive : styles.modelSortButton}
                      onClick={() => setModelSortType('faultRate')}
                    >
                      고장대비
                    </button>
                  </div>
                )
              )}
              <div style={styles.modelAnalysisBadge}>{headerBadge}</div>
            </div>
          </div>

          <div style={styles.modelListWrap}>
            {isRegionView ? (
              regionRows.length === 0 ? (
                <div style={styles.modalEmpty}>표시할 데이터가 없습니다.</div>
              ) : (
                sortedRegionRows.map((item, idx) => {
                  const count = item.chargerCount || 0;
                  const siteCount = item.siteCount || 0;
                  const shareRate = item.shareRate || 0;
                  const barPercent = Math.min((count / maxRegionCount) * 100, 100);

                  return (
                    <div key={`${item.region}-${idx}`} style={styles.regionRowCard}>
                      <div style={styles.modelRank}>{idx + 1}</div>

                      <div style={styles.modelNameBlock}>
                        <div style={styles.modelName}>{item.region || '지역 미기재'}</div>
                        <div style={styles.modelSub}>{isManualOffSummary ? '임의 OFF' : summaryTargetLabel} {count.toLocaleString()}기 · {siteCount.toLocaleString()}개소</div>
                        <div style={styles.modelBarTrack}>
                          <div style={{ ...styles.modelBarFill, width: `${barPercent}%` }} />
                        </div>
                      </div>

                      <div style={styles.modelMetricGrid3}>
                        <div style={styles.modelMetricBox}>
                          <div style={styles.modelMetricLabel}>수량</div>
                          <div style={styles.modelMetricValue}>{count.toLocaleString()}기</div>
                        </div>
                        <div style={styles.modelMetricBox}>
                          <div style={styles.modelMetricLabel}>충전소</div>
                          <div style={styles.modelMetricValue}>{siteCount.toLocaleString()}개소</div>
                        </div>
                        <div style={styles.modelMetricBox}>
                          <div style={styles.modelMetricLabel}>비중</div>
                          <div style={styles.modelMetricValue}>{shareRate}%</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            ) : isManufacturerView ? (
              manufacturerRows.length === 0 ? (
                <div style={styles.modalEmpty}>표시할 데이터가 없습니다.</div>
              ) : (
                sortedManufacturerRows.map((item, idx) => {
                  const count = item.chargerCount || 0;
                  const siteCount = item.siteCount || 0;
                  const shareRate = item.shareRate || 0;
                  const barPercent = Math.min((count / maxManufacturerCount) * 100, 100);

                  return (
                    <div key={`${item.manufacturer}-${idx}`} style={styles.regionRowCard}>
                      <div style={styles.modelRank}>{idx + 1}</div>

                      <div style={styles.modelNameBlock}>
                        <div style={styles.modelName}>{item.manufacturer || '기타'}</div>
                        <div style={styles.modelSub}>{summaryTargetLabel} {count.toLocaleString()}기 · {siteCount.toLocaleString()}개소</div>
                        <div style={styles.modelBarTrack}>
                          <div style={{ ...styles.modelBarFill, width: `${barPercent}%` }} />
                        </div>
                      </div>

                      <div style={styles.modelMetricGrid3}>
                        <div style={styles.modelMetricBox}>
                          <div style={styles.modelMetricLabel}>수량</div>
                          <div style={styles.modelMetricValue}>{count.toLocaleString()}기</div>
                        </div>
                        <div style={styles.modelMetricBox}>
                          <div style={styles.modelMetricLabel}>충전소</div>
                          <div style={styles.modelMetricValue}>{siteCount.toLocaleString()}개소</div>
                        </div>
                        <div style={styles.modelMetricBox}>
                          <div style={styles.modelMetricLabel}>비중</div>
                          <div style={styles.modelMetricValue}>{shareRate}%</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            ) : isSiteView ? (
              siteRows.length === 0 ? (
                <div style={styles.modalEmpty}>표시할 데이터가 없습니다.</div>
              ) : (
                sortedSiteRows.map((item, idx) => {
                  const count = item.chargerCount || 0;
                  const latestCollectedText = item.latestCollectedAtText || '-';
                  const barPercent = Math.min((count / maxSiteCount) * 72, 72);

                  return (
                    <div key={`${item.siteKey || item.siteId || item.siteName}-${idx}`} style={styles.siteRowCard}>
                      <div style={styles.modelRank}>{idx + 1}</div>

                      <div style={styles.modelNameBlock}>
                        <div style={styles.modelName}>{item.siteName || '충전소명 미기재'}</div>
                        <div style={styles.modelSub}>
                          사이트 ID {item.siteId || '-'}{item.address && item.address !== '-' ? ` · ${item.address}` : ''}
                        </div>
                        <div style={styles.siteBarTrack}>
                          <div style={{ ...styles.modelBarFill, width: `${barPercent}%` }} />
                        </div>
                      </div>

                      <div style={styles.siteCompactGrid}>
                        <div style={styles.siteCompactHead}>모델</div>
                        <div style={styles.siteCompactHead}>수량</div>
                        <div style={styles.siteCompactHead}>마지막 수집</div>
                        <div style={styles.siteCompactValue}>{item.mainModel || '-'}</div>
                        <div style={styles.siteCompactValue}>{count.toLocaleString()}기</div>
                        <div style={styles.siteCompactValue}>{latestCollectedText}</div>
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              modelRows.length === 0 ? (
                <div style={styles.modalEmpty}>표시할 데이터가 없습니다.</div>
              ) : (
                sortedModelRows.map((item, idx) => {
                  const count = item.count || 0;
                  const installedTotal = item._installedTotal ?? getInstalledTotal(item.name);
                  const normalPercent = totalCount > 0 ? Math.round((count / totalCount) * 1000) / 10 : 0;
                  const installedRate = item._installedRate ?? (installedTotal > 0 ? Math.round((count / installedTotal) * 1000) / 10 : 0);
                  const faultRate = item._faultRate ?? (totalCount > 0
                    ? Math.round((count / totalCount) * 1000) / 10
                    : 0);
                  const barPercent = Math.min((count / maxModelCount) * 100, 100);

                  return (
                    <div key={`${item.name}-${idx}`} style={styles.modelRowCard}>
                      <div style={styles.modelRank}>{idx + 1}</div>

                      <div style={styles.modelNameBlock}>
                        <div style={styles.modelName}>{item.name || '기타'}</div>
                        <div style={styles.modelSub}>
                          {isNormal
                            ? `정상 운영 ${count.toLocaleString()}기 기준`
                            : (isTotalSummary
                              ? `전체 충전기 ${count.toLocaleString()}기 기준`
                              : `설치 ${installedTotal.toLocaleString()}기 기준`)}
                        </div>
                        <div style={styles.modelBarTrack}>
                          <div style={{ ...styles.modelBarFill, width: `${barPercent}%` }} />
                        </div>
                      </div>

                      <div style={(isNormal || isTotalSummary) ? styles.modelMetricGrid2 : styles.modelMetricGrid3}>
                        <div style={styles.modelMetricBox}>
                          <div style={styles.modelMetricLabel}>수량</div>
                          <div style={styles.modelMetricValue}>{count.toLocaleString()}기</div>
                        </div>

                        {(isNormal || isTotalSummary) ? (
                          <div style={styles.modelMetricBox}>
                            <div style={styles.modelMetricLabel}>비중</div>
                            <div style={styles.modelMetricValue}>{normalPercent}%</div>
                          </div>
                        ) : (
                          <>
                            <div style={styles.modelMetricBox}>
                              <div style={styles.modelMetricLabel}>
                                동일 기종
                                <br />
                                설치 대비
                              </div>
                              <div style={styles.modelMetricValue}>{installedRate}%</div>
                            </div>
                            <div style={styles.modelMetricBox}>
                              <div style={styles.modelMetricLabel}>고장대비</div>
                              <div style={styles.modelMetricValue}>{faultRate}%</div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )
            )}
          </div>

          {isManualOffSummary && (isRegionView || isSiteView) && (
            <div style={styles.modelFootnote}>
              {isRegionView
                ? '※ 권역별 분석의 비중은 현재 선택된 대상 수량 대비 해당 권역 수량 비율입니다.'
                : '※ 충전소별 분석의 수량은 임의 OFF 수량이며, 마지막 수집은 해당 충전소 대상 충전기 중 가장 최근 수집일입니다.'}
            </div>
          )}
          {isTotalSummary && isManufacturerView && (
            <div style={styles.modelFootnote}>
              ※ 제조사별 분석은 모델분류명에서 언더바(_) 앞 문자를 기준으로 묶습니다. 예: 에버온_구형대, 에버온_신형소 → 에버온
            </div>
          )}
        </div>

        <div style={styles.modalFooter}>
          <button style={styles.secondaryButton} onClick={onClose}>닫기</button>
          <button style={styles.primarySmallButton} onClick={onGoDetails}>상세내역 보기</button>
        </div>
      </div>
    </div>
  );
}


function VocKpiCard({ label, value, hint, color, bg }) {
  return (
    <div style={{ ...styles.vocKpiCard, borderColor: `${color}22` }}>
      <div style={{ ...styles.vocKpiIcon, background: bg, color }}>●</div>
      <div>
        <div style={styles.vocKpiLabel}>{label}</div>
        <div style={{ ...styles.vocKpiValue, color }}>{value}</div>
        <div style={styles.vocKpiHint}>{hint}</div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #eef2f7 0%, #e9eef5 100%)',
    padding: 20,
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
    maxWidth: 1440,
    minHeight: 'calc(100vh - 40px)',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: '196px minmax(0, 1fr)',
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
    padding: '9px 12px',
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
    padding: 14,
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
    padding: 28,
    minWidth: 0,
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
  roleButton: {
    border: `1px solid ${COLORS.blue}`,
    background: COLORS.blueSoft,
    color: COLORS.blue,
    borderRadius: 10,
    padding: '8px 12px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  roleButtonMuted: {
    border: `1px solid ${COLORS.border}`,
    background: COLORS.lightGraySoft,
    color: COLORS.slate,
    borderRadius: 10,
    padding: '8px 12px',
    fontWeight: 900,
    cursor: 'pointer',
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
  operatingOverviewCard: {
    position: 'relative',
    overflow: 'hidden',
    background: `linear-gradient(90deg, ${COLORS.blueSoft} 0%, #fffaf0 48%, ${COLORS.greenSoft} 100%)`,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 24,
    padding: 22,
    marginBottom: 18,
    boxShadow: COLORS.shadow,
  },
  operatingOverviewHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  operatingEyebrow: { fontSize: 12, fontWeight: 900, color: COLORS.slate, letterSpacing: '0.04em', marginBottom: 5 },
  operatingTitle: { fontSize: 18, fontWeight: 900, color: COLORS.text, letterSpacing: '-0.02em' },
  operatingHeaderBadge: {
    border: `1px solid ${COLORS.border}`,
    background: 'rgba(255,255,255,0.72)',
    color: COLORS.slate,
    padding: '8px 12px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: 'nowrap',
  },
  operatingConnectedGrid: {
    display: 'grid',
    gridTemplateColumns: '1.15fr 0.75fr 1.10fr',
    overflow: 'hidden',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 18,
    background: 'rgba(255,255,255,0.68)',
  },
  operatingSegment: {
    position: 'relative',
    minHeight: 118,
    padding: '18px 22px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    borderRight: `1px solid ${COLORS.border}`,
    transition: 'transform 0.15s ease, background 0.15s ease',
  },
  operatingSegmentTotal: { background: 'linear-gradient(135deg, rgba(234,242,255,0.96), rgba(255,255,255,0.72))' },
  operatingSegmentApproval: { background: 'linear-gradient(135deg, rgba(255,245,231,0.94), rgba(255,255,255,0.72))' },
  operatingSegmentNormal: { background: 'linear-gradient(135deg, rgba(235,251,241,0.96), rgba(255,255,255,0.72))', borderRight: 'none' },
  operatingSegmentHeaderLine: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
  operatingSegmentIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    display: 'grid',
    placeItems: 'center',
    background: COLORS.blueSoft,
    boxShadow: 'inset 0 0 0 1px rgba(29,99,233,0.12)',
  },
  operatingSegmentIconTopRight: {
    position: 'absolute',
    top: 16,
    right: 18,
    width: 42,
    height: 42,
    borderRadius: 14,
    display: 'grid',
    placeItems: 'center',
    background: 'rgba(234,242,255,0.92)',
    boxShadow: 'inset 0 0 0 1px rgba(29,99,233,0.12)',
  },
  operatingSegmentTitle: { fontSize: 15, fontWeight: 900, marginBottom: 10 },
  operatingSegmentValue: { fontSize: 34, fontWeight: 950, color: COLORS.text, letterSpacing: '-0.04em', marginBottom: 8 },
  operatingSegmentSub: { fontSize: 13, color: COLORS.sub, fontWeight: 800, lineHeight: 1.45 },
  operatingFootNote: { marginTop: 12, color: COLORS.sub, fontSize: 12, fontWeight: 700 },
  topStatusGrid: { display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 18, marginBottom: 18, alignItems: 'stretch' },
  topMetricStack: { display: 'grid', gridTemplateRows: 'repeat(3, minmax(0, 1fr))', gap: 8, minHeight: 194 },
  faultDashboardGrid: { display: 'grid', gridTemplateColumns: '440px minmax(0, 1fr)', gap: 18, marginBottom: 18, alignItems: 'stretch' },
  subCardGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 18, marginBottom: 18 },
  middleGrid: { display: 'grid', gridTemplateColumns: '260px 260px 1fr', gap: 18, marginBottom: 18, alignItems: 'stretch' },
  topGrid: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18, marginBottom: 18 },
  panel: {
    background: COLORS.panel,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 22,
    padding: 22,
    boxShadow: COLORS.shadow,
  },
  faultChartPanel: {
    background: 'linear-gradient(135deg, #ffffff 0%, #fafafa 58%, #f5f3ff 100%)',
    border: `1px solid ${COLORS.violet}22`,
    padding: '10px 18px',
  },
  card: {
    position: 'relative',
    background: COLORS.panel,
    borderRadius: 22,
    padding: 22,
    minHeight: 154,
    overflow: 'hidden',
  },
  compactCard: {
    minHeight: 118,
    padding: '14px 20px',
  },
  cardTopRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  cardTitle: { fontSize: 14, fontWeight: 800, marginBottom: 4 },
  cardValue: { fontSize: 30, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em' },
  cardSub: { fontSize: 13, color: COLORS.sub, lineHeight: 1.55, maxWidth: '82%' },
  heroStatusCard: {
    position: 'relative',
    background: COLORS.panel,
    borderRadius: 22,
    padding: '24px 32px',
    minHeight: 194,
    overflow: 'hidden',
    boxShadow: COLORS.shadow,
  },
  heroStatusBody: { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 28 },
  heroStatusTitle: { fontSize: 16, fontWeight: 900, marginBottom: 14 },
  heroStatusValue: { fontSize: 40, fontWeight: 900, marginBottom: 10, letterSpacing: '-0.04em' },
  heroStatusSub: { fontSize: 14, color: COLORS.sub, lineHeight: 1.6, fontWeight: 700 },
  heroMetricIconWrap: {
    flexShrink: 0,
    width: 64,
    height: 64,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topMiniMetric: {
    background: COLORS.panel,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 18,
    padding: '10px 16px',
    boxShadow: COLORS.shadow,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 56,
  },
  topMiniTextArea: { minWidth: 0 },
  topMiniTitle: { fontSize: 12.5, fontWeight: 900, marginBottom: 3, whiteSpace: 'nowrap' },
  topMiniSub: { fontSize: 11, color: COLORS.sub, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 310 },
  topMiniValue: { flexShrink: 0, fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em', color: COLORS.text },
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
  detailActionRow: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' },
  donutLayout: { display: 'grid', gridTemplateColumns: '170px minmax(0, 1fr)', gap: 14, alignItems: 'center' },
  donutWrap: { display: 'flex', justifyContent: 'center', alignItems: 'center' },
  donut: { width: 150, height: 150, borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center' },
  donutInner: {
    width: 78,
    height: 78,
    borderRadius: '50%',
    background: '#fff',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column',
    boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.06)',
  },
  donutLabel: { fontSize: 11, color: COLORS.sub },
  donutLegendStack: { display: 'grid', gap: 8, width: 390, maxWidth: '100%', justifySelf: 'start' },
  donutValue: { fontSize: 18, fontWeight: 800, marginTop: 3 },
  legendItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#f8fbff',
    border: `1px solid ${COLORS.line}`,
    borderRadius: 12,
    padding: '9px 12px',
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
  summaryGrid4: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 },
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
    padding: '9px 12px',
    fontSize: 14,
    boxSizing: 'border-box',
    background: '#fff',
    outline: 'none',
  },
  inputNarrow: {
    width: '100%',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 12,
    padding: '9px 12px',
    fontSize: 14,
    boxSizing: 'border-box',
    background: '#fff',
    outline: 'none',
  },
  select: {
    width: '100%',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 12,
    padding: '9px 12px',
    fontSize: 14,
    background: '#fff',
    outline: 'none',
  },
  selectWide: {
    width: '100%',
    minWidth: 210,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 12,
    padding: '9px 12px',
    fontSize: 14,
    background: '#fff',
    outline: 'none',
  },
  countBox: {
    background: '#f8fbff',
    border: `1px solid ${COLORS.line}`,
    borderRadius: 12,
    padding: '9px 12px',
    display: 'flex',
    alignItems: 'center',
  },
  tableWrap: { overflowX: 'auto', border: `1px solid ${COLORS.border}`, borderRadius: 16 },
  detailTableWrap: { overflow: 'auto', maxHeight: 760, border: `1px solid ${COLORS.border}`, borderRadius: 16 },
  table: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 13 },
  statusCell: { whiteSpace: 'nowrap', minWidth: 92 },
  statusNowrap: { display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', fontWeight: 900, fontSize: 13 },
  nowrapCell: { whiteSpace: 'nowrap', fontSize: 13 },
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
  dateFilterRow3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 12 },
  partSummaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 },
  partCompareGrid: { 
  display: 'grid', 
  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', 
  gap: 8 
},
  partCompareCard: {
    background: '#f8fbff',
    border: `1px solid ${COLORS.line}`,
    borderRadius: 18,
    padding: 16,
    display: 'grid',
    gap: 8,
  },
  partCompareTitle: { color: COLORS.slate, fontSize: 14, fontWeight: 900 },
  partCompareMain: { color: COLORS.text, fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em' },
  partCompareSub: { color: COLORS.sub, fontSize: 13, fontWeight: 700 },
  partCompareDiff: { fontSize: 14, fontWeight: 900 },
  compactContentCell: { whiteSpace: 'pre-line', lineHeight: 1.55, fontSize: 13, color: COLORS.slate },
  vocHeroPanel: {
    background: 'linear-gradient(135deg, #ffffff 0%, #eef6ff 52%, #f3edff 100%)',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 24,
    padding: 24,
    boxShadow: '0 16px 42px rgba(29, 99, 233, 0.10)',
  },
  vocHeroTop: { display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 18 },
  vocControlBox: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' },
  vocSortSelect: {
    border: `1px solid ${COLORS.border}`,
    background: 'rgba(255,255,255,0.82)',
    color: COLORS.text,
    borderRadius: 16,
    padding: '13px 14px',
    fontSize: 14,
    fontWeight: 800,
    outline: 'none',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)',
  },
  vocEyebrow: { color: COLORS.blue, fontSize: 12, fontWeight: 900, letterSpacing: '0.12em', marginBottom: 8 },
  vocHeroTitle: { fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 8 },
  vocHeroSub: { color: COLORS.sub, fontSize: 14, lineHeight: 1.5 },
  vocDateBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'rgba(255,255,255,0.78)',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 16,
    padding: 10,
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)',
  },
  vocDateInput: {
    border: 'none',
    background: 'transparent',
    color: COLORS.text,
    fontWeight: 800,
    outline: 'none',
    fontSize: 14,
  },
  vocDateDivider: { color: COLORS.sub, fontWeight: 800 },
  vocKpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 },
  vocKpiCard: {
    background: 'rgba(255,255,255,0.86)',
    border: `1px solid ${COLORS.line}`,
    borderRadius: 18,
    padding: 16,
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
    boxShadow: '0 10px 24px rgba(15,23,42,0.05)',
  },
  vocKpiIcon: { width: 34, height: 34, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 },
  vocKpiLabel: { color: COLORS.sub, fontSize: 13, fontWeight: 800, marginBottom: 6 },
  vocKpiValue: { fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 4 },
  vocKpiHint: { color: COLORS.sub, fontSize: 12, lineHeight: 1.4 },
  sectionSubText: { color: COLORS.sub, fontSize: 13, marginTop: 6 },
  fixedOrgBadge: { background: COLORS.blueSoft, color: COLORS.blue, border: `1px solid ${COLORS.blue}22`, borderRadius: 999, padding: '10px 14px', fontSize: 13, fontWeight: 900, height: 'fit-content', whiteSpace: 'nowrap' },
  tableWrapModern: { overflowX: 'auto', border: `1px solid ${COLORS.border}`, borderRadius: 18, background: '#fff' },
  tableModern: { width: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed', fontSize: 14 },
  rankBadge: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 999, background: COLORS.lightGraySoft, color: COLORS.slate, fontWeight: 900 },
  rankBadgeTop: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 999, background: COLORS.blueSoft, color: COLORS.blue, fontWeight: 900 },
  orgBadge: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: COLORS.slateSoft, color: COLORS.slate, padding: '6px 10px', fontSize: 12, fontWeight: 800 },
  completeBadge: { color: COLORS.green, background: COLORS.greenSoft, borderRadius: 999, padding: '6px 10px', fontWeight: 900 },
  pendingBadge: { color: COLORS.orange, background: COLORS.orangeSoft, borderRadius: 999, padding: '6px 10px', fontWeight: 900 },
  rateCell: { display: 'grid', gridTemplateColumns: '1fr 52px', gap: 10, alignItems: 'center' },
  rateTrack: { height: 10, borderRadius: 999, background: '#edf2f7', overflow: 'hidden' },
  rateFill: { height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${COLORS.blue}, ${COLORS.violet})` },
  actionButtonWrap: { display: 'flex', gap: 8, justifyContent: 'center' },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.38)',
    backdropFilter: 'blur(5px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 24,
  },
  modalBox: {
    width: 'min(1120px, 100%)',
    maxHeight: '88vh',
    overflowY: 'auto',
    background: COLORS.panel,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 26,
    boxShadow: '0 24px 70px rgba(15, 23, 42, 0.22)',
    padding: 24,
  },
  modalHeader: { display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 18 },
  modalEyebrow: { color: COLORS.blue, fontSize: 12, fontWeight: 900, letterSpacing: '0.12em', marginBottom: 6 },
  modalTitle: { fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em' },
  modalSubText: { color: COLORS.sub, fontSize: 13, marginTop: 8 },
  modalCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    border: `1px solid ${COLORS.border}`,
    background: COLORS.panelSoft,
    color: COLORS.slate,
    fontSize: 24,
    lineHeight: 1,
    cursor: 'pointer',
    fontWeight: 800,
  },
  modalKpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 16 },
  modalKpiCard: {
    background: 'linear-gradient(135deg, #ffffff 0%, #f1f8ff 100%)',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 18,
    padding: 16,
    boxShadow: '0 10px 26px rgba(31, 125, 232, 0.08)',
  },
  modalKpiLabel: { color: COLORS.sub, fontSize: 13, fontWeight: 800, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 },
  modalKpiEmoji: { fontSize: 17, lineHeight: 1 },
  modalKpiValue: { color: COLORS.text, fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em' },
  modalContentGrid: { display: 'grid', gridTemplateColumns: '1fr', gap: 14 },
  modalSectionBox: {
    background: '#fff',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 20,
    padding: 18,
  },
  modalSectionTitle: { fontSize: 16, fontWeight: 900, marginBottom: 14 },
  modalListWrap: { display: 'grid', gap: 12 },
  modalListItem: { display: 'grid', gap: 8, background: '#f8fbff', border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: '12px 14px' },
  modalListTop: { display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) 330px', gap: 14, alignItems: 'center', fontSize: 14 },
  modalListTextBlock: { minWidth: 0, flex: 1 },
  modalListName: { color: COLORS.text, fontWeight: 900, lineHeight: 1.25, wordBreak: 'keep-all' },
  modalListId: { marginTop: 4, fontSize: 12, color: COLORS.sub, fontWeight: 800 },
  modalListCount: { fontWeight: 900, color: COLORS.text, whiteSpace: 'nowrap', minWidth: 92, textAlign: 'center', flexShrink: 0 },
  modalBarTrack: { height: 9, borderRadius: 999, background: '#edf2f7', overflow: 'hidden' },
  modalBarFill: { height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${COLORS.blue}, ${COLORS.violet})` },
  modalMiniList: { display: 'grid', gap: 10 },
  modalMiniItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    background: '#f8fbff',
    border: `1px solid ${COLORS.line}`,
    borderRadius: 12,
    padding: '11px 12px',
    color: COLORS.slate,
    fontSize: 13,
    fontWeight: 700,
  },
  modalMiniTextBlock: { minWidth: 0, flex: 1 },
  modalMiniName: { fontWeight: 900, color: COLORS.slate, lineHeight: 1.35, wordBreak: 'keep-all' },
  modalMiniId: { marginTop: 4, fontSize: 12, color: COLORS.sub, fontWeight: 800 },
  modalMiniCount: { fontWeight: 900, color: COLORS.slate, whiteSpace: 'nowrap', minWidth: 78, textAlign: 'right', flexShrink: 0 },
  modalEmpty: { color: COLORS.sub, fontSize: 14, padding: 12, background: '#f8fbff', borderRadius: 12 },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  primarySmallButton: {
    background: COLORS.blue,
    color: '#fff',
    border: 'none',
    padding: '10px 14px',
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 800,
    boxShadow: '0 8px 18px rgba(29, 99, 233, 0.20)',
  },
  modelModalBox: {
    width: 'min(1120px, 100%)',
    maxHeight: '88vh',
    overflowY: 'auto',
    background: 'linear-gradient(180deg, #ffffff 0%, #f7fbff 100%)',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 26,
    boxShadow: '0 26px 76px rgba(31, 125, 232, 0.20)',
    padding: 24,
  },
  modelAnalysisBox: {
    background: 'linear-gradient(180deg, #ffffff 0%, #f9fcff 100%)',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 20,
    padding: 18,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
  },
  modelAnalysisHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 16,
  },
  analysisTabRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: '#eef5ff',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 999,
    padding: 4,
    marginBottom: 12,
  },
  analysisTab: {
    background: 'transparent',
    color: COLORS.slate,
    border: 'none',
    borderRadius: 999,
    padding: '8px 13px',
    fontSize: 13,
    fontWeight: 900,
    cursor: 'pointer',
  },
  analysisTabActive: {
    background: '#ffffff',
    color: COLORS.blue,
    border: `1px solid ${COLORS.blue}33`,
    borderRadius: 999,
    padding: '8px 13px',
    fontSize: 13,
    fontWeight: 900,
    cursor: 'pointer',
    boxShadow: '0 5px 14px rgba(29, 99, 233, 0.12)',
  },
  modelAnalysisTitle: {
    fontSize: 17,
    fontWeight: 900,
    color: COLORS.text,
    marginBottom: 8,
  },
  modelAnalysisDesc: {
    color: COLORS.sub,
    fontSize: 13,
    lineHeight: 1.45,
  },
  modelAnalysisHeaderRight: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    flexWrap: 'wrap',
  },
  modelAnalysisBadge: {
    background: COLORS.blueSoft,
    color: COLORS.blue,
    border: `1px solid ${COLORS.blue}22`,
    borderRadius: 999,
    padding: '10px 14px',
    fontSize: 13,
    fontWeight: 900,
    whiteSpace: 'nowrap',
  },
  modelSortButtonRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    flexWrap: 'wrap',
  },
  modelSortLabel: {
    color: COLORS.sub,
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: 'nowrap',
  },
  modelSortButton: {
    background: '#fff',
    color: COLORS.slate,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 999,
    padding: '9px 12px',
    fontSize: 12,
    fontWeight: 900,
    cursor: 'pointer',
  },
  modelSortButtonActive: {
    background: '#ffffff',
    color: COLORS.blue,
    border: `1px solid ${COLORS.blue}`,
    borderRadius: 999,
    padding: '9px 12px',
    fontSize: 12,
    fontWeight: 900,
    cursor: 'pointer',
    boxShadow: 'inset 0 0 0 1px rgba(31, 125, 232, 0.12)',
  },
  modelListWrap: {
    display: 'grid',
    gap: 10,
  },
  modelRowCard: {
    display: 'grid',
    gridTemplateColumns: '34px minmax(260px, 1fr) auto',
    gap: 14,
    alignItems: 'center',
    background: 'linear-gradient(180deg, #ffffff 0%, #f7fbff 100%)',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 16,
    padding: '12px 12px',
    boxShadow: '0 8px 22px rgba(31, 125, 232, 0.07)',
  },
  regionRowCard: {
    display: 'grid',
    gridTemplateColumns: '34px minmax(260px, 1fr) auto',
    gap: 14,
    alignItems: 'center',
    background: 'linear-gradient(180deg, #ffffff 0%, #f7fbff 100%)',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 16,
    padding: '12px 12px',
    boxShadow: '0 8px 22px rgba(31, 125, 232, 0.07)',
  },
  siteRowCard: {
    display: 'grid',
    gridTemplateColumns: '34px minmax(260px, 1fr) 300px',
    gap: 14,
    alignItems: 'center',
    background: 'linear-gradient(180deg, #ffffff 0%, #f7fbff 100%)',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 16,
    padding: '12px 12px',
    boxShadow: '0 8px 22px rgba(31, 125, 232, 0.07)',
  },
  modelRank: {
    width: 28,
    height: 28,
    borderRadius: 999,
    background: 'linear-gradient(135deg, #58b9ff 0%, #0b74e8 100%)',
    border: '2px solid #ffffff',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 900,
  },
  modelNameBlock: {
    minWidth: 0,
  },
  modelName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 900,
    lineHeight: 1.25,
    wordBreak: 'keep-all',
  },
  modelSub: {
    color: COLORS.sub,
    fontSize: 12,
    fontWeight: 800,
    marginTop: 5,
    marginBottom: 8,
  },
  modelBarTrack: {
    height: 8,
    borderRadius: 999,
    background: '#e8f2fc',
    overflow: 'hidden',
  },
  siteBarTrack: {
    width: '72%',
    maxWidth: 440,
    height: 8,
    borderRadius: 999,
    background: '#e8f2fc',
    overflow: 'hidden',
  },
  modelBarFill: {
    height: '100%',
    borderRadius: 999,
    background: 'linear-gradient(90deg, #52b6ff 0%, #0b74e8 55%, #235fe8 100%)',
    boxShadow: '0 0 12px rgba(31, 125, 232, 0.28)',
  },
  siteCompactGrid: {
    display: 'grid',
    gridTemplateColumns: '1.25fr 0.7fr 1fr',
    gap: '6px 8px',
    alignItems: 'center',
    background: 'linear-gradient(180deg, #ffffff 0%, #f4f9ff 100%)',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 12,
    padding: '9px 10px',
    minWidth: 0,
  },
  siteCompactHead: {
    color: COLORS.slate,
    fontSize: 11,
    fontWeight: 900,
    textAlign: 'center',
    whiteSpace: 'nowrap',
  },
  siteCompactValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: 900,
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  modelMetricGrid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 104px)',
    gap: 8,
  },
  modelMetricGrid3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 104px)',
    gap: 8,
  },
  modelMetricGrid4: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 92px)',
    gap: 8,
  },
  modelMetricBox: {
    background: 'linear-gradient(180deg, #ffffff 0%, #f4f9ff 100%)',
    border: `1px solid ${COLORS.border}`,
    borderRadius: 10,
    padding: '9px 8px',
    minHeight: 54,
    display: 'grid',
    alignContent: 'center',
    textAlign: 'center',
  },
  modelMetricLabel: {
    color: COLORS.slate,
    fontSize: 11,
    fontWeight: 900,
    marginBottom: 5,
    lineHeight: 1.15,
    textAlign: 'center',
  },
  modelMetricValue: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: 900,
    whiteSpace: 'nowrap',
  },
  modelFootnote: {
    color: COLORS.sub,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 14,
  },
};

