import './styles.css';

function App() {
  return (
    <main className="ui-shell">
      <header>
        <h1>X-Exporter</h1>
        <p>配置插件选项，查看开发者调试信息。</p>
      </header>
      <section>
        <p>当前版本：{import.meta.env.VITE_APP_VERSION ?? 'development'}</p>
        <p>更多功能即将到来。</p>
      </section>
    </main>
  );
}

export default App;
