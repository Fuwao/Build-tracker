import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : '予期しないエラーが発生しました。';
    return { hasError: true, message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('画面の表示中にエラーが発生しました', error, info);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    this.setState({ hasError: false, message: '' });
    window.location.href = '/';
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="error-page">
          <div className="complete-icon" style={{ background: 'var(--color-danger-soft)', color: 'var(--color-danger)' }}>
            !
          </div>
          <h2>画面の表示中に問題が発生しました</h2>
          <p className="page-lead">{this.state.message || '予期しないエラーが発生しました。再読み込みしてもう一度お試しください。'}</p>
          <div className="bottom-actions__row" style={{ width: '100%', maxWidth: 320 }}>
            <button type="button" className="btn btn--secondary btn--block" onClick={this.handleReload}>
              再読み込み
            </button>
            <button type="button" className="btn btn--primary btn--block" onClick={this.handleGoHome}>
              ホームへ戻る
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
