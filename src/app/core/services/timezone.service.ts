import { Injectable } from '@angular/core';

/**
 * Service for handling timezone conversions using Eastern Time Zone
 * This service provides consistent timezone handling across the application
 */
@Injectable({
  providedIn: 'root',
})
export class TimeZoneService {
  // Eastern Time Zone identifier (IANA timezone ID)
  public readonly EASTERN_TIMEZONE = 'America/New_York';
  
  constructor() {}

  /**
   * Formats a date string to Eastern Time
   * @param dateString - ISO date string (assumed to be UTC if no timezone specified)
   * @param format - Date format string (default: 'MMM d, y h:mm a')
   * @returns Formatted date string in Eastern Time
   */
  formatDate(dateString: string | null | undefined, format: string = 'MMM d, y h:mm a'): string {
    if (!dateString) return '-';
    
    try {
      const timestampStr = dateString.trim();
      let date: Date;
      
      // If the timestamp has explicit timezone (Z or +/-HH:MM), parse as-is.
      if (timestampStr.includes('Z') || timestampStr.match(/[+-]\d{2}:\d{2}$/)) {
        date = new Date(timestampStr);
      } else {
        // If no timezone, treat as Eastern Time
        // The API stores times in Eastern Time, so we need to interpret them as such
        if (timestampStr.includes('T')) {
          // Format: YYYY-MM-DDTHH:mm:ss or YYYY-MM-DDTHH:mm:ss.sss
          const datePart = timestampStr.split('T')[0];
          const offset = this.getETOffsetForDate(datePart);
          date = new Date(timestampStr + offset);
        } else {
          // Fallback for other formats
          date = new Date(timestampStr);
        }
      }
      
      // Verify date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date:', dateString);
        return '-';
      }
      
      // Use Intl.DateTimeFormat to format with Eastern timezone
      return this.formatDateWithIntl(date, format);
    } catch (error) {
      console.error('Error formatting date:', error, dateString);
      return '-';
    }
  }

  /**
   * Formats a date using Intl.DateTimeFormat with Eastern timezone
   * @param date - Date object to format
   * @param format - Format string (supports: 'MMM d, y h:mm a', 'h:mm a', 'MMM d', 'EEE', 'MMM d, y')
   * @returns Formatted date string
   */
  private formatDateWithIntl(date: Date, format: string): string {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: this.EASTERN_TIMEZONE,
    };

    // Map format strings to Intl options
    if (format === 'MMM d, y h:mm a') {
      options.month = 'short';
      options.day = 'numeric';
      options.year = 'numeric';
      options.hour = 'numeric';
      options.minute = '2-digit';
      options.hour12 = true;
    } else if (format === 'h:mm a') {
      options.hour = 'numeric';
      options.minute = '2-digit';
      options.hour12 = true;
    } else if (format === 'MMM d') {
      options.month = 'short';
      options.day = 'numeric';
    } else if (format === 'EEE') {
      options.weekday = 'short';
    } else if (format === 'MMM d, y') {
      options.month = 'short';
      options.day = 'numeric';
      options.year = 'numeric';
    } else {
      // Default format
      options.month = 'short';
      options.day = 'numeric';
      options.year = 'numeric';
      options.hour = 'numeric';
      options.minute = '2-digit';
      options.hour12 = true;
    }

    try {
      const formatter = new Intl.DateTimeFormat('en-US', options);
      return formatter.format(date);
    } catch (error) {
      console.error('Error formatting date with Intl:', error);
      return date.toLocaleString('en-US', { timeZone: this.EASTERN_TIMEZONE });
    }
  }

  /**
   * Formats a time string to Eastern Time (time only)
   * @param dateString - ISO date string (assumed to be UTC if no timezone specified)
   * @returns Formatted time string in Eastern Time (e.g., "2:30 PM")
   */
  formatTime(dateString: string | null | undefined): string {
    return this.formatDate(dateString, 'h:mm a');
  }

  /**
   * Formats a date string to Eastern Time (date only, no time)
   * @param dateString - ISO date string (assumed to be UTC if no timezone specified)
   * @returns Formatted date string in Eastern Time (e.g., "Jan 15")
   */
  formatDateOnly(dateString: string | null | undefined): string {
    return this.formatDate(dateString, 'MMM d');
  }

  /**
   * Formats a date string to Eastern Time (full date with time)
   * @param dateString - ISO date string (assumed to be UTC if no timezone specified)
   * @returns Formatted date string in Eastern Time (e.g., "Jan 15, 2024 2:30 PM")
   */
  formatDateTime(dateString: string | null | undefined): string {
    return this.formatDate(dateString, 'MMM d, y h:mm a');
  }

  /**
   * Parses a date string as UTC (e.g. server createdAt) and formats in Eastern Time (EST/EDT).
   * Use for timestamps that are stored in UTC without a trailing 'Z'.
   * @param dateString - ISO date string (interpreted as UTC)
   * @returns Formatted date string in Eastern Time
   */
  formatDateTimeUTCToEastern(dateString: string | null | undefined): string {
    if (!dateString) return '-';
    const s = dateString.trim();
    if (!s) return '-';
    try {
      // If no timezone, treat as UTC so display in EST is correct
      const utcString = s.includes('Z') || /[+-]\d{2}:\d{2}$/.test(s) ? s : s.replace(/\.\d{3}$/, '') + 'Z';
      return this.formatDate(utcString, 'MMM d, y h:mm a');
    } catch {
      return this.formatDateTime(dateString);
    }
  }

  /**
   * Formats a date string to Eastern Time (weekday abbreviation)
   * @param dateString - ISO date string (assumed to be UTC if no timezone specified)
   * @returns Formatted weekday in Eastern Time (e.g., "Mon")
   */
  formatWeekday(dateString: string | null | undefined): string {
    return this.formatDate(dateString, 'EEE');
  }

  /**
   * Gets the current date and time in Eastern Time Zone
   * @returns Date object representing current time in Eastern Time
   */
  getCurrentEasternTime(): Date {
    const now = new Date();
    // Convert to Eastern time using Intl API
    const easternTime = new Date(now.toLocaleString('en-US', { timeZone: this.EASTERN_TIMEZONE }));
    return easternTime;
  }

  /**
   * Converts a UTC date to Eastern Time
   * @param utcDate - Date object (assumed to be UTC)
   * @returns Date object in Eastern Time
   */
  convertToEastern(utcDate: Date): Date {
    return new Date(utcDate.toLocaleString('en-US', { timeZone: this.EASTERN_TIMEZONE }));
  }

  /**
   * Gets date parts in Eastern timezone for comparison
   * Useful for determining if a date is today, yesterday, etc. in Eastern Time
   * @param dateString - ISO date string
   * @returns Object with year, month, day in Eastern Time
   */
  getEasternDateParts(dateString: string): { year: number; month: number; day: number } {
    const timestampStr = dateString.trim();
    let date: Date;
    
    if (timestampStr.includes('T') && !timestampStr.endsWith('Z') && !timestampStr.match(/[+-]\d{2}:\d{2}$/)) {
      date = new Date(timestampStr + 'Z');
    } else {
      date = new Date(timestampStr);
    }
    
    const easternFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: this.EASTERN_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    const dateParts = easternFormatter.formatToParts(date);
    
    return {
      year: parseInt(dateParts.find(p => p.type === 'year')?.value || '0'),
      month: parseInt(dateParts.find(p => p.type === 'month')?.value || '0'),
      day: parseInt(dateParts.find(p => p.type === 'day')?.value || '0')
    };
  }

  /**
   * Checks if a date is today in Eastern Time
   * @param dateString - ISO date string
   * @returns true if the date is today in Eastern Time
   */
  isToday(dateString: string): boolean {
    const dateParts = this.getEasternDateParts(dateString);
    const nowParts = this.getEasternDateParts(new Date().toISOString());
    
    return dateParts.year === nowParts.year &&
           dateParts.month === nowParts.month &&
           dateParts.day === nowParts.day;
  }

  /**
   * Gets the start of a day in Eastern Time as a Date (for API use - toISOString() gives UTC).
   * @param dateStr - Date string in YYYY-MM-DD format
   * @returns Date object representing start of that day in ET (00:00:00.000)
   */
  getStartOfDayET(dateStr: string): Date {
    const offset = this.getETOffsetForDate(dateStr);
    return new Date(dateStr + `T00:00:00.000${offset}`);
  }

  /**
   * Gets the end of a day in Eastern Time as a Date (for API use - toISOString() gives UTC).
   * @param dateStr - Date string in YYYY-MM-DD format
   * @returns Date object representing end of that day in ET (23:59:59.999)
   */
  getEndOfDayET(dateStr: string): Date {
    const offset = this.getETOffsetForDate(dateStr);
    return new Date(dateStr + `T23:59:59.999${offset}`);
  }

  /**
   * Gets the ET offset (-05:00 for EST, -04:00 for EDT) for a given date.
   * US Eastern: EDT from 2nd Sunday March to 1st Sunday November.
   */
  public getETOffsetForDate(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const month = m;
    const day = d;

    if (month < 3 || month > 11) return '-05:00';
    if (month > 3 && month < 11) return '-04:00';
    if (month === 3) {
      const secondSunday = this.getNthSundayOfMonth(y, 3, 2);
      return day >= secondSunday ? '-04:00' : '-05:00';
    }
    if (month === 11) {
      const firstSunday = this.getNthSundayOfMonth(y, 11, 1);
      return day >= firstSunday ? '-05:00' : '-04:00';
    }
    return '-05:00';
  }

  private getNthSundayOfMonth(year: number, month: number, n: number): number {
    let count = 0;
    for (let d = 1; d <= 31; d++) {
      const date = new Date(year, month - 1, d);
      if (date.getMonth() !== month - 1) break;
      if (date.getDay() === 0) {
        count++;
        if (count === n) return d;
      }
    }
    return 31;
  }

  /**
   * Gets relative time description (Today, Yesterday, or formatted date)
   * @param dateString - ISO date string
   * @returns Relative time description
   */
  getRelativeTime(dateString: string): string {
    if (!dateString) return '';
    
    const dateParts = this.getEasternDateParts(dateString);
    const nowParts = this.getEasternDateParts(new Date().toISOString());
    
    const dateDate = new Date(dateParts.year, dateParts.month - 1, dateParts.day);
    const nowDate = new Date(nowParts.year, nowParts.month - 1, nowParts.day);
    
    const daysDiff = Math.floor((nowDate.getTime() - dateDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 0) {
      return this.formatTime(dateString);
    } else if (daysDiff === 1) {
      return 'Yesterday';
    } else if (daysDiff < 7) {
      return this.formatWeekday(dateString);
    } else {
      return this.formatDateOnly(dateString);
    }
  }
}

