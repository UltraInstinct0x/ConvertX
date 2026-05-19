export const Header = ({
  loggedIn,
  accountRegistration,
  allowUnauthenticated,
  hideHistory,
  webroot = "",
}: {
  loggedIn?: boolean;
  accountRegistration?: boolean;
  allowUnauthenticated?: boolean;
  hideHistory?: boolean;
  webroot?: string;
}) => {
  // New-UI toggle: button reads/writes localStorage and reloads to apply.
  // Stable across sessions; legacy is the default.
  const uiToggle = (
    <li>
      <button
        type="button"
        id="ui-toggle"
        data-ui-toggle
        title="Toggle new UI"
        class={`
          rounded-sm border border-neutral-700 px-2 py-1 text-xs uppercase
          tracking-wider text-neutral-300 transition-all
          hover:border-accent-500 hover:text-accent-500
        `}
      >
        <span data-ui-toggle-label>UI: classic</span>
      </button>
    </li>
  );

  let rightNav: JSX.Element;
  if (loggedIn) {
    rightNav = (
      <ul class="flex items-center gap-4">
        {uiToggle}
        {!hideHistory && (
          <li>
            <a
              class={`
                text-accent-600 transition-all
                hover:text-accent-500 hover:underline
              `}
              href={`${webroot}/history`}
            >
              History
            </a>
          </li>
        )}
        {!allowUnauthenticated ? (
          <li>
            <a
              class={`
                text-accent-600 transition-all
                hover:text-accent-500 hover:underline
              `}
              href={`${webroot}/account`}
            >
              Account
            </a>
          </li>
        ) : null}
        {!allowUnauthenticated ? (
          <li>
            <a
              class={`
                text-accent-600 transition-all
                hover:text-accent-500 hover:underline
              `}
              href={`${webroot}/logoff`}
            >
              Logout
            </a>
          </li>
        ) : null}
      </ul>
    );
  } else {
    rightNav = (
      <ul class="flex items-center gap-4">
        {uiToggle}
        <li>
          <a
            class={`
              text-accent-600 transition-all
              hover:text-accent-500 hover:underline
            `}
            href={`${webroot}/login`}
          >
            Login
          </a>
        </li>
        {accountRegistration ? (
          <li>
            <a
              class={`
                text-accent-600 transition-all
                hover:text-accent-500 hover:underline
              `}
              href={`${webroot}/register`}
            >
              Register
            </a>
          </li>
        ) : null}
      </ul>
    );
  }

  return (
    <header class="w-full p-4">
      <nav class={`mx-auto flex max-w-4xl justify-between rounded-sm bg-neutral-900 p-4`}>
        <ul>
          <li>
            <strong>
              <a href={`${webroot}/`}>ConvertX</a>
            </strong>
          </li>
        </ul>
        {rightNav}
      </nav>
    </header>
  );
};
