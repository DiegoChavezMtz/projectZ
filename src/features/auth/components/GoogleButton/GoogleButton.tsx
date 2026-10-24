import { Button } from '@/components/atoms/Button';
import { authContent } from '../../content/es-MX';
import { signInWithGoogleAction } from '../../services/oauth.actions';

/** Inicia Google (OAuth, PKCE) con una Server Action; `next` ya viene validado por la page. */
export function GoogleButton({ next }: { next?: string }) {
  return (
    <form action={signInWithGoogleAction}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Button type="submit" variant="secondary" fullWidth>
        {authContent.login.google}
      </Button>
    </form>
  );
}
