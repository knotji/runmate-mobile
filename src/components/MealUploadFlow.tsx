import { useEffect, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { IonIcon, IonSpinner } from '@ionic/react';
import { cameraOutline, checkmarkCircleOutline, closeOutline, createOutline, fastFoodOutline } from 'ionicons/icons';
import { analyzeMealImages, analyzeMealText, inferBangkokMealType, type MealType } from '@/lib/mealUpload';
import { createHistoryItem, saveHistoryItems } from '@/lib/cloudHistory';
import { dateKeyToRecordedAt, todayBangkokDateKey } from '@/lib/date';
import type { MealAnalysis } from '@/types/logs';
import UploadDateField from './UploadDateField';
import { cacheMealDetailItem } from '@/lib/mealDetailCache';
import { hapticNotification, hapticSelection } from '@/lib/haptics';
import { syncMealNutritionToHealthConnect } from '@/lib/nutritionSync';

const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const nutritionKeys = ['caloriesKcal', 'proteinG', 'carbsG', 'fatG'] as const;
type MealInputMode = 'text' | 'image';
type AnalyzedMealContext = { inputMode: MealInputMode; mealType: MealType };

const MealUploadFlow: React.FC = () => {
  const history = useHistory();
  const [images, setImages] = useState<Array<{ file: File; url: string }>>([]);
  const [inputMode, setInputMode] = useState<MealInputMode>('text');
  const [mealText, setMealText] = useState('');
  const imagesRef = useRef(images); imagesRef.current = images;
  const [mealType, setMealType] = useState<MealType>(() => inferBangkokMealType());
  const [note, setNote] = useState('');
  const [mealDate, setMealDate] = useState(() => todayBangkokDateKey());
  const [meal, setMeal] = useState<MealAnalysis | null>(null);
  const [analyzedContext, setAnalyzedContext] = useState<AnalyzedMealContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => { imagesRef.current.forEach((image) => URL.revokeObjectURL(image.url)); }, []);

  const choose = (files: File[]) => {
    const available = Math.max(0, 4 - images.length);
    if (!available) return;
    setImages((current) => [...current, ...files.slice(0, available).map((file) => ({ file, url: URL.createObjectURL(file) }))]);
    setMeal(null);
    setError(files.length > available ? 'You Can Add Up To 4 Photos.' : '');
  };
  const remove = (index: number) => setImages((current) => {
    const target = current[index]; if (target) URL.revokeObjectURL(target.url);
    return current.filter((_, itemIndex) => itemIndex !== index);
  });
  const analyze = async () => {
    if (inputMode === 'image' ? !images.length : mealText.trim().length < 3) return;
    const requestContext: AnalyzedMealContext = { inputMode, mealType };
    setLoading(true); setError('');
    try {
      const result = inputMode === 'image'
        ? await analyzeMealImages(images.map((image) => image.file), mealType, note)
        : await analyzeMealText(mealText, mealType, note);
      setAnalyzedContext(requestContext);
      setMeal(result);
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Meal Analysis Failed'); }
    finally { setLoading(false); }
  };
  const reset = () => {
    images.forEach((image) => URL.revokeObjectURL(image.url));
    setImages([]); setMeal(null); setAnalyzedContext(null); setMealText(''); setNote(''); setError(''); setLoading(false); setSaving(false);
    setMealType(inferBangkokMealType()); setMealDate(todayBangkokDateKey());
  };
  const save = async () => {
    if (!meal) return;
    setSaving(true); setError('');
    const detectedFoods = meal.detectedFoods.filter((food) => food.name.trim()).map((food) => ({ ...food, name: food.name.trim() }));
    const savedMealType = analyzedContext?.mealType ?? mealType;
    const savedInputMode = analyzedContext?.inputMode ?? inputMode;
    const item = createHistoryItem('meal', { ...meal, detectedFoods, mealType: savedMealType, mealSlot: savedMealType, localDate: mealDate, note: note || meal.note });
    item.dateKey = mealDate; item.recordedAt = dateKeyToRecordedAt(mealDate);
    item.source = savedInputMode === 'image'
      ? { provider: 'generic_image', importType: 'image', importedAt: new Date().toISOString() }
      : { provider: 'manual', importType: 'manual', importedAt: new Date().toISOString() };
    const result = await saveHistoryItems([item]);
    if (result.ok) {
      void hapticNotification();
      cacheMealDetailItem(item);
      void syncMealNutritionToHealthConnect(item);
      reset();
      history.push(`/activity/meal/${encodeURIComponent(item.id)}`);
    }
    else { setError(result.error ?? 'Could Not Save This Meal'); setSaving(false); }
  };

  if (meal) return <MealReview meal={meal} date={mealDate} saving={saving} error={error} backLabel={(analyzedContext?.inputMode ?? inputMode) === 'text' ? 'Back To Description' : 'Back To Photos'} onChange={setMeal} onDate={setMealDate} onBack={() => setMeal(null)} onSave={save} />;
  return <>
    <header className="upload-intro"><p>Add Meal</p><h1>Log Your Meal</h1><span>Type what you ate or use photos, then review the nutrition estimate before saving.</span></header>
    <section className="upload-section">
      <div className="upload-section-title"><IonIcon icon={fastFoodOutline} /><div><p>Meal Details</p><h2>When Was This Meal?</h2></div></div>
      <UploadDateField label="Meal Date" value={mealDate} max={todayBangkokDateKey()} onChange={setMealDate} className="upload-date-field" />
      <div className="upload-meal-types">{mealTypes.map((type) => <button type="button" disabled={loading} className={type === mealType ? 'is-active' : ''} key={type} aria-pressed={type === mealType} onClick={() => { setMealType(type); void hapticSelection(); }}>{title(type)}</button>)}</div>
    </section>
    <section className="upload-section">
      <div className="meal-input-mode" role="group" aria-label="Meal input method">
        <button type="button" disabled={loading} className={inputMode === 'text' ? 'is-active' : ''} aria-pressed={inputMode === 'text'} onClick={() => { setInputMode('text'); void hapticSelection(); }}><IonIcon icon={createOutline} />Type Meal</button>
        <button type="button" disabled={loading} className={inputMode === 'image' ? 'is-active' : ''} aria-pressed={inputMode === 'image'} onClick={() => { setInputMode('image'); void hapticSelection(); }}><IonIcon icon={cameraOutline} />Use Photos</button>
      </div>
      {inputMode === 'text' ? <>
        <div className="upload-section-title"><IonIcon icon={createOutline} /><div><p>Meal Description</p><h2>What Did You Have?</h2></div></div>
        <label className="meal-text-input"><span>Food And Amount</span><textarea aria-label="Food And Amount" disabled={loading} value={mealText} onChange={(event) => setMealText(event.target.value)} maxLength={1000} placeholder="Example: ข้าวกะเพราไก่ไข่ดาว 1 จาน และอเมริกาโน่ไม่หวาน 1 แก้ว" /><small>{mealText.length}/1000 · Add amounts when you know them.</small></label>
      </> : <>
        <div className="upload-section-title"><IonIcon icon={cameraOutline} /><div><p>Meal Photos</p><h2>Add Photos</h2><span>{images.length}/4 selected</span></div></div>
        {images.length > 0 && <div className="upload-preview-grid">{images.map((image, index) => <div key={image.url}><img src={image.url} alt={`Meal Photo ${index + 1}`} /><button type="button" onClick={() => remove(index)} aria-label={`Remove Meal Photo ${index + 1}`}><IonIcon icon={closeOutline} /></button></div>)}</div>}
        <label className="upload-picker"><IonIcon icon={cameraOutline} /><strong>{images.length ? 'Add More Photos' : 'Choose Meal Photos'}</strong><span>Use different angles or include each dish</span><input type="file" disabled={loading} multiple accept="image/*" onChange={(event) => { choose(Array.from(event.target.files ?? [])); event.target.value = ''; }} /></label>
      </>}
      <label className="upload-note"><span>Add Details <em>Optional</em></span><textarea disabled={loading} value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder="Example: Shared meal, sauce on the side" /></label>
    </section>
    {error && <p className="upload-error">{error}</p>}
    <button type="button" className="upload-primary" disabled={(inputMode === 'image' ? !images.length : mealText.trim().length < 3) || loading} onClick={() => void analyze()}>{loading ? <><IonSpinner name="crescent" />Analyzing Meal...</> : inputMode === 'text' ? 'Review Meal Description' : `Review Meal${images.length > 1 ? ` From ${images.length} Photos` : ''}`}</button>
  </>;
};

function MealReview({ meal, date, saving, error, backLabel, onChange, onDate, onBack, onSave }: { meal: MealAnalysis; date: string; saving: boolean; error: string; backLabel: string; onChange: (meal: MealAnalysis) => void; onDate: (date: string) => void; onBack: () => void; onSave: () => Promise<void> }) {
  return <section className="upload-review">
    <header><p>Review Meal</p><h1>Check Your Meal</h1><span>Correct anything the analysis missed before saving.</span></header>
    <UploadDateField label="Meal Date" value={date} max={todayBangkokDateKey()} onChange={onDate} className="upload-review-date" />
    <FoodEditor meal={meal} onChange={onChange} />
    <section className="upload-review-metrics-section"><header><p>Nutrition</p><h2>Estimated Nutrition</h2></header><div className="upload-review-metrics">{nutritionKeys.map((key) => <label key={key}><span>{metricLabel(key)}</span><input type="number" min="0" inputMode="decimal" value={meal.nutrition[key] ?? ''} onChange={(event) => onChange({ ...meal, nutrition: { ...meal.nutrition, [key]: event.target.value === '' ? null : Number(event.target.value) } })} /></label>)}</div></section>
    {error && <p className="upload-error">{error}</p>}
    <div className="upload-actions"><button type="button" onClick={onBack}>{backLabel}</button><button type="button" disabled={saving || !date || !meal.detectedFoods.some((food) => food.name.trim())} onClick={() => void onSave()}>{saving ? <IonSpinner name="crescent" /> : <IonIcon icon={checkmarkCircleOutline} />}Save Meal</button></div>
  </section>;
}

function FoodEditor({ meal, onChange }: { meal: MealAnalysis; onChange: (meal: MealAnalysis) => void }) {
  const [text, setText] = useState(() => meal.detectedFoods.map(formatFoodLine).join('\n'));
  const update = (next: string) => { setText(next); onChange({ ...meal, detectedFoods: next.split('\n').slice(0, 20).map((line, index) => parseFoodLine(line, meal.detectedFoods[index])) }); };
  const count = meal.detectedFoods.filter((food) => food.name.trim()).length;
  return <section className="upload-review-foods food-lines-editor"><header><div><p>Foods</p><h2>What Was In This Meal?</h2><span>{count} {count === 1 ? 'item' : 'items'}</span></div></header><label><span>Food | Quantity | Unit | Portion</span><textarea value={text} onChange={(event) => update(event.target.value)} placeholder={'ข้าวสวย | 1 | จาน | ปานกลาง\nไข่ต้ม | 2 | ฟอง |\nผักสด | 1 | ถ้วย | เล็กน้อย'} /></label><p className="food-lines-help">Use one food per line. Add an estimated portion when useful, for example: <strong>แครอท | 1 | ชิ้น | เล็กน้อย</strong></p></section>;
}

function title(value: string) { return value.replace(/^./, (letter) => letter.toUpperCase()); }
function metricLabel(key: typeof nutritionKeys[number]) { return ({ caloriesKcal: 'Calories (kcal)', proteinG: 'Protein (g)', carbsG: 'Carbs (g)', fatG: 'Fat (g)' })[key]; }
function formatFoodLine(food: MealAnalysis['detectedFoods'][number]) { return `${food.name} | ${food.quantity ?? 1} | ${food.unit ?? ''} | ${food.portionEstimate ?? ''}`.trimEnd(); }
function parseFoodLine(line: string, existing?: MealAnalysis['detectedFoods'][number]): MealAnalysis['detectedFoods'][number] {
  const parts = line.split('|').map((part) => part.trim()); const quantity = Number(parts[1]);
  return { ...existing, name: parts[0] ?? '', quantity: parts[1] && Number.isFinite(quantity) && quantity > 0 ? quantity : existing?.quantity ?? 1, unit: parts.length >= 3 ? parts[2] : existing?.unit ?? '', portionEstimate: parts.length >= 4 ? parts.slice(3).join(' | ').trim() : existing?.portionEstimate };
}

export default MealUploadFlow;
