export const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
