import { Link } from 'react-router-dom';

export function Wordmark({ to = '/', large = false }: { to?: string; large?: boolean }) {
  const size = large ? 44 : 28;
  return (
    <Link to={to} className={large ? 'wordmark is-large' : 'wordmark'}>
      <img className="logo" src="/favicon.svg" alt="" width={size} height={size} />
      Harborwire
    </Link>
  );
}
