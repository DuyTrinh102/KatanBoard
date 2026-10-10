/**
 * Deep clone cho state thuần JSON. `structuredClone` chỉ có từ Safari/iPadOS 15.4;
 * máy cũ hơn dùng JSON (GameState chỉ chứa dữ liệu JSON-safe nên kết quả tương đương).
 */
export function deepClone<T>(value: T): T {
  const sc = (globalThis as { structuredClone?: <V>(v: V) => V }).structuredClone;
  return typeof sc === 'function' ? sc(value) : (JSON.parse(JSON.stringify(value)) as T);
}
