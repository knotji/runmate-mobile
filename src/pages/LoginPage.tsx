import { useState } from 'react';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonPage,
  IonSpinner,
  IonText,
} from '@ionic/react';
import { logoGoogle, pulseOutline } from 'ionicons/icons';
import { supabase } from '@/lib/supabaseClient';
import { signInWithGoogle } from '@/lib/googleAuth';
import './LoginPage.css';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    setSubmitting(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (authError) setError('Sign-in failed. Check your email and password.');
    setSubmitting(false);
  };

  const signInGoogle = async () => {
    setGoogleSubmitting(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (authError) {
      console.error('[auth] Google sign-in failed', authError);
      setError(authError instanceof Error ? authError.message : 'Google sign-in failed. Please try again.');
      setGoogleSubmitting(false);
    }
  };

  return (
    <IonPage>
      <IonContent fullscreen className="login-content">
        <main className="login-shell">
          <section className="login-intro">
            <div className="brand-mark" aria-hidden="true"><IonIcon icon={pulseOutline} /></div>
            <p className="eyebrow">RunMate Mobile</p>
            <h1>Know Your Body<br />Before You Train</h1>
            <p>See your Recovery, Strain, and Sleep metrics.</p>
          </section>

          <form className="login-panel" onSubmit={signIn}>
            <div>
              <h2>Sign In</h2>
            </div>
            <IonButton
              expand="block"
              type="button"
              fill="outline"
              className="google-login-button"
              disabled={submitting || googleSubmitting}
              onClick={() => void signInGoogle()}
            >
              {googleSubmitting ? <IonSpinner name="crescent" /> : <><IonIcon slot="start" icon={logoGoogle} />Continue With Google</>}
            </IonButton>
            <div className="login-divider"><span>Or Continue With Email</span></div>
            <IonItem lines="none" className="login-field">
              <IonInput
                label="Email"
                labelPlacement="stacked"
                type="email"
                autocomplete="email"
                value={email}
                onIonInput={(event) => setEmail(event.detail.value ?? '')}
              />
            </IonItem>
            <IonItem lines="none" className="login-field">
              <IonInput
                label="Password"
                labelPlacement="stacked"
                type="password"
                autocomplete="current-password"
                value={password}
                onIonInput={(event) => setPassword(event.detail.value ?? '')}
              />
            </IonItem>
            {error && <IonText color="danger" className="login-error" role="alert">{error}</IonText>}
            <IonButton expand="block" type="submit" disabled={submitting || googleSubmitting} className="login-button">
              {submitting ? <IonSpinner name="crescent" /> : 'Sign In'}
            </IonButton>
          </form>
        </main>
      </IonContent>
    </IonPage>
  );
};

export default LoginPage;
