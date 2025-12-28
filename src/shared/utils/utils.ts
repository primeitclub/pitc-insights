export const getLastWeekFromStartDate = (startDate: string): string => {
      const lastWeek = new Date();
      // Subtract 7 days worth of milliseconds (1000ms * 60s * 60m * 24h * 7d)
      const start = new Date(startDate);
      lastWeek.setDate(start.getDate() - 6);
      return lastWeek.toISOString().split('T')[0];

}