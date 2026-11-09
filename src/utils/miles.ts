/** Rounded numeric miles for route choices and summary calculations. */
export const roundMiles = (miles: number): number => Math.round(miles * 10) / 10;

/** Display miles consistently with one decimal place; never use for stored totals. */
export const formatMiles = (miles: number): string => roundMiles(miles).toFixed(1);
