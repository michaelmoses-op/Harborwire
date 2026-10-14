import { Link } from 'react-router-dom';
import { Icon } from './Icon';

export function Wordmark({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="wordmark">
      <span className="logo" aria-hidden="true">
        <Icon name="logo" size={18} />
      </span>
      Harborwire
    </Link>
  );
}
