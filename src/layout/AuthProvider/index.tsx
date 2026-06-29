import { type PropsWithChildren } from 'react';

// Next.js only serves auth routes (signin, oauth callbacks, etc.)
// No store initialization needed here — session sync happens in the Vite SPA after login.
const AuthProvider = ({ children }: PropsWithChildren) => {
  return <>{children}</>;
};

export default AuthProvider;
