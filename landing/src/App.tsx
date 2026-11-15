import { modules } from "./modules";

export function App() {
  return (
    <main className="page">
      <header className="brand">
        <img src="/pwa-192x192.png" alt="" width={64} height={64} />
        <h1>jforge</h1>
      </header>
      <p className="muted">
        Pick a module. Each one also installs as its own app.
      </p>
      <ul className="modules">
        {modules.map((m) => (
          <li key={m.name}>
            <a
              className="card"
              href={`/${m.name}/`}
              style={{ background: m.themeColor }}
            >
              <img
                src={`/${m.name}/pwa-192x192.png`}
                alt=""
                width={48}
                height={48}
              />
              <span>
                <strong>{m.title}</strong>
                <span className="muted">{m.description}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
