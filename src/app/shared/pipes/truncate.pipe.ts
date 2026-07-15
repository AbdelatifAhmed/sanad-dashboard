import { Pipe, PipeTransform } from '@angular/core';

/**
 * Truncates a string to a maximum length with an ellipsis.
 * Usage: {{ longText | truncate:80 }}
 * Usage: {{ longText | truncate:80:'...' }}
 */
@Pipe({
  name: 'truncate',
  standalone: true,
  pure: true,
})
export class TruncatePipe implements PipeTransform {
  transform(value: string | null | undefined, maxLength = 100, ellipsis = '…'): string {
    if (!value) return '';
    return value.length <= maxLength ? value : value.slice(0, maxLength) + ellipsis;
  }
}
