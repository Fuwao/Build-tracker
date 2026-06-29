export function nowIso(): string {
  return new Date().toISOString();
}

// "YYYY-MM-DD" 形式(input type="date"用)で今日の日付を返す
export function todayDateInput(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ISO文字列を "YYYY-MM-DD HH:mm" の表示用に変換
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}/${m}/${day} ${hh}:${mm}`;
  } catch {
    return '-';
  }
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}/${m}/${day}`;
  } catch {
    return '-';
  }
}

// "YYYY-MM-DD"形式の日付入力をISO(その日の00:00、ローカル想定)へ変換
export function dateInputToIso(dateInput: string): string {
  if (!dateInput) return nowIso();
  const d = new Date(`${dateInput}T00:00:00`);
  if (isNaN(d.getTime())) return nowIso();
  return d.toISOString();
}

export function yearMonthOf(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '不明';
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function dateOnlyOf(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '不明';
  return formatDate(iso);
}
