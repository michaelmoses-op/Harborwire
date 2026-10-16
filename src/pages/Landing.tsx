import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Wordmark } from '../components/Wordmark';

const STAGES = [
  ['Git', 'main'],
  ['Test', '48 passed'],
  ['Image', 'buoy:1.4.2'],
  ['Registry', 'pushed'],
  ['Deploy', '2 pods'],
  ['Service', ':80'],
];

export function Landing() {
  useEffect(() => {
    document.title = 'Harborwire — CI/CD, Docker, and Kubernetes on a chart';
  }, []);

  return (
    <div className="land">
      <header className="topnav">
        <div className="topnav-inner">
          <Wordmark large />
          <nav className="nav-links" aria-label="Page">
            <a href="#path">The path</a>
            <a href="#practice">Practice</a>
            <Link to="/simulator" className="btn btn-solid">
              Open the simulator
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="kicker">A chart for the path to production</p>
            <h1>See a commit become a running pod.</h1>
            <p className="lede">
              Harborwire is a simulator for developers learning CI/CD, Docker, and Kubernetes. Drag the resources
              onto a chart, connect them the way a real pipeline is connected, and run it. The log tells you what
              each stage would do. The browser never calls a cluster.
            </p>
            <div className="actions">
              <Link to="/simulator?preset=web" className="btn btn-solid">
                Open the buoy pipeline
              </Link>
              <a href="#path" className="btn btn-line">
                Follow the path
              </a>
            </div>
          </div>
          <div className="hero-chart" aria-hidden="true">
            <div className="hero-chart-head">
              <span className="live-dot" />
              buoy · simulated run
            </div>
            <div className="hero-flow">
              {STAGES.map(([title, detail], index) => (
                <div className="hero-stage" key={title}>
                  {index > 0 && <span className="hero-wire" />}
                  <div className="hero-node" style={{ animationDelay: `${index * 0.55}s` }}>
                    <b>{title}</b>
                    <span>{detail}</span>
                  </div>
                </div>
              ))}
            </div>
            <pre className="hero-log">{`checkout a1c4e90
npm test
docker push registry.harborwire.dev/buoy:1.4.2
rollout buoy 2/2 Ready`}</pre>
          </div>
        </section>

        <section className="section" id="path">
          <div className="section-head">
            <p className="kicker">Four handoffs</p>
            <h2>The path a commit actually takes.</h2>
            <p>
              The commands under each step are the real-world shape of the wires. Harborwire does not run them. It
              shows why they sit in this order.
            </p>
          </div>
          <ol className="path-list">
            <li className="path-item">
              <span className="path-no">01</span>
              <div>
                <h3>CI hears about the commit</h3>
                <p>
                  A push lands in Git. A webhook starts a clean checkout. Lint and tests decide whether this commit
                  is allowed to go any further.
                </p>
                <code>git push origin main</code>
              </div>
            </li>
            <li className="path-item">
              <span className="path-no">02</span>
              <div>
                <h3>Docker packages the result</h3>
                <p>
                  An image build runs the Dockerfile against that checkout. The image is a filesystem plus a start
                  command, tagged so a later stage can name it.
                </p>
                <code>docker build -t registry.harborwire.dev/buoy:1.4.2 .</code>
              </div>
            </li>
            <li className="path-item">
              <span className="path-no">03</span>
              <div>
                <h3>The registry holds the image</h3>
                <p>
                  The runner’s local image is invisible to the cluster. A push publishes the tag. The digest is the
                  immutable id. The tag is the name people move.
                </p>
                <code>docker push registry.harborwire.dev/buoy:1.4.2</code>
              </div>
            </li>
            <li className="path-item">
              <span className="path-no">04</span>
              <div>
                <h3>Kubernetes keeps it running</h3>
                <p>
                  A Deployment asks for N pods on that image. A Service gives them one address. An Ingress maps a
                  hostname onto the Service.
                </p>
                <code>kubectl apply -f deploy.yaml</code>
              </div>
            </li>
          </ol>
        </section>

        <section className="section" id="practice">
          <div className="section-head">
            <p className="kicker">Practice</p>
            <h2>Three charts, none of them attached to a cluster.</h2>
          </div>
          <div className="practice-grid">
            <Link to="/simulator?preset=web" className="practice-card">
              <span className="practice-index">01</span>
              <h3>A healthy pipeline</h3>
              <p>Run buoy from Git to Ingress and read the log top to bottom.</p>
              <span className="practice-go">Open this chart</span>
            </Link>
            <Link to="/simulator?preset=red" className="practice-card">
              <span className="practice-index">02</span>
              <h3>A red test</h3>
              <p>Fail the test stage and watch the registry and the cluster stay dark.</p>
              <span className="practice-go">Open this chart</span>
            </Link>
            <Link to="/simulator?preset=rollout" className="practice-card">
              <span className="practice-index">03</span>
              <h3>A rollout</h3>
              <p>The image is already published. Update the Deployment and expose it.</p>
              <span className="practice-go">Open this chart</span>
            </Link>
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <p className="kicker">Wires</p>
            <h2>A wire is a handoff, and some handoffs do not exist.</h2>
            <p>
              Every card has an input on the left and an output on the right. If a connection would not happen in a
              real pipeline, the chart refuses it and tells you where the wire should go.
            </p>
          </div>
          <ul className="refuse">
            <li>
              <p className="refuse-q">Service → Git</p>
              <p>Traffic does not commit code. The story moves from the repository toward the running app.</p>
            </li>
            <li>
              <p className="refuse-q">Image build → Deployment</p>
              <p>Push to a registry first. Kubernetes pulls from there, not from the CI runner’s disk.</p>
            </li>
            <li>
              <p className="refuse-q">Ingress → Service</p>
              <p>Requests travel from the hostname to the Service. Draw that wire from the Service outward.</p>
            </li>
          </ul>
        </section>

        <section className="honesty">
          <div>
            <h2>No kubeconfig. No registry password. No CI token.</h2>
            <p>
              The point is the picture of how the pieces call each other: source, gates, image, registry, then the
              objects that keep a process running.
            </p>
          </div>
          <Link to="/simulator" className="btn btn-solid">
            Start on the chart
          </Link>
        </section>
      </main>

      <footer className="footer">
        <Wordmark />
        <p>A learning simulator for CI/CD, Docker, and Kubernetes.</p>
      </footer>
    </div>
  );
}
