/**
 * Replaces URL parameters (prefixed with :) with values from the provided params object.
 *
 * @param urlTemplate - URL string with parameters like '/medical/v1/cohort/:id/patient'
 * @param params - Object with parameter values like { id: '123' }
 * @returns URL string with parameters replaced
 *
 * @example
 * replacePathParams('/medical/v1/cohort/:id/patient', { id: '123' })
 * // Returns: '/medical/v1/cohort/123/patient'
 */
export function replacePathParams(urlTemplate: string, params: Record<string, string>): string {
  return urlTemplate.replace(/:(\w+)/g, (match, paramName) => {
    const value = params[paramName];
    if (value === undefined) {
      throw new Error(`Missing parameter '${paramName}' for URL template '${urlTemplate}'`);
    }
    return value;
  });
}
