/**
 * 从文件名中提取时间信息的工具函数
 * @param filename 文件名
 * @returns 解析出的Date对象，如果无法解析则返回null
 */
export function extractTimeFromFilename(filename: string): Date | null {
  // 常见的时间格式正则表达式模式[6,7](@ref)
  const timePatterns = [
    // 格式: YYYY-MM-DD_HHmmss 或 YYYY-MM-DD HHmmss (如：2025-09-27_143052)
    /(\d{4})[-/](\d{1,2})[-/](\d{1,2})[_\sT]?(\d{1,2})?(\d{1,2})?(\d{1,2})?/,

    // 格式: YYYYMMDD_HHmmss 或 YYYYMMDDHHmmss (如：20250927_143052)
    /(\d{4})(\d{2})(\d{2})[_\sT]?(\d{2})?(\d{2})?(\d{2})?/,

    // 格式: 带时间分隔符的 YYYY-MM-DD HH:mm:ss (如：2025-09-27 14:30:52)
    /(\d{4})[-/](\d{1,2})[-/](\d{1,2})[_\sT](\d{1,2}):(\d{1,2}):(\d{1,2})/,

    // 格式: 中文日期格式 (如：2025年09月27日14时30分52秒)
    /(\d{4})年(\d{1,2})月(\d{1,2})日[_\sT]?(\d{1,2})时?(\d{1,2})分?(\d{1,2})秒?/,
  ];

  for (const pattern of timePatterns) {
    const match = filename.match(pattern);
    if (match) {
      const date = parseMatchResult(match);
      if (date && isValidDate(date)) {
        return date;
      }
    }
  }

  if (extraTimestamp(filename)) {
    return extraTimestamp(filename);
  }

  return null;
}

const extraTimestamp = (filename: string): Date | null => {
  const timestampRegex = /\D(\d{13})\d/;
  const match = filename.match(timestampRegex);
  if (match) {
    const timestamp = parseInt(match[1], 10);
    const date = new Date(timestamp * 1000);
    return isValidDate(date) ? date : null;
  }
  return null;
};

/**
 * 解析正则匹配结果并构建Date对象
 */
function parseMatchResult(match: RegExpMatchArray): Date | null {
  try {
    // 提取年月日[7](@ref)
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // 月份从0开始
    const day = parseInt(match[3], 10);

    // 提取时分秒（如果存在）
    const hour = match[4] ? parseInt(match[4], 10) : 0;
    const minute = match[5] ? parseInt(match[5], 10) : 0;
    const second = match[6] ? parseInt(match[6], 10) : 0;

    return new Date(year, month, day, hour, minute, second);
  } catch (error) {
    return null;
  }
}

/**
 * 验证日期是否合法[7](@ref)
 */
function isValidDate(date: Date): boolean {
  if (isNaN(date.getTime())) {
    return false;
  }

  // 检查年月日是否在合理范围内
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  if (year < 2000 || year > new Date().getFullYear() + 1) return false;
  if (month < 0 || month > 11) return false;
  if (day < 1 || day > 31) return false;

  // 检查具体月份的天数是否合理
  const maxDay = new Date(year, month + 1, 0).getDate();
  return day <= maxDay;
}
