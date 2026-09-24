// Static imports rather than new URL(..., import.meta.url): the latter falls
// back to resolving against the built module's own directory when the path is
// wrong, which produced a silent /assets/assets/... 404 rather than a build
// failure. An import that cannot resolve stops the build.
import githubIcon from '../../assets/auth/github.svg';
import googleIcon from '../../assets/auth/google-g.svg';

const authProviderIcons = {
  google: googleIcon,
  github: githubIcon,
} as const;

export type AuthProvider = keyof typeof authProviderIcons;

export function AuthProviderIcon({ provider }: { provider: AuthProvider }) {
  return (
    <img
      src={authProviderIcons[provider]}
      alt=""
      aria-hidden="true"
      width={18}
      height={18}
      style={{ display: 'block' }}
      data-auth-provider-icon={provider}
    />
  );
}
