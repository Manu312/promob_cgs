import { Component } from 'react';

// Evita que un error del visor 3D deje toda la app en blanco.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    console.error('[MueblesApp] Error en el visor 3D:', error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="vp-error">
        <p><b>El visor 3D tuvo un error.</b> Tu proyecto no se perdió.</p>
        <p className="hint">{String(this.state.error?.message || this.state.error)}</p>
        <button onClick={() => { this.setState({ error: null }); this.props.onReset?.(); }}>Reiniciar visor</button>
      </div>
    );
  }
}
