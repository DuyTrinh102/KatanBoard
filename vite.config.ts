import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // host: true → máy khác trong mạng (iPad, màn hình bàn) mở được qua http://<IP-máy-chạy>:5173
  server: { port: 5173, strictPort: true, host: true },
  preview: { port: 4173, strictPort: true, host: true },
  // Safari/iPadOS 15.4+ (cần structuredClone); hạ cú pháp cho Safari cũ hơn mặc định.
  build: { target: ['es2020', 'safari15', 'chrome100', 'firefox100'] },
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environment: 'node',
  },
});
