import { Component, type ReactNode } from 'react';

/**
 * Không để lỗi render làm trống màn hình: hiện thông báo + nút về launcher.
 * Ván vẫn còn trong IndexedDB (mỗi command đã được lưu trước khi hiển thị).
 */
export class ErrorBoundary extends Component<{ children: ReactNode; onReset: () => void }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error) {
    console.error('Lỗi giao diện', error);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="launcher">
        <div className="game-card" role="alert">
          <h2>Không hiển thị được bàn chơi</h2>
          <p>Ván đã được lưu. Hãy gọi nhân viên nếu lỗi lặp lại.</p>
          <p className="muted small">Chi tiết kỹ thuật: {this.state.error.message}</p>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              this.setState({ error: null });
              this.props.onReset();
            }}
          >
            Về màn hình chính
          </button>
        </div>
      </div>
    );
  }
}
