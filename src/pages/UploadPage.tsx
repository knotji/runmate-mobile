import { useEffect, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { IonContent, IonHeader, IonIcon, IonPage, IonSpinner, IonTitle, IonToolbar } from '@ionic/react';
import { cameraOutline, checkmarkCircleOutline, closeOutline, fastFoodOutline } from 'ionicons/icons';
import { analyzeMealImages, inferBangkokMealType, type MealType } from '@/lib/mealUpload';
import { createHistoryItem, saveHistoryItems } from '@/lib/cloudHistory';
import { dateKeyToRecordedAt, todayBangkokDateKey } from '@/lib/date';
import type { MealAnalysis } from '@/types/logs';
import WorkoutUploadFlow from '@/components/WorkoutUploadFlow';
import SleepUploadFlow from '@/components/SleepUploadFlow';
import UploadDateField from '@/components/UploadDateField';
import './UploadPage.css';

const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
type UploadType = 'meal' | 'workout' | 'sleep';

const UploadPage: React.FC = () => {
  const [uploadType,setUploadType]=useState<UploadType | null>(null);
  const history = useHistory(); const [images, setImages] = useState<Array<{ file: File; url: string }>>([]);
  const imagesRef = useRef(images); imagesRef.current = images;
  const [mealType, setMealType] = useState<MealType>(() => inferBangkokMealType()); const [note, setNote] = useState('');
  const [mealDate, setMealDate] = useState(() => todayBangkokDateKey());
  const [meal, setMeal] = useState<MealAnalysis | null>(null); const [loading, setLoading] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  useEffect(() => () => { imagesRef.current.forEach((image) => URL.revokeObjectURL(image.url)); }, []);
  const choose = (next: File[]) => { const available = Math.max(0, 4 - images.length); if (!available) return; setImages((current) => [...current, ...next.slice(0, available).map((file) => ({ file, url: URL.createObjectURL(file) }))]); setMeal(null); setError(next.length > available ? 'You Can Add Up To 4 Photos.' : ''); };
  const remove = (index: number) => setImages((current) => { const target = current[index]; if (target) URL.revokeObjectURL(target.url); return current.filter((_, itemIndex) => itemIndex !== index); });
  const analyze = async () => { if (!images.length) return; setLoading(true); setError(''); try { setMeal(await analyzeMealImages(images.map((image) => image.file), mealType, note)); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Meal Analysis Failed'); } finally { setLoading(false); } };
  const resetUpload = () => { images.forEach((image) => URL.revokeObjectURL(image.url)); setImages([]); setMeal(null); setNote(''); setError(''); setLoading(false); setSaving(false); setMealType(inferBangkokMealType()); setMealDate(todayBangkokDateKey()); };
  const save = async () => { if (!meal) return; setSaving(true); setError(''); const detectedFoods = meal.detectedFoods.filter((food) => food.name.trim()).map((food) => ({ ...food, name: food.name.trim() })); const item = createHistoryItem('meal', { ...meal, detectedFoods, mealType, mealSlot: mealType, localDate: mealDate, note: note || meal.note }); item.dateKey = mealDate; item.recordedAt = dateKeyToRecordedAt(mealDate); item.source = { provider: 'generic_image', importType: 'image', importedAt: new Date().toISOString() }; const result = await saveHistoryItems([item]); if (result.ok) { resetUpload(); history.push(`/activity/meal/${encodeURIComponent(item.id)}`); } else { setError(result.error ?? 'Could Not Save This Meal'); setSaving(false); } };
  return <IonPage><IonHeader translucent className="upload-header"><IonToolbar><IonTitle>Upload</IonTitle></IonToolbar></IonHeader><IonContent fullscreen className="upload-content"><main className="upload-shell">
    {!meal && uploadType === null && <header className="upload-intro upload-chooser-intro"><p>Add Data</p><h1>What Would You Like To Upload?</h1><span>Choose a record type to begin. RunMate will not select one automatically.</span></header>}
    {!meal&&<nav className="upload-type-switch" aria-label="Upload Type"><button type="button" aria-pressed={uploadType==='sleep'} className={uploadType==='sleep'?'is-active':''} onClick={()=>setUploadType('sleep')}>Sleep</button><button type="button" aria-pressed={uploadType==='workout'} className={uploadType==='workout'?'is-active':''} onClick={()=>setUploadType('workout')}>Workout</button><button type="button" aria-pressed={uploadType==='meal'} className={uploadType==='meal'?'is-active':''} onClick={()=>setUploadType('meal')}>Meal</button></nav>}
    {uploadType === null ? null : uploadType==='workout'?<WorkoutUploadFlow/>:uploadType==='sleep'?<SleepUploadFlow/>:<>
    {!meal && <header className="upload-intro"><p>Add Meal</p><h1>Log Your Meal</h1><span>Add up to four photos of the same meal, then review the results before saving.</span></header>}
    {!meal ? <><section className="upload-section"><div className="upload-section-title"><IonIcon icon={fastFoodOutline} /><div><p>Meal Details</p><h2>When Was This Meal?</h2></div></div><UploadDateField label="Meal Date" value={mealDate} max={todayBangkokDateKey()} onChange={setMealDate} className="upload-date-field"/><div className="upload-meal-types">{mealTypes.map((type) => <button type="button" className={type === mealType ? 'is-active' : ''} key={type} onClick={() => setMealType(type)}>{title(type)}</button>)}</div></section>
      <section className="upload-section"><div className="upload-section-title"><IonIcon icon={cameraOutline} /><div><p>Meal Photos</p><h2>Add Photos</h2><span>{images.length}/4 selected</span></div></div>{images.length > 0 && <div className="upload-preview-grid">{images.map((image, index) => <div key={image.url}><img src={image.url} alt={`Meal Photo ${index + 1}`} /><button type="button" onClick={() => remove(index)} aria-label={`Remove Meal Photo ${index + 1}`}><IonIcon icon={closeOutline} /></button></div>)}</div>}<label className="upload-picker"><IonIcon icon={cameraOutline} /><strong>{images.length ? 'Add More Photos' : 'Choose Meal Photos'}</strong><span>Use different angles or include each dish</span><input type="file" multiple accept="image/*" onChange={(event) => { choose(Array.from(event.target.files ?? [])); event.target.value = ''; }} /></label><label className="upload-note"><span>Add Details <em>Optional</em></span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder="Example: Shared meal, sauce on the side" /></label></section>
      {error && <p className="upload-error">{error}</p>}<button type="button" className="upload-primary" disabled={!images.length || loading} onClick={() => void analyze()}>{loading ? <><IonSpinner name="crescent" />Reviewing Photos...</> : `Review Meal${images.length > 1 ? ` From ${images.length} Photos` : ''}`}</button></>
    : <section className="upload-review"><header><p>Review Meal</p><h1>Check Your Meal</h1><span>Correct anything the analysis missed before saving.</span></header><UploadDateField label="Meal Date" value={mealDate} max={todayBangkokDateKey()} onChange={setMealDate} className="upload-review-date"/><FoodEditor meal={meal} onChange={setMeal} /><section className="upload-review-metrics-section"><header><p>Nutrition</p><h2>Estimated Nutrition</h2></header><div className="upload-review-metrics">{(['caloriesKcal','proteinG','carbsG','fatG'] as const).map((key) => <label key={key}><span>{metricLabel(key)}</span><input type="number" min="0" inputMode="decimal" value={meal.nutrition[key] ?? ''} onChange={(event) => setMeal({ ...meal, nutrition: { ...meal.nutrition, [key]: event.target.value === '' ? null : Number(event.target.value) } })} /></label>)}</div></section>{error && <p className="upload-error">{error}</p>}<div className="upload-actions"><button type="button" onClick={() => setMeal(null)}>Back To Photos</button><button type="button" disabled={saving || !mealDate || !meal.detectedFoods.some((food) => food.name.trim())} onClick={() => void save()}>{saving ? <IonSpinner name="crescent" /> : <IonIcon icon={checkmarkCircleOutline} />}Save Meal</button></div></section>}</>}
  </main></IonContent></IonPage>;
};
function title(value: string) { return value.replace(/^./, (letter) => letter.toUpperCase()); }
function metricLabel(key: 'caloriesKcal'|'proteinG'|'carbsG'|'fatG') { return ({ caloriesKcal: 'Calories (kcal)', proteinG: 'Protein (g)', carbsG: 'Carbs (g)', fatG: 'Fat (g)' })[key]; }
function FoodEditor({ meal, onChange }: { meal: MealAnalysis; onChange: (meal: MealAnalysis) => void }) {
  const [text, setText] = useState(() => meal.detectedFoods.map(formatFoodLine).join('\n'));
  const update = (nextText: string) => {
    setText(nextText);
    const lines = nextText.split('\n').slice(0, 20);
    onChange({ ...meal, detectedFoods: lines.map((line, index) => parseFoodLine(line, meal.detectedFoods[index])) });
  };
  const count = meal.detectedFoods.filter((food) => food.name.trim()).length;
  return <section className="upload-review-foods food-lines-editor"><header><div><p>Foods</p><h2>What Was In This Meal?</h2><span>{count} {count === 1 ? 'item' : 'items'}</span></div></header><label><span>Food | Quantity | Unit | Portion</span><textarea value={text} onChange={(event) => update(event.target.value)} placeholder={'ข้าวสวย | 1 | จาน | ปานกลาง\nไข่ต้ม | 2 | ฟอง |\nผักสด | 1 | ถ้วย | เล็กน้อย'} /></label><p className="food-lines-help">Use one food per line. Add an estimated portion when useful, for example: <strong>แครอท | 1 | ชิ้น | เล็กน้อย</strong></p></section>;
}
function formatFoodLine(food: MealAnalysis['detectedFoods'][number]): string { return `${food.name} | ${food.quantity ?? 1} | ${food.unit ?? ''} | ${food.portionEstimate ?? ''}`.trimEnd(); }
function parseFoodLine(line: string, existing?: MealAnalysis['detectedFoods'][number]): MealAnalysis['detectedFoods'][number] {
  const parts = line.split('|').map((part) => part.trim());
  const parsedQuantity = Number(parts[1]);
  return { ...existing, name: parts[0] ?? '', quantity: parts[1] && Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : existing?.quantity ?? 1, unit: parts.length >= 3 ? parts[2] : existing?.unit ?? '', portionEstimate: parts.length >= 4 ? parts.slice(3).join(' | ').trim() : existing?.portionEstimate };
}
export default UploadPage;
