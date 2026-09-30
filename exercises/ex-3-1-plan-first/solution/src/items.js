// In-memory "database": 45 items with stable ids 1..45.
export const items = Array.from({ length: 45 }, (_, i) => ({
  id: i + 1,
  name: `Item ${i + 1}`,
  createdAt: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
}));
