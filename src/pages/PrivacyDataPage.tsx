import { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { IonContent, IonHeader, IonIcon, IonPage, IonSpinner, IonTitle, IonToolbar } from '@ionic/react';
import { arrowBackOutline, cloudDownloadOutline, documentTextOutline, lockClosedOutline, trashOutline } from 'ionicons/icons';
import { accountDataExportFileName, buildAccountDataExport, deleteMyAccount } from '@/lib/accountData';
import { supabase } from '@/lib/supabaseClient';
import './PrivacyDataPage.css';

const DELETE_CONFIRMATION_WORD = 'DELETE';

const PrivacyDataPage: React.FC = () => {
  const history = useHistory();
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const exportData = async () => {
    setExporting(true);
    setExportMessage(null);
    try {
      const result = await buildAccountDataExport();
      if (!result.ok) {
        setExportMessage(result.error);
        return;
      }
      const json = JSON.stringify(result.data, null, 2);
      const fileName = accountDataExportFileName();

      if (Capacitor.isNativePlatform()) {
        // A plain <a download> blob click does not trigger Android's download
        // manager inside the Capacitor WebView, so write the file to disk and
        // hand it to the native share sheet instead.
        const written = await Filesystem.writeFile({ path: fileName, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 });
        await Share.share({ title: 'RunMate Data Export', url: written.uri });
        setExportMessage('Export ready. Choose where to save it.');
        return;
      }

      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      setExportMessage('Data export downloaded.');
    } catch (failure) {
      setExportMessage(failure instanceof Error ? failure.message : 'Could Not Export Your Data.');
    } finally {
      setExporting(false);
    }
  };

  const confirmDelete = async () => {
    if (deleteConfirmationInput.trim().toUpperCase() !== DELETE_CONFIRMATION_WORD) return;
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteMyAccount();
    if (!result.ok) {
      setDeleteError(result.error);
      setDeleting(false);
      return;
    }
    await supabase.auth.signOut();
    history.push('/login');
  };

  return (
    <IonPage>
      <IonHeader translucent className="privacy-data-header">
        <IonToolbar>
          <button type="button" className="privacy-data-back" aria-label="Back To More" onClick={() => history.push('/tabs/more')}>
            <IonIcon icon={arrowBackOutline} />
          </button>
          <IonTitle>Privacy & Data</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="privacy-data-content">
        <main className="privacy-data-shell">
          <header className="privacy-data-intro">
            <p>Your Data</p>
            <h1>Privacy & Health Data</h1>
            <span>What RunMate collects, how it is used, and how to export or delete it.</span>
          </header>

          <section className="privacy-data-card">
            <header><IonIcon icon={documentTextOutline} /><div><p>Collected</p><h2>What We Collect</h2></div></header>
            <ul className="privacy-data-list">
              <li><strong>Health Connect</strong><span>Sleep, Workout, and available vitals (Resting HR, HRV, Respiratory Rate) shared by Samsung Health.</span></li>
              <li><strong>Uploaded Photos</strong><span>Meal, workout, and sleep screenshots you choose to upload, analyzed once to extract structured data.</span></li>
              <li><strong>Profile</strong><span>Max Heart Rate, body weight, and training preferences you enter yourself.</span></li>
              <li><strong>Race Goals</strong><span>Race date, distance, target time, and generated training plans.</span></li>
            </ul>
          </section>

          <section className="privacy-data-card">
            <header><IonIcon icon={lockClosedOutline} /><div><p>Storage</p><h2>How It Is Used And Stored</h2></div></header>
            <p className="privacy-data-paragraph">
              RunMate uses this data to calculate Recovery, Sleep, and Strain scores and to power AI Coach guidance. Everything is
              stored in your own RunMate account (Supabase) and is never sold or shared with third parties.
            </p>
            <p className="privacy-data-paragraph">
              An uploaded photo is sent once to Google Gemini to extract the visible numbers, then discarded — RunMate keeps only
              the extracted data (distance, duration, calories, and so on), never the original image, its raw text, or a copy of it.
            </p>
          </section>

          <section className="privacy-data-card">
            <header><IonIcon icon={cloudDownloadOutline} /><div><p>Your Data</p><h2>Export</h2></div></header>
            <p className="privacy-data-paragraph">Download every Sleep, Workout, Meal, Profile, and Race record RunMate has stored for your account as a single JSON file.</p>
            <button type="button" className="privacy-data-export-btn" disabled={exporting} onClick={() => void exportData()}>
              {exporting ? <IonSpinner name="crescent" /> : <IonIcon icon={cloudDownloadOutline} />}
              {exporting ? 'Preparing Export…' : 'Export My Data'}
            </button>
            {exportMessage && <p className="privacy-data-export-message" role="status">{exportMessage}</p>}
          </section>

          <section className="privacy-data-card privacy-data-danger">
            <header><IonIcon icon={trashOutline} /><div><p>Irreversible</p><h2>Delete My Account</h2></div></header>
            <p className="privacy-data-paragraph">
              Permanently deletes every Sleep, Workout, Meal, Profile, and Race record RunMate has stored for this account, along
              with your sign-in itself. This cannot be undone. Export your data first if you want to keep a copy.
            </p>
            {!confirmDeleteOpen ? (
              <button type="button" className="privacy-data-delete-btn" onClick={() => setConfirmDeleteOpen(true)}>
                <IonIcon icon={trashOutline} /> Delete My Account
              </button>
            ) : (
              <div className="privacy-data-delete-confirm">
                <label>
                  <span>Type DELETE to confirm.</span>
                  <input
                    type="text"
                    value={deleteConfirmationInput}
                    onChange={(event) => setDeleteConfirmationInput(event.target.value)}
                    placeholder="DELETE"
                    autoCapitalize="characters"
                    disabled={deleting}
                  />
                </label>
                {deleteError && <p className="privacy-data-delete-error">{deleteError}</p>}
                <div className="privacy-data-delete-actions">
                  <button type="button" className="privacy-data-delete-cancel" disabled={deleting} onClick={() => { setConfirmDeleteOpen(false); setDeleteConfirmationInput(''); setDeleteError(null); }}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="privacy-data-delete-confirm-btn"
                    disabled={deleting || deleteConfirmationInput.trim().toUpperCase() !== DELETE_CONFIRMATION_WORD}
                    onClick={() => void confirmDelete()}
                  >
                    {deleting ? <IonSpinner name="crescent" /> : 'Permanently Delete'}
                  </button>
                </div>
              </div>
            )}
          </section>
        </main>
      </IonContent>
    </IonPage>
  );
};

export default PrivacyDataPage;
