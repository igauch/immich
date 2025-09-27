/**
 * 从多个时间中找出最早的一个，并智能处理同一天的午夜(0点)时间。
 * @param timeStrings 可能包含多种格式的时间字符串数组
 * @returns 最早时间的字符串。如果无法找到有效时间，返回 null。
 */
function findEarliestTimeWithMidnightFilter(timeStrings: string[]): string | null {
  if (!timeStrings.length) return null;

  // 1. 转换并验证所有输入时间
  interface TimeData {
    original: string; // 原始字符串
    timestamp: number; // 时间戳（毫秒）
    dateKey: string;  // 用于分组的日期键 (YYYY-MM-DD)
    isMidnight: boolean; // 标记是否为该日期的0点
  }

  const validTimes: TimeData[] = [];

  for (const timeStr of timeStrings) {
    const date = new Date(timeStr);
    const timestamp = date.getTime();

    // 检查日期是否有效
    if (isNaN(timestamp)) {
      console.warn(`无效的日期格式将被忽略: "${timeStr}"`);
      continue;
    }

    // 生成日期键用于分组（例如 "2025-09-27"）
    const dateKey = date.toISOString().split('T')[0];

    // 检查是否为午夜 (小时、分钟、秒、毫秒均为0)
    const isMidnight = date.getHours() === 0 &&
      date.getMinutes() === 0 &&
      date.getSeconds() === 0 &&
      date.getMilliseconds() === 0;

    validTimes.push({
      original: timeStr,
      timestamp: timestamp,
      dateKey: dateKey,
      isMidnight: isMidnight
    });
  }

  if (validTimes.length === 0) {
    console.warn("未提供任何有效的时间。");
    return null;
  }

  // 2. 按日期分组
  const timesGroupedByDate: { [dateKey: string]: TimeData[] } = {};
  for (const timeData of validTimes) {
    if (!timesGroupedByDate[timeData.dateKey]) {
      timesGroupedByDate[timeData.dateKey] = [];
    }
    timesGroupedByDate[timeData.dateKey].push(timeData);
  }

  // 3. 对每个日期组，应用过滤规则，选出该日期的“最佳代表时间”
  const candidates: TimeData[] = [];

  for (const dateKey in timesGroupedByDate) {
    const timesOnSameDay = timesGroupedByDate[dateKey];

    // 检查该日期下是否存在非午夜时间
    const nonMidnightTimes = timesOnSameDay.filter(t => !t.isMidnight);

    if (nonMidnightTimes.length > 0) {
      // 规则：存在非午夜时间，则丢弃所有午夜时间，并选择最早的非午夜时间
      // 使用时间戳找出最早的那个
      const earliestNonMidnight = nonMidnightTimes.reduce((earliest, current) =>
        current.timestamp < earliest.timestamp ? current : earliest
      );
      candidates.push(earliestNonMidnight);
    } else {
      // 规则：只有午夜时间，则保留任意一个（这里选择第一个出现的）
      candidates.push(timesOnSameDay[0]);
    }
  }

  // 4. 从所有日期的“最佳代表时间”中，找出全局最早的时间
  if (candidates.length === 0) return null;

  const earliestCandidate = candidates.reduce((earliest, current) =>
    current.timestamp < earliest.timestamp ? current : earliest
  );

  return earliestCandidate.original;
}
