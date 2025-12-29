/**
 * Returns the start date of the most recent complete week (7 days ago from today).
 * Used as default end date for weekly contribution queries.
 */
export const getLastWeekFromStartDate = (_startDate?: string): string => {
      const today = new Date();
      today.setDate(today.getDate() - 7);
      return today.toISOString().split('T')[0];
};

/**
 * Extracts the year from a date string (YYYY-MM-DD format).
 */
export const getYearFromDateString = (dateStr: string): number => {
      return new Date(dateStr).getFullYear();
};