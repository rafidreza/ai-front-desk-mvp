import { Suspense } from 'react';
import { InternalLoginForm } from './login-form';

export default function InternalLoginPage() {
  return (
    <main className="login-screen">
      <Suspense fallback={<div className="login-loading">Loading access check</div>}>
        <InternalLoginForm />
      </Suspense>
    </main>
  );
}
