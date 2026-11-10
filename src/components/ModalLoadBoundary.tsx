import { Component, type ReactNode } from 'react';
import { Modal } from './Modal';

/** A failed lazy import must leave a visible way out rather than a blank overlay. */
export class ModalLoadBoundary extends Component<{ children: ReactNode; onClose: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    const close = () => { this.props.onClose(); this.setState({ failed: false }); };
    return <Modal title="Unable to open this window" onClose={close} className="fixed inset-0 flex items-center justify-center bg-stone-950/80 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4">
        <h2 className="text-xl font-bold">Unable to open this window</h2>
        <p role="alert">Part of the app could not load. Check your connection, then reload the app to try again.</p>
        <p className="text-sm text-stone-600">Reloading clears any unsaved form entries.</p>
        <div className="flex gap-4"><button type="button" onClick={close} className="rounded border px-4 py-2">Close</button><button type="button" onClick={() => window.location.reload()} className="rounded bg-woodland-700 px-4 py-2 text-white">Reload app</button></div>
      </div>
    </Modal>;
  }
}
