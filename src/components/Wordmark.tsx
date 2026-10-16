import { Link } from 'react-router-dom';

export function Wordmark({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="wordmark">
      <img className="logo" src="/favicon.svg" alt="" width={28} height={28} />
      Harborwire
    </Link>
  );
}
