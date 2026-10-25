import { useEffect, useRef, useState } from "react";
import {
  X,
  Download,
  Check,
  BookOpen,
  Upload,
  ArrowUpRight,
  HardDrive,
  Wifi,
  LoaderCircle,
} from "lucide-react";
import {
  installedPacks,
  fetchManifest,
  downloadPack,
  deletePack,
  exportProgress,
  importProgress,
} from "./storage";
import type { PackManifest, Source } from "./types";
import { isNative, nativeCall } from './platform';
import { installMorphology, morphologyInstalled, morphologyManifest } from './morphology-pack';

export default function Settings({
  onClose,
  onNotice,
}: {
  onClose: () => void;
  onNotice: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    backupInput = useRef<HTMLInputElement>(null),
    controller = useRef<AbortController | null>(null);
  const [packs, setPacks] = useState<PackManifest[]>([]),
    [available, setAvailable] = useState<Partial<Record<Source, PackManifest>>>(
      {},
    );
  const [download, setDownload] = useState<Source | null>(null),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(""),
    [usage, setUsage] = useState(""),
    [persistent, setPersistent] = useState(false),
    [health, setHealth] = useState("Checking…");
  const [morphReady,setMorphReady]=useState(isNative),[morphBusy,setMorphBusy]=useState(false),[morphProgress,setMorphProgress]=useState(0),[morphSize,setMorphSize]=useState(37);
  const [deleteSource, setDeleteSource] = useState<Source | null>(null);
  async function refresh() {
    setPacks(await installedPacks());
    const estimate = await navigator.storage?.estimate();
    if (estimate?.usage)
      setUsage(
        `${Math.round(estimate.usage / 1024 / 1024)} MB used by this app`,
      );
    setPersistent((await navigator.storage?.persisted()) || false);
  }
  useEffect(() => {
    dialog.current?.showModal();
    void refresh();
    for (const source of ["kaikki", "lane"] as Source[])
      void fetchManifest(source)
        .then((pack) => setAvailable((a) => ({ ...a, [source]: pack })))
        .catch(() => {});
    void morphologyInstalled().then(ready=>{setMorphReady(ready);setHealth(ready?'Ready offline · CAMeL Morph MSA':'On-device analysis · full offline pack not installed');}).catch(()=>setHealth('Offline pack unavailable'));
    void morphologyManifest().then(m=>setMorphSize(Math.round(m.bytes/1e6))).catch(()=>{});
    return () => {
      controller.current?.abort();
    };
  }, []);
  async function install(source: Source) {
    setDownload(source);
    setProgress(0);
    setError("");
    const abort = new AbortController();
    controller.current = abort;
    try {
      const manifest = available[source] || (await fetchManifest(source));
      await downloadPack(manifest, setProgress, abort.signal);
      await refresh();
      onNotice(`${manifest.title} is ready offline.`);
    } catch (e) {
      if (!abort.signal.aborted)
        setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDownload(null);
      controller.current = null;
    }
  }
  async function backup() {
    const value = await exportProgress();
    if (isNative) {await nativeCall('exportProgress',{json:JSON.stringify(value,null,2)});return;}
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `waraq-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  async function restore(file?: File) {
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error("Please choose a progress backup smaller than 5 MB.");
      const count = await importProgress(JSON.parse(await file.text()));
      onNotice(
        `Restored progress for ${count} matching ${count === 1 ? "book" : "books"}. Reopen your book to use it.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    if (backupInput.current) backupInput.current.value = "";
  }
  return (
    <dialog
      ref={dialog}
      className="settings-dialog"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
    >
      <div className="settings-inner">
        <header>
          <div>
            <p className="eyebrow">MAKE IT YOURS</p>
            <h2>Reading, everywhere.</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close settings"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </header>
        <section>
          <h3>
            <BookOpen size={19} /> Your dictionaries
          </h3>
          <p className="subtle">
            {isNative ? 'Both dictionaries are included and ready offline.' : 'Download once. Keep definitions with you, even offline.'}
          </p>
          {(["kaikki", "lane"] as Source[]).map((source) => {
            const pack = packs.find((p) => p.id === source),
              manifest = available[source] || pack,
              working = download === source;
            return (
              <div className="download-card" key={source}>
                <div className={`dictionary-monogram ${source}`} lang="ar">
                  {source === "kaikki" ? "ك" : "ل"}
                </div>
                <div className="download-info">
                  <h4>
                    {source === "kaikki"
                      ? "Wiktionary via Kaikki"
                      : "Lane’s Arabic–English Lexicon"}
                  </h4>
                  <p>
                    {source === "kaikki"
                      ? "Contemporary meanings, forms, and usage."
                      : "A deep reference for classical meanings and roots."}
                  </p>
                  <small>
                    {pack ? (
                      <>
                        <Check size={13} /> Downloaded ·{" "}
                        {pack.count.toLocaleString()} entries
                      </>
                    ) : manifest ? (
                      `${Math.round(manifest.bytes / 1e6)} MB download · ${manifest.count.toLocaleString()} entries`
                    ) : (
                      "Connect to download this dictionary"
                    )}
                  </small>
                  {working && (
                    <>
                      <progress max="100" value={progress} />
                      <small>{progress}% · saving to this device</small>
                    </>
                  )}
                  {deleteSource === source && (
                    <div className="button-row">
                      <button
                        className="danger-button"
                        onClick={() =>
                          void deletePack(source)
                            .then(refresh)
                            .then(() => setDeleteSource(null))
                        }
                      >
                        Remove download
                      </button>
                      <button
                        className="text-button"
                        onClick={() => setDeleteSource(null)}
                      >
                        Keep
                      </button>
                    </div>
                  )}
                </div>
                {isNative ? <Check size={18} aria-label="Included offline"/> : working ? (
                  <button
                    className="text-button"
                    onClick={() => controller.current?.abort()}
                  >
                    Cancel
                  </button>
                ) : pack &&
                  available[source] &&
                  pack.version !== available[source]!.version ? (
                  <button
                    className="secondary-button"
                    disabled={!!download || morphBusy}
                    onClick={() => void install(source)}
                  >
                    Update
                  </button>
                ) : pack ? (
                  <button
                    className="icon-button"
                    aria-label={`Remove ${source} dictionary`}
                    disabled={!!download || morphBusy}
                    onClick={() => setDeleteSource(source)}
                  >
                    <X size={17} />
                  </button>
                ) : (
                  <button
                    className="icon-button download-button"
                    aria-label={`Download ${source} dictionary`}
                    disabled={!!download || morphBusy}
                    onClick={() => void install(source)}
                  >
                    <Download size={20} />
                  </button>
                )}
              </div>
            );
          })}
          {error && (
            <p className="notice" role="alert">
              {error}
            </p>
          )}
          {!isNative && <p className="small-note">Search indexes take additional space. Keep this window open while a download finishes.</p>}
        </section>
        <section className="connection-section">
          <h3>
            <Wifi size={18} /> Word analysis
          </h3>
          <p>{health}</p>
          {!isNative && !morphReady && <button className="secondary-button" disabled={morphBusy || !!download} onClick={()=>{
            setMorphBusy(true);setError('');const abort=new AbortController();controller.current=abort;
            void installMorphology(setMorphProgress,abort.signal).then(()=>{setMorphReady(true);setHealth('Ready offline · CAMeL Morph MSA');onNotice('New words can now be analyzed fully offline.');}).catch(e=>{if(!abort.signal.aborted)setError(String(e));}).finally(()=>{setMorphBusy(false);controller.current=null;});
          }}>{morphBusy?`Saving morphology… ${morphProgress}%`:`Install offline morphology · ${morphSize} MB`}</button>}
          {morphBusy && <button className="text-button" onClick={()=>controller.current?.abort()}>Cancel</button>}
          <p className="small-note">
            Vowel marks, roots, and grammar are calculated on this device. {isNative?'All morphology data is bundled with your project.':'Install the complete pack to use new words without a connection; otherwise missing data tables download when needed.'} Readings are possibilities, not sentence-level translations.
          </p>
        </section>
        <section>
          <h3>
            <HardDrive size={18} /> On this device
          </h3>
          <p className="small-note">
            {isNative ? 'Books and progress are saved in the iPad app’s local data folder. Keep a backup before replacing or deleting the project.' : (usage ||
              "Books, downloaded dictionaries, and progress are stored in this browser.")}
            {!isNative && (persistent
              ? " · Persistent storage granted."
              : " · Safari may remove site data under storage pressure.")}
          </p>
          <div className="button-row wrap">
            <button className="secondary-button" onClick={() => void backup()}>
              <Download size={16} /> Back up progress
            </button>
            <button
              className="secondary-button"
              onClick={() => backupInput.current?.click()}
            >
              <Upload size={16} /> Restore progress
            </button>
            {!isNative && !persistent && (
              <button
                className="text-button"
                onClick={() => {
                  void navigator.storage?.persist().then((granted) => {
                    setPersistent(granted);
                    onNotice(
                      granted
                        ? "Persistent storage granted."
                        : "Safari decides storage persistence automatically. Keep your original books and a progress backup.",
                    );
                  });
                }}
              >
                Request persistent storage
              </button>
            )}
          </div>
          <input
            type="file"
            accept=".json,application/json"
            ref={backupInput}
            hidden
            onChange={(e) => void restore(e.target.files?.[0])}
          />
          <p className="small-note">
            Backups contain bookmarks and reading positions. Keep original EPUBs
            in a folder in Files, and reimport those same files before restoring
            progress. This app’s library is separate from that folder.
          </p>
        </section>
        {isNative ? <section><h3>Personal dictionary PDF</h3><p className="small-note">Import your own dictionary PDF for offline reference. Save a root’s page from the word explorer. No Hans Wehr content is included.</p><button className="secondary-button" onClick={()=>void nativeCall('referenceImport').catch(e=>setError(String(e)))}>Import dictionary PDF</button><button className="text-button" onClick={()=>void nativeCall('referenceOpen').catch(e=>setError(String(e)))}>Open reference</button></section> : <section>
          <h3>At home on your iPad</h3>
          <p className="small-note">
            Open your Waraq HTTPS address in Safari, tap Share, then Add to Home
            Screen. Open the installed app and import books there. Website
            storage can differ between Safari and the installed app.
          </p>
        </section>}
        <details className="credits">
          <summary>Sources & licenses</summary>
          <p>
            Definitions retain their own source. Waraq does not combine them
            into a single invented translation.
          </p>
          {(["kaikki", "lane"] as Source[]).map((source) => {
            const pack =
              available[source] || packs.find((p) => p.id === source);
            return pack ? (
              <p key={source}>
                <a href={pack.sourceUrl} target="_blank" rel="noreferrer">
                  {pack.title} ↗
                </a>
                <br />
                <a href={pack.licenseUrl} target="_blank" rel="noreferrer">
                  {pack.license}
                </a>
              </p>
            ) : null;
          })}
          <p>
            <a
              href="https://github.com/CAMeL-Lab/camel_morph"
              target="_blank"
              rel="noreferrer"
            >
              CAMeL Morph MSA 1.0 <ArrowUpRight size={12} />
            </a>{" "}
            · CC BY 4.0 data; CAMeL Tools MIT.
          </p>
          <p>
            Lane text comes from the Perseus-derived digitization distributed by
            the Lane database project. Preserve upstream notices when
            redistributing. Kaikki extracts English Wiktionary entries,
            attributed in each definition.
          </p>
        </details>
      </div>
    </dialog>
  );
}
